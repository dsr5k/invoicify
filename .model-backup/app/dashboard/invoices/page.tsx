"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/app/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { FileText, Plus, Loader2 } from "lucide-react"
import Link from "next/link"

type Invoice = {
  id: string
  invoice_number: string
  status: string
  issue_date: string
  due_date: string | null
  total_amount: number
  created_at: string
  customers: { name: string } | null
}

const statusColors: Record<string, string> = {
  paid: "bg-green-500/10 text-green-400 border-green-500/20",
  sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  draft: "bg-white/5 text-white/40 border-white/10",
  overdue: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-white/5 text-white/30 border-white/10",
}

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount)
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const supabase = createClient()

  useEffect(() => { loadInvoices() }, [])

  async function loadInvoices() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("invoices")
      .select("*, customers(name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    setInvoices(data ?? [])
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("invoices").update({ status }).eq("id", id)
    setInvoices(invoices.map(inv => inv.id === id ? { ...inv, status } : inv))
  }

  async function deleteInvoice(id: string) {
    await supabase.from("invoices").delete().eq("id", id)
    setInvoices(invoices.filter(inv => inv.id !== id))
  }

  const filtered = filter === "all" ? invoices : invoices.filter(inv => inv.status === filter)
  const totalRevenue = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + Number(i.total_amount), 0)

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-white/40 text-sm mt-1">
            {invoices.length} total · {formatINR(totalRevenue)} collected
          </p>
        </div>
        <Link href="/dashboard/invoices/new">
          <Button className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 gap-2">
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {["all", "draft", "sent", "paid", "overdue"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === tab
                ? "bg-white/10 text-white"
                : "text-white/30 hover:text-white/50 hover:bg-white/5"
            }`}
          >
            {tab}
            {tab !== "all" && (
              <span className="ml-1.5 text-white/20">
                {invoices.filter(i => i.status === tab).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="h-6 w-6 text-white/20 mx-auto animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="h-8 w-8 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No invoices found</p>
            <Link href="/dashboard/invoices/new">
              <Button size="sm" className="mt-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 gap-2">
                <Plus className="h-3 w-3" />
                Create your first invoice
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-white/30" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{invoice.invoice_number}</p>
                    <p className="text-xs text-white/30">
                      {invoice.customers?.name ?? "No customer"} · {new Date(invoice.issue_date).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status dropdown — click to change */}
                  <select
                    value={invoice.status}
                    onChange={(e) => updateStatus(invoice.id, e.target.value)}
                    className={`text-xs px-2.5 py-1 rounded-full border appearance-none cursor-pointer ${statusColors[invoice.status] ?? statusColors.draft}`}
                  >
                    <option value="draft" className="bg-[#0a0a0f]">Draft</option>
                    <option value="sent" className="bg-[#0a0a0f]">Sent</option>
                    <option value="paid" className="bg-[#0a0a0f]">Paid</option>
                    <option value="overdue" className="bg-[#0a0a0f]">Overdue</option>
                    <option value="cancelled" className="bg-[#0a0a0f]">Cancelled</option>
                  </select>

                  <p className="text-sm font-semibold tabular-nums w-28 text-right">
                    {formatINR(Number(invoice.total_amount))}
                  </p>

                  <button
                    onClick={() => deleteInvoice(invoice.id)}
                    className="text-white/20 hover:text-red-400 transition-colors text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}