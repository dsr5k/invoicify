-- Invoicify financial-document ingestion migration.
-- Safe with the authoritative live schema: customers, suppliers, invoices,
-- invoice_items, expenses, purchase_bills, purchase_bill_items,
-- bill_duplicate_checks, and profiles are reused unchanged.

create table if not exists public.stored_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0),
  storage_path text not null,
  sha256_hash text not null,
  created_at timestamptz not null default now(),
  unique (user_id, sha256_hash)
);

create table if not exists public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stored_document_id uuid not null references public.stored_documents(id) on delete cascade,
  raw_data jsonb not null,
  normalized_data jsonb not null,
  confidence jsonb not null default '{}'::jsonb,
  validation jsonb not null default '{}'::jsonb,
  document_type text not null check (document_type in (
    'purchase_bill', 'sales_invoice', 'expense_receipt',
    'credit_note', 'debit_note', 'unknown'
  )),
  direction text not null check (direction in (
    'purchase', 'sale', 'expense', 'adjustment', 'unknown'
  )),
  status text not null default 'needs_review' check (status in (
    'ready_to_post', 'needs_review', 'posted', 'duplicate', 'failed'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financial_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stored_document_id uuid not null references public.stored_documents(id) on delete restrict,
  extraction_id uuid not null unique references public.document_extractions(id) on delete restrict,
  document_type text not null check (document_type in (
    'purchase_bill', 'sales_invoice', 'expense_receipt',
    'credit_note', 'debit_note', 'unknown'
  )),
  direction text not null check (direction in (
    'purchase', 'sale', 'expense', 'adjustment', 'unknown'
  )),
  status text not null default 'needs_review' check (status in (
    'ready_to_post', 'needs_review', 'posted', 'duplicate', 'failed'
  )),
  duplicate_key text,
  duplicate_of_id uuid references public.financial_documents(id) on delete set null,
  posted_record_type text,
  posted_record_id uuid,
  review_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stored_documents_user_created_idx
  on public.stored_documents (user_id, created_at desc);
create index if not exists document_extractions_document_idx
  on public.document_extractions (stored_document_id, created_at);
create index if not exists financial_documents_user_status_idx
  on public.financial_documents (user_id, status, created_at desc);
create index if not exists financial_documents_duplicate_key_idx
  on public.financial_documents (user_id, duplicate_key)
  where duplicate_key is not null;

alter table public.stored_documents enable row level security;
alter table public.document_extractions enable row level security;
alter table public.financial_documents enable row level security;

drop policy if exists stored_documents_select_own on public.stored_documents;
drop policy if exists stored_documents_insert_own on public.stored_documents;
drop policy if exists document_extractions_select_own on public.document_extractions;
drop policy if exists document_extractions_insert_own on public.document_extractions;
drop policy if exists financial_documents_select_own on public.financial_documents;
drop policy if exists financial_documents_insert_own on public.financial_documents;

create policy stored_documents_select_own on public.stored_documents
  for select using (auth.uid() = user_id);
create policy stored_documents_insert_own on public.stored_documents
  for insert with check (auth.uid() = user_id);
create policy document_extractions_select_own on public.document_extractions
  for select using (auth.uid() = user_id);
create policy document_extractions_insert_own on public.document_extractions
  for insert with check (auth.uid() = user_id);
create policy financial_documents_select_own on public.financial_documents
  for select using (auth.uid() = user_id);
create policy financial_documents_insert_own on public.financial_documents
  for insert with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('financial-documents', 'financial-documents', false)
on conflict (id) do nothing;

drop policy if exists financial_documents_storage_select on storage.objects;
drop policy if exists financial_documents_storage_insert on storage.objects;
drop policy if exists financial_documents_storage_delete on storage.objects;

create policy financial_documents_storage_select on storage.objects
  for select using (
    bucket_id = 'financial-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy financial_documents_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'financial-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy financial_documents_storage_delete on storage.objects
  for delete using (
    bucket_id = 'financial-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.post_financial_document(
  p_financial_document_id uuid,
  p_confirm_review boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.financial_documents%rowtype;
  v_extraction public.document_extractions%rowtype;
  v_data jsonb;
  v_supplier_id uuid;
  v_customer_id uuid;
  v_purchase_bill_id uuid;
  v_invoice_id uuid;
  v_expense_id uuid;
  v_existing_id uuid;
  v_item jsonb;
  v_total numeric;
  v_counterparty_name text;
  v_counterparty_gstin text;
begin
  select * into v_document
  from public.financial_documents
  where id = p_financial_document_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Financial document not found';
  end if;

  if v_document.status = 'posted' then
    return jsonb_build_object(
      'status', 'posted',
      'record_type', v_document.posted_record_type,
      'record_id', v_document.posted_record_id
    );
  end if;

  if v_document.status = 'duplicate' then
    return jsonb_build_object('status', 'duplicate', 'duplicate_of_id', v_document.duplicate_of_id);
  end if;

  if v_document.status = 'needs_review' and not p_confirm_review then
    return jsonb_build_object('status', 'needs_review', 'reason', v_document.review_reason);
  end if;

  select * into v_extraction
  from public.document_extractions
  where id = v_document.extraction_id
    and user_id = auth.uid();

  if not found then
    raise exception 'Extraction not found';
  end if;

  v_data := v_extraction.normalized_data;
  v_total := coalesce((v_data->>'total_amount')::numeric, 0);
  v_counterparty_name := nullif(trim(v_data->>'counterparty_name'), '');
  v_counterparty_gstin := nullif(upper(trim(v_data->>'counterparty_gstin')), '');

  if v_document.document_type in ('unknown', 'credit_note', 'debit_note') then
    update public.financial_documents
      set status = 'needs_review',
          review_reason = 'This document type requires manual handling.',
          updated_at = now()
    where id = v_document.id;
    return jsonb_build_object('status', 'needs_review', 'reason', 'This document type requires manual handling.');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_document.user_id::text || coalesce(v_document.duplicate_key, v_document.id::text)));

  select id into v_existing_id
  from public.financial_documents
  where user_id = v_document.user_id
    and duplicate_key is not null
    and duplicate_key = v_document.duplicate_key
    and status = 'posted'
    and id <> v_document.id
  limit 1;

  if v_existing_id is not null then
    update public.financial_documents
      set status = 'duplicate',
          duplicate_of_id = v_existing_id,
          updated_at = now()
    where id = v_document.id;
    update public.document_extractions set status = 'duplicate', updated_at = now()
    where id = v_extraction.id;
    return jsonb_build_object('status', 'duplicate', 'duplicate_of_id', v_existing_id);
  end if;

  if v_document.document_type = 'purchase_bill' then
    select id into v_supplier_id
    from public.suppliers
    where user_id = v_document.user_id
      and (
        (v_counterparty_gstin is not null and upper(coalesce(gstin, '')) = v_counterparty_gstin)
        or (v_counterparty_gstin is null and lower(name) = lower(coalesce(v_counterparty_name, '')))
      )
    order by case when v_counterparty_gstin is not null and upper(coalesce(gstin, '')) = v_counterparty_gstin then 0 else 1 end
    limit 1;

    if v_supplier_id is null then
      insert into public.suppliers (
        user_id, name, gstin, email, phone, address, city, state, pincode
      ) values (
        v_document.user_id,
        coalesce(v_counterparty_name, 'Unidentified supplier'),
        v_counterparty_gstin,
        nullif(v_data->>'counterparty_email', ''),
        nullif(v_data->>'counterparty_phone', ''),
        nullif(v_data->>'counterparty_address', ''),
        nullif(v_data->>'counterparty_city', ''),
        nullif(v_data->>'counterparty_state', ''),
        nullif(v_data->>'counterparty_pincode', '')
      ) returning id into v_supplier_id;
    end if;

    insert into public.purchase_bills (
      user_id, supplier_id, source_file_name, source_file_url, source_pages,
      bill_number, bill_date, due_date, category, currency, subtotal,
      discount_amount, cgst_amount, sgst_amount, igst_amount, other_tax_amount,
      tax_amount, total_amount, validation_status, calculated_total,
      validation_difference, status, notes, duplicate_key
    ) values (
      v_document.user_id, v_supplier_id,
      (select file_name from public.stored_documents where id = v_document.stored_document_id),
      (select storage_path from public.stored_documents where id = v_document.stored_document_id),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_data->'source_pages', '[]'::jsonb))::integer), '{}'::integer[]),
      nullif(v_data->>'invoice_number', ''),
      nullif(v_data->>'document_date', '')::date,
      nullif(v_data->>'due_date', '')::date,
      coalesce(nullif(v_data->>'category', ''), 'other'),
      coalesce(nullif(v_data->>'currency', ''), 'INR'),
      coalesce((v_data->>'subtotal')::numeric, 0),
      coalesce((v_data->>'discount_amount')::numeric, 0),
      coalesce((v_data->>'cgst_amount')::numeric, 0),
      coalesce((v_data->>'sgst_amount')::numeric, 0),
      coalesce((v_data->>'igst_amount')::numeric, 0),
      coalesce((v_data->>'other_tax_amount')::numeric, 0),
      coalesce((v_data->>'tax_amount')::numeric, 0),
      v_total,
      case when (v_extraction.validation->>'requires_review')::boolean then 'review' else 'verified' end,
      coalesce((v_extraction.validation->>'calculated_total')::numeric, 0),
      coalesce((v_extraction.validation->>'difference')::numeric, 0),
      'unpaid',
      nullif(v_data->>'notes', ''),
      v_document.duplicate_key
    ) returning id into v_purchase_bill_id;

    for v_item in select * from jsonb_array_elements(coalesce(v_data->'line_items', '[]'::jsonb))
    loop
      insert into public.purchase_bill_items (
        user_id, purchase_bill_id, description, hsn_sac, quantity, unit_price,
        discount_amount, taxable_amount, gst_rate, cgst_amount, sgst_amount,
        igst_amount, tax_amount, total_amount, sort_order
      ) values (
        v_document.user_id, v_purchase_bill_id,
        coalesce(nullif(v_item->>'description', ''), 'Unspecified item'),
        nullif(v_item->>'hsn_sac', ''),
        coalesce((v_item->>'quantity')::numeric, 1),
        coalesce((v_item->>'unit_price')::numeric, 0),
        coalesce((v_item->>'discount_amount')::numeric, 0),
        coalesce((v_item->>'taxable_amount')::numeric, (v_item->>'total_amount')::numeric, 0),
        coalesce((v_item->>'gst_rate')::numeric, 0),
        coalesce((v_item->>'cgst_amount')::numeric, 0),
        coalesce((v_item->>'sgst_amount')::numeric, 0),
        coalesce((v_item->>'igst_amount')::numeric, 0),
        coalesce((v_item->>'tax_amount')::numeric, 0),
        coalesce((v_item->>'total_amount')::numeric, 0),
        coalesce((v_item->>'sort_order')::integer, 0)
      );
    end loop;

    insert into public.bill_duplicate_checks (
      user_id, purchase_bill_id, supplier_name, supplier_gstin, bill_number,
      bill_date, total_amount, duplicate_key
    ) values (
      v_document.user_id, v_purchase_bill_id, v_counterparty_name, v_counterparty_gstin,
      nullif(v_data->>'invoice_number', ''), nullif(v_data->>'document_date', '')::date,
      v_total, v_document.duplicate_key
    );

    insert into public.expenses (
      user_id, amount, category, description, date, receipt_url, is_billable, customer_id
    ) values (
      v_document.user_id, v_total, coalesce(nullif(v_data->>'category', ''), 'other'),
      concat_ws(' - ', v_counterparty_name, nullif(v_data->>'invoice_number', '')),
      coalesce(nullif(v_data->>'document_date', '')::date, current_date),
      (select storage_path from public.stored_documents where id = v_document.stored_document_id),
      false, null
    ) returning id into v_expense_id;

    update public.financial_documents
      set status = 'posted', posted_record_type = 'purchase_bill',
          posted_record_id = v_purchase_bill_id, reviewed_by = case when p_confirm_review then auth.uid() else null end,
          reviewed_at = case when p_confirm_review then now() else null end,
          posted_at = now(), updated_at = now()
    where id = v_document.id;

    update public.document_extractions set status = 'posted', updated_at = now()
    where id = v_extraction.id;

    return jsonb_build_object('status', 'posted', 'record_type', 'purchase_bill', 'record_id', v_purchase_bill_id, 'expense_id', v_expense_id);
  end if;

  if v_document.document_type = 'sales_invoice' then
    select id into v_customer_id
    from public.customers
    where user_id = v_document.user_id
      and (
        (v_counterparty_gstin is not null and upper(coalesce(gstin, '')) = v_counterparty_gstin)
        or (v_counterparty_gstin is null and lower(name) = lower(coalesce(v_counterparty_name, '')))
      )
    order by case when v_counterparty_gstin is not null and upper(coalesce(gstin, '')) = v_counterparty_gstin then 0 else 1 end
    limit 1;

    if v_customer_id is null then
      insert into public.customers (
        user_id, name, gstin, email, phone, address, city, state, pincode
      ) values (
        v_document.user_id,
        coalesce(v_counterparty_name, 'Unidentified customer'),
        v_counterparty_gstin,
        nullif(v_data->>'counterparty_email', ''),
        nullif(v_data->>'counterparty_phone', ''),
        nullif(v_data->>'counterparty_address', ''),
        nullif(v_data->>'counterparty_city', ''),
        nullif(v_data->>'counterparty_state', ''),
        nullif(v_data->>'counterparty_pincode', '')
      ) returning id into v_customer_id;
    end if;

    insert into public.invoices (
      user_id, customer_id, invoice_number, status, issue_date, due_date,
      subtotal, tax_rate, tax_amount, total_amount, currency, notes,
      tax_type, cgst_amount, sgst_amount, igst_amount, place_of_supply,
      business_state, customer_state, gst_type, gst_amount, discount_amount
    ) values (
      v_document.user_id, v_customer_id, coalesce(nullif(v_data->>'invoice_number', ''), 'AI-' || substr(v_document.id::text, 1, 8)),
      'draft', nullif(v_data->>'document_date', '')::date, nullif(v_data->>'due_date', '')::date,
      coalesce((v_data->>'subtotal')::numeric, 0),
      coalesce((v_data->>'effective_tax_rate')::numeric, 0),
      coalesce((v_data->>'tax_amount')::numeric, 0), v_total,
      coalesce(nullif(v_data->>'currency', ''), 'INR'), nullif(v_data->>'notes', ''),
      nullif(v_data->>'tax_type', ''),
      coalesce((v_data->>'cgst_amount')::numeric, 0),
      coalesce((v_data->>'sgst_amount')::numeric, 0),
      coalesce((v_data->>'igst_amount')::numeric, 0),
      nullif(v_data->>'place_of_supply', ''),
      nullif(v_data->>'business_state', ''),
      nullif(v_data->>'counterparty_state', ''),
      nullif(v_data->>'tax_type', ''),
      coalesce((v_data->>'tax_amount')::numeric, 0),
      coalesce((v_data->>'discount_amount')::numeric, 0)
    ) returning id into v_invoice_id;

    for v_item in select * from jsonb_array_elements(coalesce(v_data->'line_items', '[]'::jsonb))
    loop
      insert into public.invoice_items (
        invoice_id, description, hsn_sac, quantity, unit_price, gst_rate,
        taxable_amount, gst_amount, total_amount, discount_percent, discount_amount
      ) values (
        v_invoice_id, coalesce(nullif(v_item->>'description', ''), 'Unspecified item'),
        nullif(v_item->>'hsn_sac', ''), coalesce((v_item->>'quantity')::numeric, 1),
        coalesce((v_item->>'unit_price')::numeric, 0), coalesce((v_item->>'gst_rate')::numeric, 0),
        coalesce((v_item->>'taxable_amount')::numeric, (v_item->>'total_amount')::numeric, 0),
        coalesce((v_item->>'tax_amount')::numeric, 0), coalesce((v_item->>'total_amount')::numeric, 0),
        coalesce((v_item->>'discount_percent')::numeric, 0), coalesce((v_item->>'discount_amount')::numeric, 0)
      );
    end loop;

    update public.financial_documents
      set status = 'posted', posted_record_type = 'invoice',
          posted_record_id = v_invoice_id, reviewed_by = case when p_confirm_review then auth.uid() else null end,
          reviewed_at = case when p_confirm_review then now() else null end,
          posted_at = now(), updated_at = now()
    where id = v_document.id;
    update public.document_extractions set status = 'posted', updated_at = now()
    where id = v_extraction.id;
    return jsonb_build_object('status', 'posted', 'record_type', 'invoice', 'record_id', v_invoice_id);
  end if;

  insert into public.expenses (
    user_id, amount, category, description, date, receipt_url, is_billable, customer_id
  ) values (
    v_document.user_id, v_total, coalesce(nullif(v_data->>'category', ''), 'other'),
    coalesce(nullif(v_data->>'notes', ''), 'Expense receipt'),
    coalesce(nullif(v_data->>'document_date', '')::date, current_date),
    (select storage_path from public.stored_documents where id = v_document.stored_document_id),
    false, null
  ) returning id into v_expense_id;

  update public.financial_documents
    set status = 'posted', posted_record_type = 'expense', posted_record_id = v_expense_id,
        reviewed_by = case when p_confirm_review then auth.uid() else null end,
        reviewed_at = case when p_confirm_review then now() else null end,
        posted_at = now(), updated_at = now()
  where id = v_document.id;
  update public.document_extractions set status = 'posted', updated_at = now()
  where id = v_extraction.id;
  return jsonb_build_object('status', 'posted', 'record_type', 'expense', 'record_id', v_expense_id);
end;
$$;

revoke all on function public.post_financial_document(uuid, boolean) from public;
grant execute on function public.post_financial_document(uuid, boolean) to authenticated;
