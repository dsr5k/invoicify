import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/app/utils/supabase/server"
import {
  FileText,
  LayoutDashboard,
  Users,
  Receipt,
  BarChart3,
  Settings,
  Plus,
  Sparkles,
  Bot,
  CheckSquare,
  CreditCard,
  ClipboardList,
  Landmark,
  ShoppingCart,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/invoices", label: "Invoices", icon: FileText },
  { href: "/dashboard/vendors", label: "Vendors", icon: Users },
  { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
  { href: "/dashboard/payments", label: "Payments", icon: CreditCard },
  { href: "/dashboard/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
  { href: "/dashboard/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/dashboard/gst-compliance", label: "GST Compliance", icon: Landmark },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { href: "/dashboard/automations", label: "Automations", icon: Bot },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/upload", label: "AI Upload", icon: Sparkles },
]

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name")
    .eq("id", user.id)
    .single()

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      {/* Sidebar */}
      <aside className="w-16 md:w-56 shrink-0 border-r border-white/5 flex flex-col bg-[#0a0a0f]">
        {/* Logo */}
        <div className="h-14 px-4 flex items-center border-b border-white/5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold text-lg"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>

            <span className="hidden md:inline">Invoicify</span>
          </Link>
        </div>

        {/* New Invoice */}
        <div className="px-4 py-4">
          <Link href="/dashboard/invoices/new">
            <Button className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 h-9 text-sm gap-2">
              <Plus className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">New Invoice</span>
            </Button>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 md:px-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-center md:justify-start gap-3 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Business Profile */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold">
              {(profile?.business_name ?? user.email ?? "U")[0].toUpperCase()}
            </div>

            <div className="hidden md:block flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {profile?.business_name ?? "My Business"}
              </p>

              <p className="text-xs text-white/30 truncate">
                {user.email}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
