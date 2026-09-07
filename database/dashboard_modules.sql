-- Run this file once in Supabase SQL Editor.
-- It extends the existing application; it does not replace invoices, customers, expenses, or profiles.

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  gstin text,
  email text,
  phone text,
  address text,
  industry text,
  state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vendors add column if not exists gstin text;
alter table public.vendors add column if not exists email text;
alter table public.vendors add column if not exists phone text;
alter table public.vendors add column if not exists address text;
alter table public.vendors add column if not exists industry text;
alter table public.vendors add column if not exists state text;
alter table public.vendors add column if not exists updated_at timestamptz not null default now();

create unique index if not exists vendors_user_name_unique
  on public.vendors (user_id, lower(name));

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  po_number text not null,
  vendor_name text,
  order_date date not null default current_date,
  expected_date date,
  total_amount numeric(14,2) not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'approved', 'partially_received', 'received', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, po_number)
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  title text not null,
  amount numeric(14,2),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  action_type text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vendors enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.approval_requests enable row level security;
alter table public.automation_rules enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['vendors', 'purchase_orders', 'approval_requests', 'automation_rules']
  loop
    execute format('drop policy if exists "%s_select_own" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s_insert_own" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s_update_own" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%s_delete_own" on public.%I', table_name, table_name);
    execute format('create policy "%s_select_own" on public.%I for select using (auth.uid() = user_id)', table_name, table_name);
    execute format('create policy "%s_insert_own" on public.%I for insert with check (auth.uid() = user_id)', table_name, table_name);
    execute format('create policy "%s_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name, table_name);
    execute format('create policy "%s_delete_own" on public.%I for delete using (auth.uid() = user_id)', table_name, table_name);
  end loop;
end $$;
