"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/app/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  BarChart3,
  Bot,
  Check,
  FileText,
  IndianRupee,
  Loader2,
  PackageCheck,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react"

type Module =
  | "analytics"
  | "approvals"
  | "automations"
  | "expenses"
  | "gst"
  | "payments"
  | "purchase-orders"
  | "settings"
  | "vendors"

type Row = Record<string, unknown>

const fmt = (value: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0))

const date = (value: unknown) =>
  value ? new Date(String(value)).toLocaleDateString("en-IN") : "—"

const title: Record<Module, string> = {
  analytics: "Analytics",
  approvals: "Approvals",
  automations: "Automations",
  expenses: "Expenses",
  gst: "GST Compliance",
  payments: "Payments",
  "purchase-orders": "Purchase Orders",
  settings: "Settings",
  vendors: "Vendors",
}

const subtitle: Record<Module, string> = {
  analytics: "Business performance from your live invoices and expenses.",
  approvals: "Review and record decisions for business transactions.",
  automations: "Rules that reduce repetitive finance work.",
  expenses: "Track every operating expense in one place.",
  gst: "Monitor GST collected, paid, and filing readiness.",
  payments: "Track invoice collections and outstanding balances.",
  "purchase-orders": "Create and manage supplier purchase commitments.",
  settings: "Manage your business profile.",
  vendors: "Suppliers and customers saved from your workflow.",
}

