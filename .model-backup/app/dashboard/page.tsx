import { createClient } from "@/app/utils/supabase/server"
import { redirect } from "next/navigation"
import {
  FileText, Clock, IndianRupee, ArrowUpRight, Plus, Users,
  Sparkles, TrendingUp, AlertTriangle, Receipt, BarChart3
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { signout } from "@/app/auth/action"

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(amount)
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
}

const statusColors: Record<string, string> = {
  paid: "bg-green-500/10 text-green-400 border-green-500/20",
  sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  draft: "bg-white/5 text-white/40 border-white/10",
  overdue: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-white/5 text-white/30 border-white/10",
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [
    { data: invoices },
    { data: customers },
    { data: expenses },
    { data: profile },
  ] = await Promise.all([
    supabase.from("invoices").select("*, customers(name)").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name").eq("user_id", user.id),
    supabase.from("expenses").select("amount, category, date, description").eq("user_id", user.id).order("date", { ascending: false }),
    supabase.from("profiles").select("business_name").eq("id", user.id).single(),
  ])

  const allInvoices = invoices ?? []
  const allExpenses = expenses ?? []
  const allCustomers = customers ?? []

  // Stats
  const totalRevenue = allInvoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total_amount), 0)
  const pendingAmount = allInvoices.filter(i => i.status === "sent" || i.status === "overdue").reduce((s, i) => s + Number(i.total_amount), 0)
  const overdueInvoices = allInvoices.filter(i => i.status === "overdue")
  const overdueAmount = overdueInvoices.reduce((s, i) => s + Number(i.total_amount), 0)
  const totalExpenses = allExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const profit = totalRevenue - totalExpenses

  // This month's stats
  const now = new Date()
  const thisMonth = allInvoices.filter(i => {
    const d = new Date(i.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const thisMonthRevenue = thisMonth.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total_amount), 0)

  // Top expenses by category
  const expByCat: Record<string, number> = {}
  allExpenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + Number(e.amount) })
  const topCategories = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 4)

  const recentInvoices = allInvoices.slice(0, 6)
  const recentExpenses = allExpenses.slice(0, 4)

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening"

  const stats = [
    { label: "Total Revenue", value: formatINR(totalRevenue), icon: IndianRupee, bg: "bg-green-500/10", iconColor: "text-green-400", sub: "From paid invoices", href: "/dashboard/reports" },
    { label: "Pending", value: formatINR(pendingAmount), icon: Clock, bg: "bg-yellow-500/10", iconColor: "text-yellow-400", sub: "Awaiting payment", href: "/dashboard/invoices" },
    { label: "Total Invoices", value: allInvoices.length.toString(), icon: FileText, bg: "bg-blue-500/10", iconColor: "text-blue-400", sub: `${overdueInvoices.length} overdue`, href: "/dashboard/invoices" },
    { label: "Customers", value: allCustomers.length.toString(), icon: Users, bg: "bg-violet-500/10", iconColor: "text-violet-400", sub: "Total clients", href: "/dashboard/customers" },
  ]

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {greeting}{profile?.business_name ? `, ${profile.business_name}` : ""} 👋
          </h1>
          <p className="text-white/40 text-sm mt-1">
            {now.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/upload">
            <Button variant="outline" className="border-violet-500/20 text-violet-400 hover:bg-violet-500/10 gap-2">
              <Sparkles className="h-4 w-4" />
              AI Upload
            </Button>
          </Link>
          <Link href="/dashboard/invoices/new">
            <Button className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 gap-2">
              <Plus className="h-4 w-4" />
              New Invoice
            </Button>
          </Link>
          <form action={signout}>
            <Button type="submit" variant="outline" className="border-white/10 text-white bg-white/5 hover:bg-white/10 text-sm">
              Sign Out
            </Button>
          </form>
        </div>
      </div>

      {/* Overdue Alert */}
      {overdueInvoices.length > 0 && (
        <Link href="/dashboard/invoices" className="block">
          <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4 flex items-center justify-between hover:bg-red-500/10 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-400">
                  {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? "s" : ""} — {formatINR(overdueAmount)}
                </p>
                <p className="text-xs text-red-400/50">Click to view and follow up</p>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 text-red-400/50" />
          </div>
        </Link>
      )}

      {/* Stats Grid — All clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 hover:border-white/10 hover:bg-white/[0.05] transition-all cursor-pointer group">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-white/40">{stat.label}</p>
                <div className={`h-9 w-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
              <p className="text-xs text-white/30 mt-1 flex items-center justify-between">
                {stat.sub}
                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-white/20" />
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Profit Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/dashboard/reports" className="block">
          <div className="bg-gradient-to-r from-blue-600/10 to-violet-600/10 border border-blue-500/10 rounded-xl p-5 hover:border-blue-500/20 transition-all cursor-pointer">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-wider">Net Profit</p>
                <p className={`text-2xl font-bold mt-1 ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>{formatINR(profit)}</p>
                <p className="text-xs text-white/20 mt-1">Revenue − Expenses</p>
              </div>
              <TrendingUp className={`h-8 w-8 ${profit >= 0 ? "text-green-500/20" : "text-red-500/20"}`} />
            </div>
          </div>
        </Link>

        <Link href="/dashboard/reports" className="block">
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all cursor-pointer">
            <p className="text-xs text-white/40 uppercase tracking-wider">This Month</p>
            <p className="text-2xl font-bold mt-1 text-blue-400">{formatINR(thisMonthRevenue)}</p>
            <p className="text-xs text-white/20 mt-1">{thisMonth.length} invoices</p>
          </div>
        </Link>

        <Link href="/dashboard/expenses" className="block">
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-all cursor-pointer">
            <p className="text-xs text-white/40 uppercase tracking-wider">Total Expenses</p>
            <p className="text-2xl font-bold mt-1 text-red-400">{formatINR(totalExpenses)}</p>
            <p className="text-xs text-white/20 mt-1">{allExpenses.length} entries</p>
          </div>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Invoices — 2 cols */}
        <div className="lg:col-span-2 bg-white/[0.03] border border-white/5 rounded-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2 className="font-semibold">Recent Invoices</h2>
            <Link href="/dashboard/invoices">
              <button className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                View all <ArrowUpRight className="h-3 w-3" />
              </button>
            </Link>
          </div>

          {recentInvoices.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="h-8 w-8 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">No invoices yet</p>
              <Link href="/dashboard/invoices/new">
                <Button size="sm" className="mt-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 gap-2">
                  <Plus className="h-3 w-3" /> Create your first invoice
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {recentInvoices.map((invoice: any) => (
                <Link key={invoice.id} href={`/dashboard/invoices/${invoice.id}`}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-white/30" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{invoice.invoice_number}</p>
                      <p className="text-xs text-white/30">
                        {invoice.customers?.name ?? "No customer"} · {timeAgo(invoice.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full border capitalize ${statusColors[invoice.status] ?? statusColors.draft}`}>
                      {invoice.status}
                    </span>
                    <p className="text-sm font-semibold tabular-nums w-24 text-right">
                      {formatINR(Number(invoice.total_amount))}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-sm text-white/50 uppercase tracking-wider">Quick Actions</h2>
            <div className="space-y-2">
              <Link href="/dashboard/invoices/new" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Plus className="h-4 w-4 text-blue-400" />
                </div>
                <span className="text-sm text-white/60 group-hover:text-white transition-colors">Create Invoice</span>
              </Link>
              <Link href="/dashboard/upload" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group">
                <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-violet-400" />
                </div>
                <span className="text-sm text-white/60 group-hover:text-white transition-colors">AI Upload Invoices</span>
              </Link>
              <Link href="/dashboard/customers" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group">
                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-green-400" />
                </div>
                <span className="text-sm text-white/60 group-hover:text-white transition-colors">Add Customer</span>
              </Link>
              <Link href="/dashboard/reports" className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors group">
                <div className="h-8 w-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-yellow-400" />
                </div>
                <span className="text-sm text-white/60 group-hover:text-white transition-colors">View Reports</span>
              </Link>
            </div>
          </div>

          {/* Top Expense Categories */}
          {topCategories.length > 0 && (
            <Link href="/dashboard/expenses" className="block">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-3 hover:border-white/10 transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-sm text-white/50 uppercase tracking-wider">Top Expenses</h2>
                  <ArrowUpRight className="h-3 w-3 text-white/20" />
                </div>
                <div className="space-y-3">
                  {topCategories.map(([cat, total]) => (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-white/50 capitalize">{cat.replace("_", " ")}</span>
                        <span className="text-white/40 tabular-nums">{formatINR(total)}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full"
                          style={{ width: `${(total / (topCategories[0]?.[1] || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Link>
          )}

          {/* Recent Expenses */}
          {recentExpenses.length > 0 && (
            <Link href="/dashboard/expenses" className="block">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-3 hover:border-white/10 transition-all cursor-pointer">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-sm text-white/50 uppercase tracking-wider">Recent Expenses</h2>
                  <ArrowUpRight className="h-3 w-3 text-white/20" />
                </div>
                <div className="space-y-2">
                  {recentExpenses.map((exp: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Receipt className="h-3.5 w-3.5 text-white/20" />
                        <span className="text-white/50 truncate max-w-[140px]">
                          {exp.description || exp.category.replace("_", " ")}
                        </span>
                      </div>
                      <span className="text-red-400 tabular-nums text-xs font-medium">
                        -{formatINR(Number(exp.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}