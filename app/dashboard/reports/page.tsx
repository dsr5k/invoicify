"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/app/utils/supabase/client"
import {
  IndianRupee, TrendingUp, TrendingDown, Receipt, FileText,
  Users, Loader2, ArrowUpRight, ArrowDownRight, Calendar,
  Download, PieChart, BarChart3, Wallet, AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"

const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)
const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100)

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const CAT_COLORS: Record<string, string> = {
  travel: "#3b82f6", food: "#f59e0b", office_supplies: "#8b5cf6", software: "#06b6d4",
  marketing: "#ec4899", utilities: "#10b981", rent: "#f97316", salaries: "#6366f1",
  services: "#14b8a6", other: "#64748b",
}

type DateRange = "7d" | "30d" | "90d" | "365d" | "all"

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<DateRange>("30d")
  const [invoices, setInvoices] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: inv }, { data: exp }, { data: cust }] = await Promise.all([
        supabase.from("invoices").select("*, vendors(name)").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("expenses").select("*").eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("vendors").select("id, name").eq("user_id", user.id),
      ])
      setInvoices(inv ?? [])
      setExpenses(exp ?? [])
      setVendors(cust ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // Filtered data by date range
  const filtered = useMemo(() => {
    const now = Date.now()
    const days: Record<DateRange, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365, all: 99999 }
    const cutoff = now - days[range] * 86400000

    const fInv = invoices.filter(i => new Date(i.created_at).getTime() >= cutoff)
    const fExp = expenses.filter(e => new Date(e.date).getTime() >= cutoff)

    // Previous period for comparison
    const prevCutoff = cutoff - (now - cutoff)
    const pInv = invoices.filter(i => { const t = new Date(i.created_at).getTime(); return t >= prevCutoff && t < cutoff })
    const pExp = expenses.filter(e => { const t = new Date(e.date).getTime(); return t >= prevCutoff && t < cutoff })

    return { fInv, fExp, pInv, pExp }
  }, [invoices, expenses, range])

  const { fInv, fExp, pInv, pExp } = filtered

  // Core metrics
  const revenue = fInv.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total_amount), 0)
  const prevRevenue = pInv.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total_amount), 0)
  const pending = fInv.filter(i => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + Number(i.total_amount), 0)
  const totalExpenses = fExp.reduce((s, e) => s + Number(e.amount), 0)
  const prevExpenses = pExp.reduce((s, e) => s + Number(e.amount), 0)
  const profit = revenue - totalExpenses
  const prevProfit = prevRevenue - prevExpenses
  const overdue = fInv.filter(i => i.status === "overdue")
  const overdueAmt = overdue.reduce((s, i) => s + Number(i.total_amount), 0)

  // Revenue change %
  const revenueChange = prevRevenue === 0 ? (revenue > 0 ? 100 : 0) : Math.round(((revenue - prevRevenue) / prevRevenue) * 100)
  const expenseChange = prevExpenses === 0 ? (totalExpenses > 0 ? 100 : 0) : Math.round(((totalExpenses - prevExpenses) / prevExpenses) * 100)
  const profitChange = prevProfit === 0 ? (profit > 0 ? 100 : 0) : Math.round(((profit - prevProfit) / Math.abs(prevProfit)) * 100)

  // Invoice status breakdown
  const statusCounts: Record<string, number> = { paid: 0, sent: 0, draft: 0, overdue: 0 }
  fInv.forEach(i => { statusCounts[i.status] = (statusCounts[i.status] || 0) + 1 })
  const totalInvCount = fInv.length || 1

  // Expenses by category
  const expByCat: Record<string, number> = {}
  fExp.forEach(e => { expByCat[e.category || "other"] = (expByCat[e.category || "other"] || 0) + Number(e.amount) })
  const sortedCats = Object.entries(expByCat).sort((a, b) => b[1] - a[1])
  const maxCatAmt = sortedCats[0]?.[1] || 1

  // Monthly revenue (last 6 months)
  const monthlyData: { month: string; revenue: number; expenses: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const m = d.getMonth()
    const y = d.getFullYear()
    const mRev = invoices.filter(inv => { const dt = new Date(inv.created_at); return dt.getMonth() === m && dt.getFullYear() === y && inv.status === "paid" }).reduce((s, inv) => s + Number(inv.total_amount), 0)
    const mExp = expenses.filter(exp => { const dt = new Date(exp.date); return dt.getMonth() === m && dt.getFullYear() === y }).reduce((s, exp) => s + Number(exp.amount), 0)
    monthlyData.push({ month: `${MONTHS[m]} ${String(y).slice(2)}`, revenue: mRev, expenses: mExp })
  }
  const maxMonthly = Math.max(...monthlyData.map(d => Math.max(d.revenue, d.expenses)), 1)

  // Top vendors
  const custRevenue: Record<string, { name: string; total: number; count: number }> = {}
  fInv.filter(i => i.status === "paid").forEach(i => {
    const name = i.vendors?.name || "Unknown"
    if (!custRevenue[name]) custRevenue[name] = { name, total: 0, count: 0 }
    custRevenue[name].total += Number(i.total_amount)
    custRevenue[name].count++
  })
  const topVendors = Object.values(custRevenue).sort((a, b) => b.total - a.total).slice(0, 5)
  const maxCustRev = topVendors[0]?.total || 1

  // Aging buckets
  const agingBuckets = { current: 0, "1-30": 0, "31-60": 0, "60+": 0 }
  fInv.filter(i => i.status === "sent" || i.status === "overdue").forEach(i => {
    if (!i.due_date) { agingBuckets.current += Number(i.total_amount); return }
    const daysOverdue = Math.floor((Date.now() - new Date(i.due_date).getTime()) / 86400000)
    if (daysOverdue <= 0) agingBuckets.current += Number(i.total_amount)
    else if (daysOverdue <= 30) agingBuckets["1-30"] += Number(i.total_amount)
    else if (daysOverdue <= 60) agingBuckets["31-60"] += Number(i.total_amount)
    else agingBuckets["60+"] += Number(i.total_amount)
  })

  // Export
  function exportReport() {
    const rows = [
      ["Ozio Financial Report"],
      [`Period: ${range === "all" ? "All time" : `Last ${range.replace("d", " days")}`}`],
      [""],
      ["Metric", "Amount"],
      ["Revenue (Paid)", revenue],
      ["Pending", pending],
      ["Total Expenses", totalExpenses],
      ["Net Profit", profit],
      ["Overdue Amount", overdueAmt],
      [""],
      ["Expense Category", "Amount"],
      ...sortedCats.map(([cat, amt]) => [cat, amt]),
      [""],
      ["Month", "Revenue", "Expenses"],
      ...monthlyData.map(d => [d.month, d.revenue, d.expenses]),
      [""],
      ["Top Vendor", "Revenue", "Invoices"],
      ...topVendors.map(c => [c.name, c.total, c.count]),
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ozio_report_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="p-8 flex items-center justify-center h-full"><Loader2 className="h-6 w-6 text-white/20 animate-spin" /></div>

  function TrendBadge({ value }: { value: number }) {
    if (value === 0) return <span className="text-xs text-white/20">—</span>
    const up = value > 0
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-green-400" : "text-red-400"}`}>
        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(value)}%
      </span>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-white/40 text-sm mt-1">Financial overview of your business</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex items-center bg-white/[0.03] border border-white/5 rounded-lg p-1">
            {([["7d", "7D"], ["30d", "30D"], ["90d", "90D"], ["365d", "1Y"], ["all", "All"]] as [DateRange, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  range === key ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Button onClick={exportReport} variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-white gap-2 text-sm">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-white/30 uppercase tracking-wider">Revenue</span>
            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center"><IndianRupee className="h-4 w-4 text-green-400" /></div>
          </div>
          <p className="text-2xl font-bold text-green-400">{fmt(revenue)}</p>
          <div className="flex items-center justify-between mt-2"><span className="text-xs text-white/20">vs prev period</span><TrendBadge value={revenueChange} /></div>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-white/30 uppercase tracking-wider">Pending</span>
            <div className="h-8 w-8 rounded-lg bg-yellow-500/10 flex items-center justify-center"><Wallet className="h-4 w-4 text-yellow-400" /></div>
          </div>
          <p className="text-2xl font-bold text-yellow-400">{fmt(pending)}</p>
          <p className="text-xs text-white/20 mt-2">{fInv.filter(i => i.status === "sent").length} sent · {overdue.length} overdue</p>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-white/30 uppercase tracking-wider">Expenses</span>
            <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center"><Receipt className="h-4 w-4 text-red-400" /></div>
          </div>
          <p className="text-2xl font-bold text-red-400">{fmt(totalExpenses)}</p>
          <div className="flex items-center justify-between mt-2"><span className="text-xs text-white/20">vs prev period</span><TrendBadge value={-expenseChange} /></div>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-white/30 uppercase tracking-wider">Net Profit</span>
            <div className={`h-8 w-8 rounded-lg ${profit >= 0 ? "bg-green-500/10" : "bg-red-500/10"} flex items-center justify-center`}>
              {profit >= 0 ? <TrendingUp className="h-4 w-4 text-green-400" /> : <TrendingDown className="h-4 w-4 text-red-400" />}
            </div>
          </div>
          <p className={`text-2xl font-bold ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(profit)}</p>
          <div className="flex items-center justify-between mt-2"><span className="text-xs text-white/20">margin</span><span className="text-xs text-white/30">{revenue > 0 ? pct(profit, revenue) : 0}%</span></div>
        </div>

        <div className={`border rounded-xl p-5 ${overdueAmt > 0 ? "bg-red-500/5 border-red-500/10" : "bg-white/[0.03] border-white/5"}`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs uppercase tracking-wider ${overdueAmt > 0 ? "text-red-400/50" : "text-white/30"}`}>Overdue</span>
            <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-red-400" /></div>
          </div>
          <p className={`text-2xl font-bold ${overdueAmt > 0 ? "text-red-400" : "text-white/20"}`}>{fmt(overdueAmt)}</p>
          <p className="text-xs text-white/20 mt-2">{overdue.length} invoice{overdue.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Monthly Revenue vs Expenses Bar Chart */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-white/30" />
              <h2 className="font-semibold">Monthly Trend</h2>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500"></span>Revenue</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-400"></span>Expenses</span>
            </div>
          </div>
          <div className="flex items-end justify-between gap-3 h-48">
            {monthlyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-1 items-end h-40">
                  <div className="flex-1 rounded-t-md bg-blue-500/80 transition-all duration-500" style={{ height: `${(d.revenue / maxMonthly) * 100}%`, minHeight: d.revenue > 0 ? "4px" : "0" }} title={`Revenue: ${fmt(d.revenue)}`} />
                  <div className="flex-1 rounded-t-md bg-red-400/60 transition-all duration-500" style={{ height: `${(d.expenses / maxMonthly) * 100}%`, minHeight: d.expenses > 0 ? "4px" : "0" }} title={`Expenses: ${fmt(d.expenses)}`} />
                </div>
                <span className="text-[10px] text-white/30">{d.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice Status Breakdown */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="h-4 w-4 text-white/30" />
            <h2 className="font-semibold">Invoice Status</h2>
          </div>

          {/* Visual donut-style */}
          <div className="flex items-center gap-8">
            <div className="relative h-36 w-36 shrink-0">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                {(() => {
                  const entries = [
                    { key: "paid", color: "#22c55e", count: statusCounts.paid },
                    { key: "sent", color: "#3b82f6", count: statusCounts.sent },
                    { key: "draft", color: "#64748b", count: statusCounts.draft },
                    { key: "overdue", color: "#ef4444", count: statusCounts.overdue },
                  ].filter(e => e.count > 0)

                  const total = entries.reduce((s, e) => s + e.count, 0) || 1
                  let offset = 0
                  const circumference = 2 * Math.PI * 40

                  return entries.map((e) => {
                    const pctVal = e.count / total
                    const dashLen = pctVal * circumference
                    const dashGap = circumference - dashLen
                    const el = (
                      <circle key={e.key} cx="50" cy="50" r="40" fill="none" stroke={e.color} strokeWidth="12"
                        strokeDasharray={`${dashLen} ${dashGap}`} strokeDashoffset={-offset} strokeLinecap="round"
                        className="transition-all duration-700" style={{ opacity: 0.85 }}
                      />
                    )
                    offset += dashLen
                    return el
                  })
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{fInv.length}</span>
                <span className="text-[10px] text-white/30">total</span>
              </div>
            </div>

            <div className="flex-1 space-y-3">
              {[
                { label: "Paid", count: statusCounts.paid, color: "bg-green-500", textColor: "text-green-400" },
                { label: "Sent", count: statusCounts.sent, color: "bg-blue-500", textColor: "text-blue-400" },
                { label: "Draft", count: statusCounts.draft, color: "bg-slate-500", textColor: "text-slate-400" },
                { label: "Overdue", count: statusCounts.overdue, color: "bg-red-500", textColor: "text-red-400" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                  <span className="text-sm text-white/50 w-16">{s.label}</span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${s.color} rounded-full transition-all duration-700`} style={{ width: `${pct(s.count, totalInvCount)}%` }} />
                  </div>
                  <span className={`text-sm font-semibold tabular-nums w-8 text-right ${s.textColor}`}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Expenses by Category */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
          <h2 className="font-semibold mb-4">Expenses by Category</h2>
          {sortedCats.length === 0 ? (
            <p className="text-sm text-white/20 py-8 text-center">No expenses recorded</p>
          ) : (
            <div className="space-y-4">
              {sortedCats.map(([cat, amt]) => (
                <div key={cat}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CAT_COLORS[cat] || CAT_COLORS.other }} />
                      <span className="text-white/60 capitalize">{cat.replace("_", " ")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/20 text-xs">{pct(amt, totalExpenses)}%</span>
                      <span className="text-white/40 tabular-nums font-medium">{fmt(amt)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(amt / maxCatAmt) * 100}%`, backgroundColor: CAT_COLORS[cat] || CAT_COLORS.other }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Vendors */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-white/30" />
            <h2 className="font-semibold">Top Vendors</h2>
          </div>
          {topVendors.length === 0 ? (
            <p className="text-sm text-white/20 py-8 text-center">No paid invoices yet</p>
          ) : (
            <div className="space-y-4">
              {topVendors.map((c, i) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-white/15 text-xs font-mono w-4">#{i + 1}</span>
                      <span className="text-white/70 font-medium">{c.name}</span>
                    </div>
                    <span className="text-green-400 tabular-nums font-semibold">{fmt(c.total)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-700" style={{ width: `${(c.total / maxCustRev) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-white/20 w-14 text-right">{c.count} inv</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Aging / Outstanding */}
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-white/30" />
            <h2 className="font-semibold">Outstanding Aging</h2>
          </div>
          <div className="space-y-4">
            {[
              { label: "Current", amount: agingBuckets.current, color: "bg-green-500", textColor: "text-green-400" },
              { label: "1–30 days", amount: agingBuckets["1-30"], color: "bg-yellow-500", textColor: "text-yellow-400" },
              { label: "31–60 days", amount: agingBuckets["31-60"], color: "bg-orange-500", textColor: "text-orange-400" },
              { label: "60+ days", amount: agingBuckets["60+"], color: "bg-red-500", textColor: "text-red-400" },
            ].map(b => {
              const total = pending || 1
              return (
                <div key={b.label} className="flex items-center gap-4">
                  <span className="text-sm text-white/40 w-20">{b.label}</span>
                  <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full ${b.color} rounded-full transition-all duration-700`} style={{ width: `${(b.amount / total) * 100}%`, opacity: 0.7 }} />
                  </div>
                  <span className={`text-sm tabular-nums font-semibold w-24 text-right ${b.amount > 0 ? b.textColor : "text-white/15"}`}>{fmt(b.amount)}</span>
                </div>
              )
            })}
          </div>

          {/* P&L Summary */}
          <div className="mt-6 pt-5 border-t border-white/5">
            <h3 className="text-xs text-white/30 uppercase tracking-wider font-medium mb-3">Profit & Loss</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-white/40">Revenue</span><span className="text-green-400 font-medium tabular-nums">{fmt(revenue)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Expenses</span><span className="text-red-400 font-medium tabular-nums">-{fmt(totalExpenses)}</span></div>
              <div className="flex justify-between border-t border-white/5 pt-2 mt-1">
                <span className="text-white/60 font-medium">Net</span>
                <span className={`font-bold tabular-nums ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>{fmt(profit)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}