function Badge({ value }: { value: unknown }) {
  const status = String(value ?? "draft").toLowerCase()
  const colors: Record<string, string> = {
    paid: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    approved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    active: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    pending: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    sent: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    draft: "bg-white/5 text-white/50 border-white/10",
    overdue: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    rejected: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    cancelled: "bg-white/5 text-white/40 border-white/10",
  }

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs capitalize ${colors[status] ?? colors.draft}`}>
      {status}
    </span>
  )
}

function EmptyState({
  icon: Icon,
  text,
  action,
}: {
  icon: typeof FileText
  text: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      <Icon className="mx-auto mb-3 h-8 w-8 text-white/20" />
      <p className="text-sm text-white/45">{text}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

function Stat({
  label,
  value,
  icon: Icon,
  tone = "text-blue-300",
}: {
  label: string
  value: string
  icon: typeof IndianRupee
  tone?: string
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-white/45">{label}</p>
        <div className="rounded-lg bg-white/5 p-2">
          <Icon className={`h-4 w-4 ${tone}`} />
        </div>
      </div>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  )
}

export function DashboardModule({ module }: { module: Module }) {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Row[]>([])
  const [secondary, setSecondary] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      if (module === "vendors") {
        const response = await fetch("/api/vendors")
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? "Unable to load vendors")
        setRows(result.vendors ?? [])
        setSecondary([])
        return
      }

      if (module === "analytics") {
        const [{ data: invoices, error: invoiceError }, { data: expenses, error: expenseError }, { data: vendors, error: vendorError }] = await Promise.all([
          supabase.from("invoices").select("id, total_amount, status, issue_date, created_at").order("issue_date", { ascending: true }),
          supabase.from("expenses").select("id, amount, category, date").order("date", { ascending: true }),
          supabase.from("vendors").select("id, name"),
        ])
        if (invoiceError || expenseError || vendorError) throw invoiceError ?? expenseError ?? vendorError
        setRows(invoices ?? [])
        setSecondary([...(expenses ?? []), { vendor_count: (vendors ?? []).length }])
        return
      }

      if (module === "gst") {
        const { data, error: queryError } = await supabase
          .from("invoices")
          .select("id, invoice_number, issue_date, status, subtotal, tax_amount, cgst_amount, sgst_amount, igst_amount, total_amount")
          .order("issue_date", { ascending: false })
        if (queryError) throw queryError
        setRows(data ?? [])
        setSecondary([])
        return
      }

      if (module === "payments") {
        const { data, error: queryError } = await supabase
          .from("invoices")
          .select("id, invoice_number, issue_date, due_date, total_amount, status, vendors(name)")
          .order("issue_date", { ascending: false })
        if (queryError) throw queryError
        setRows(data ?? [])
        setSecondary([])
        return
      }

      if (module === "settings") {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("id, business_name")
          .eq("id", auth.user?.id ?? "")
          .maybeSingle()
        if (profileError) throw profileError
        setRows(data ? [data] : [])
        setSecondary(auth.user ? [{ email: auth.user.email ?? "" }] : [])
        setForm({ business_name: String(data?.business_name ?? "") })
        return
      }

      const table: Record<string, string> = {
        expenses: "expenses",
        approvals: "approval_requests",
        automations: "automation_rules",
        "purchase-orders": "purchase_orders",
      }

      const { data, error: queryError } = await supabase
        .from(table[module])
        .select("*")
        .order("created_at", { ascending: false })

      if (queryError) throw queryError
      setRows(data ?? [])
      setSecondary([])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load data.")
    } finally {
      setLoading(false)
    }
  }, [module, supabase])

  useEffect(() => {
    void load()
  }, [load])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error("Your session has expired. Please sign in again.")

      if (module === "vendors") {
        const response = await fetch("/api/vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? "Unable to save vendor")
      } else if (module === "settings") {
        const { error: saveError } = await supabase.from("profiles").upsert({
          id: auth.user.id,
          business_name: form.business_name?.trim() || null,
        })
        if (saveError) throw saveError
      } else {
        const values: Record<string, unknown> = { user_id: auth.user.id }

        if (module === "expenses") {
          values.amount = Number(form.amount || 0)
          values.category = form.category || "other"
          values.description = form.description || null
          values.date = form.date || new Date().toISOString().slice(0, 10)
        }
        if (module === "purchase-orders") {
          values.po_number = form.po_number
          values.vendor_name = form.vendor_name || null
          values.order_date = form.order_date || new Date().toISOString().slice(0, 10)
          values.expected_date = form.expected_date || null
          values.total_amount = Number(form.total_amount || 0)
          values.status = "draft"
        }
        if (module === "automations") {
          values.name = form.name
          values.trigger_type = form.trigger_type || "invoice_created"
          values.action_type = form.action_type || "notify"
          values.enabled = true
        }

        const table: Record<string, string> = {
          expenses: "expenses",
          "purchase-orders": "purchase_orders",
          automations: "automation_rules",
        }
        const { error: saveError } = await supabase.from(table[module]).insert(values)
        if (saveError) throw saveError
      }

      setForm({})
      setShowForm(false)
      setNotice("Saved successfully.")
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save changes.")
    } finally {
      setSaving(false)
    }
  }

  const approve = async (id: string, status: "approved" | "rejected") => {
    setSaving(true)
    setError(null)
    const { error: updateError } = await supabase
      .from("approval_requests")
      .update({ status, decided_at: new Date().toISOString() })
      .eq("id", id)

    if (updateError) setError(updateError.message)
    else {
      setNotice(`Request ${status}.`)
      await load()
    }
    setSaving(false)
  }

  const markPaid = async (id: string) => {
    setSaving(true)
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ status: "paid" })
      .eq("id", id)

    if (updateError) setError(updateError.message)
    else {
      setNotice("Payment recorded.")
      await load()
    }
    setSaving(false)
  }

  const filtered = rows.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(search.toLowerCase())
  )

  const invoices = module === "analytics" || module === "gst" || module === "payments" ? rows : []
  const paid = invoices.filter((item) => item.status === "paid")
  const outstanding = invoices.filter((item) => ["sent", "overdue"].includes(String(item.status)))
  const revenue = paid.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0)
  const outstandingTotal = outstanding.reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0)

  const formFields: Record<string, Array<{ key: string; label: string; type?: string; required?: boolean }>> = {
    vendors: [
      { key: "name", label: "Vendor name", required: true },
      { key: "gstin", label: "GSTIN" },
      { key: "industry", label: "Industry" },
      { key: "state", label: "GST state" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
    ],
    expenses: [
      { key: "description", label: "Description", required: true },
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "category", label: "Category", required: true },
      { key: "date", label: "Date", type: "date", required: true },
    ],
    "purchase-orders": [
      { key: "po_number", label: "PO number", required: true },
      { key: "vendor_name", label: "Vendor" },
      { key: "total_amount", label: "Total amount", type: "number", required: true },
      { key: "order_date", label: "Order date", type: "date", required: true },
      { key: "expected_date", label: "Expected date", type: "date" },
    ],
    automations: [
      { key: "name", label: "Rule name", required: true },
      { key: "trigger_type", label: "Trigger", required: true },
      { key: "action_type", label: "Action", required: true },
    ],
    settings: [{ key: "business_name", label: "Business name", required: true }],
  }

  const createLabel: Partial<Record<Module, string>> = {
    vendors: "Add vendor",
    expenses: "Add expense",
    automations: "New rule",
    "purchase-orders": "New purchase order",
  }

  return (
    <div className="min-h-full p-5 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title[module]}</h1>
            <p className="mt-1 text-sm text-white/45">{subtitle[module]}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading} className="border-white/10 bg-white/[0.03]">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {createLabel[module] ? (
              <Button onClick={() => setShowForm((value) => !value)} className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500">
                <Plus className="mr-2 h-4 w-4" />
                {createLabel[module]}
              </Button>
            ) : null}
          </div>
        </div>

        {error ? <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div> : null}
        {notice ? <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">{notice}</div> : null}

        {showForm && formFields[module] ? (
          <form onSubmit={submit} className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 md:grid-cols-2">
            {formFields[module].map((field) => (
              <label key={field.key} className="space-y-2 text-sm text-white/60">
                <span>{field.label}</span>
                <Input
                  required={field.required}
                  type={field.type ?? "text"}
                  value={form[field.key] ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                  className="border-white/10 bg-black/20 text-white"
                />
              </label>
            ))}
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-500">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Save
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        ) : null}

        {module === "analytics" ? (
          <Analytics rows={rows} secondary={secondary} revenue={revenue} />
        ) : null}

        {module === "gst" ? <Gst rows={rows} /> : null}

        {module === "payments" ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Collected" value={fmt(revenue)} icon={Wallet} tone="text-emerald-300" />
              <Stat label="Outstanding" value={fmt(outstandingTotal)} icon={IndianRupee} tone="text-amber-300" />
              <Stat label="Overdue invoices" value={String(rows.filter((item) => item.status === "overdue").length)} icon={Receipt} tone="text-rose-300" />
            </div>
            <DataList rows={filtered} loading={loading} icon={Wallet} empty="No payments to track yet." search={search} setSearch={setSearch}>
              {filtered.map((item) => (
                <div key={String(item.id)} className="grid gap-3 border-b border-white/5 px-5 py-4 last:border-0 md:grid-cols-[1.2fr_1fr_auto_auto] md:items-center">
                  <div><p className="font-medium">{String(item.invoice_number ?? "Invoice")}</p><p className="text-xs text-white/35">{date(item.issue_date)} · {String((item.vendors as { name?: string } | null)?.name ?? "No customer")}</p></div>
                  <p className="text-sm text-white/50">Due {date(item.due_date)}</p>
                  <p className="font-medium">{fmt(item.total_amount)}</p>
                  <div className="flex items-center gap-2">{item.status === "paid" ? <Badge value="paid" /> : <Button size="sm" disabled={saving} onClick={() => void markPaid(String(item.id))}>Mark paid</Button>}</div>
                </div>
              ))}
            </DataList>
          </div>
        ) : null}

        {module === "expenses" ? (
          <DataList rows={filtered} loading={loading} icon={Receipt} empty="No expenses recorded yet." search={search} setSearch={setSearch}>
            {filtered.map((item) => <SimpleRow key={String(item.id)} title={String(item.description ?? "Expense")} subtitle={`${String(item.category ?? "other")} · ${date(item.date)}`} amount={fmt(item.amount)} />)}
          </DataList>
        ) : null}

        {module === "vendors" ? (
          <DataList rows={filtered} loading={loading} icon={Users} empty="No vendors yet. Upload a bill or add one manually." search={search} setSearch={setSearch}>
            {filtered.map((item) => <SimpleRow key={String(item.id)} title={String(item.name ?? "Unnamed vendor")} subtitle={[item.industry, item.gstin, item.email].filter(Boolean).join(" · ") || "No details added"} amount="" />)}
          </DataList>
        ) : null}

        {module === "purchase-orders" ? (
          <DataList rows={filtered} loading={loading} icon={PackageCheck} empty="No purchase orders yet." search={search} setSearch={setSearch}>
            {filtered.map((item) => <SimpleRow key={String(item.id)} title={String(item.po_number ?? "Purchase order")} subtitle={`${String(item.vendor_name ?? "No vendor")} · ${date(item.order_date)}`} amount={fmt(item.total_amount)} status={item.status} />)}
          </DataList>
        ) : null}

        {module === "automations" ? (
          <DataList rows={filtered} loading={loading} icon={Bot} empty="No automation rules yet." search={search} setSearch={setSearch}>
            {filtered.map((item) => <SimpleRow key={String(item.id)} title={String(item.name ?? "Automation")} subtitle={`${String(item.trigger_type ?? "")} → ${String(item.action_type ?? "")}`} amount="" status={item.enabled ? "active" : "disabled"} />)}
          </DataList>
        ) : null}

        {module === "approvals" ? (
          <DataList rows={filtered} loading={loading} icon={ShieldCheck} empty="No approval requests yet." search={search} setSearch={setSearch}>
            {filtered.map((item) => (
              <div key={String(item.id)} className="flex flex-col gap-3 border-b border-white/5 px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-medium">{String(item.title ?? item.entity_type ?? "Approval request")}</p><p className="text-xs text-white/35">Requested {date(item.created_at)}</p></div>
                <div className="flex items-center gap-2">{item.amount ? <span className="mr-2">{fmt(item.amount)}</span> : null}{item.status === "pending" ? <><Button size="sm" disabled={saving} onClick={() => void approve(String(item.id), "approved")}>Approve</Button><Button size="sm" variant="outline" disabled={saving} onClick={() => void approve(String(item.id), "rejected")} className="border-rose-500/30 text-rose-300">Reject</Button></> : <Badge value={item.status} />}</div>
              </div>
            ))}
          </DataList>
        ) : null}

        {module === "settings" ? (
          <form onSubmit={submit} className="max-w-xl space-y-5 rounded-xl border border-white/5 bg-white/[0.03] p-6">
            <div><h2 className="font-medium">Business profile</h2><p className="mt-1 text-sm text-white/40">This name appears throughout your workspace.</p></div>
            <label className="block space-y-2 text-sm text-white/60"><span>Business name</span><Input required value={form.business_name ?? ""} onChange={(event) => setForm({ business_name: event.target.value })} className="border-white/10 bg-black/20 text-white" /></label>
            <p className="text-sm text-white/40">Signed in as {String(secondary[0]?.email ?? "—")}</p>
            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-500">{saving ? "Saving…" : "Save changes"}</Button>
          </form>
        ) : null}
      </div>
    </div>
  )
}

function DataList({ rows, loading, icon, empty, search, setSearch, children }: { rows: Row[]; loading: boolean; icon: typeof FileText; empty: string; search: string; setSearch: (value: string) => void; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.03]">
      <div className="flex flex-col gap-3 border-b border-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/45">{loading ? "Loading…" : `${rows.length} result${rows.length === 1 ? "" : "s"}`}</p>
        <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="border-white/10 bg-black/20 pl-9 text-white" /></div>
      </div>
      {loading ? <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-blue-400" /></div> : rows.length ? children : <EmptyState icon={icon} text={empty} />}
    </div>
  )
}

function SimpleRow({ title, subtitle, amount, status }: { title: string; subtitle: string; amount: string; status?: unknown }) {
  return <div className="flex items-center justify-between gap-4 border-b border-white/5 px-5 py-4 last:border-0"><div className="min-w-0"><p className="truncate font-medium">{title}</p><p className="mt-1 truncate text-xs text-white/35">{subtitle}</p></div><div className="flex shrink-0 items-center gap-4">{status ? <Badge value={status} /> : null}{amount ? <p className="font-medium">{amount}</p> : null}</div></div>
}

function Analytics({ rows, secondary, revenue }: { rows: Row[]; secondary: Row[]; revenue: number }) {
  const expenses = secondary.filter((item) => "amount" in item)
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount ?? 0), 0)
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const month = new Date()
    month.setMonth(month.getMonth() - (5 - index))
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`
    const amount = rows.filter((item) => String(item.status) === "paid" && String(item.issue_date ?? item.created_at).startsWith(key)).reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0)
    return { label: month.toLocaleDateString("en-IN", { month: "short" }), amount }
  })
  const max = Math.max(...monthly.map((item) => item.amount), 1)
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Collected revenue" value={fmt(revenue)} icon={IndianRupee} tone="text-emerald-300" /><Stat label="Outstanding" value={fmt(rows.filter((item) => ["sent", "overdue"].includes(String(item.status))).reduce((sum, item) => sum + Number(item.total_amount ?? 0), 0))} icon={Wallet} tone="text-amber-300" /><Stat label="Expenses" value={fmt(totalExpenses)} icon={Receipt} tone="text-rose-300" /><Stat label="Vendors" value={String(secondary.find((item) => "vendor_count" in item)?.vendor_count ?? 0)} icon={Users} tone="text-violet-300" /></div><div className="rounded-xl border border-white/5 bg-white/[0.03] p-6"><div className="mb-6"><h2 className="font-medium">Paid revenue trend</h2><p className="mt-1 text-sm text-white/40">Last six months</p></div><div className="flex h-48 items-end gap-3">{monthly.map((item) => <div key={item.label} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-md bg-gradient-to-t from-blue-600 to-violet-500" style={{ height: `${Math.max((item.amount / max) * 100, item.amount ? 6 : 1)}%` }} title={`${item.label}: ${fmt(item.amount)}`} /><span className="text-xs text-white/35">{item.label}</span></div>)}</div></div></div>
}

function Gst({ rows }: { rows: Row[] }) {
  const total = (field: string) => rows.reduce((sum, item) => sum + Number(item[field] ?? 0), 0)
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Taxable sales" value={fmt(total("subtotal"))} icon={FileText} /><Stat label="CGST" value={fmt(total("cgst_amount"))} icon={IndianRupee} tone="text-amber-300" /><Stat label="SGST" value={fmt(total("sgst_amount"))} icon={IndianRupee} tone="text-amber-300" /><Stat label="IGST" value={fmt(total("igst_amount"))} icon={IndianRupee} tone="text-violet-300" /></div><DataList rows={rows} loading={false} icon={FileText} empty="No GST-bearing invoices found." search="" setSearch={() => undefined}>{rows.map((item) => <SimpleRow key={String(item.id)} title={String(item.invoice_number ?? "Invoice")} subtitle={`${date(item.issue_date)} · Tax ${fmt(item.tax_amount)}`} amount={fmt(item.total_amount)} status={item.status} />)}</DataList></div>
}
