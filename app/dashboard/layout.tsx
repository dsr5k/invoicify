"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/app/utils/supabase/client"
import {
  LayoutDashboard, FileText, Users, Receipt,
  BarChart3, Settings, Sparkles, Menu, X,
  Search, Plus, ChevronDown, LogOut, CreditCard,
  Bell, Command
} from "lucide-react"

const NAV_SECTIONS = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard/upload", label: "AI Upload", icon: Sparkles, badge: "AI" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/dashboard/invoices", label: "Invoices", icon: FileText },
      { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
      { href: "/dashboard/customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [email, setEmail] = useState("")
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      setEmail(user.email || "")
      const { data } = await supabase.from("profiles").select("business_name, owner_name").eq("id", user.id).single()
      if (data) setProfile(data)
    }
    load()
  }, [])

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // Ctrl+K search shortcut placeholder
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        // Future: open search modal
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/")
  }

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  const displayName = profile?.business_name || profile?.owner_name || "My Business"
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative z-50 h-full flex flex-col
        w-64 bg-[#0c0c10] border-r border-white/[0.06]
        transition-transform duration-300 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-white/[0.04]">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FileText className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight">Ozio</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/30 hover:text-white/60">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Action */}
        <div className="px-3 pt-4 pb-1">
          <Link href="/dashboard/invoices/new">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors shadow-lg shadow-indigo-500/15">
              <Plus className="h-4 w-4" />
              New Invoice
            </button>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/20">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link key={item.href} href={item.href}>
                      <div className={`
                        flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium
                        transition-all duration-150 relative group
                        ${active
                          ? "bg-white/[0.08] text-white"
                          : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                        }
                      `}>
                        {/* Active indicator */}
                        {active && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-indigo-500" />
                        )}
                        <item.icon className={`h-[15px] w-[15px] ${active ? "text-indigo-400" : "text-white/25 group-hover:text-white/40"}`} />
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Section */}
        <div className="border-t border-white/[0.04] p-3">
          <div className="relative">
            <button
              onClick={() => setUserMenu(!userMenu)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-white/[0.06] flex items-center justify-center text-xs font-bold text-white/60">
                {initials}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[13px] font-medium text-white/80 truncate">{displayName}</p>
                <p className="text-[11px] text-white/25 truncate">{email}</p>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-white/20 transition-transform ${userMenu ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown */}
            {userMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#141419] border border-white/[0.08] rounded-xl shadow-xl shadow-black/40 p-1.5 z-50">
                <Link href="/dashboard/settings" onClick={() => setUserMenu(false)}>
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/[0.05] transition-colors">
                    <Settings className="h-4 w-4" />
                    Settings
                  </div>
                </Link>
                <Link href="/dashboard/settings" onClick={() => setUserMenu(false)}>
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/[0.05] transition-colors">
                    <CreditCard className="h-4 w-4" />
                    Billing
                  </div>
                </Link>
                <div className="my-1 border-t border-white/[0.06]" />
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-white/[0.04] bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-30">
          {/* Left: hamburger + breadcrumb */}
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-white/40 hover:text-white">
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-sm">
              <span className="text-white/20">Ozio</span>
              <span className="text-white/10">/</span>
              <span className="text-white/50 font-medium capitalize">
                {pathname === "/dashboard" ? "Overview" : pathname.split("/").pop()?.replace(/-/g, " ") || "Dashboard"}
              </span>
            </div>
          </div>

          {/* Right: search + actions */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-white/25 hover:text-white/40 text-sm transition-colors min-w-[200px]">
              <Search className="h-3.5 w-3.5" />
              <span>Search...</span>
              <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/[0.06] bg-white/[0.03] text-white/20">
                <Command className="h-2.5 w-2.5 inline" />K
              </kbd>
            </button>

            {/* Notification bell */}
            <button className="h-8 w-8 rounded-lg hover:bg-white/[0.05] flex items-center justify-center text-white/25 hover:text-white/50 transition-colors relative">
              <Bell className="h-4 w-4" />
            </button>

            {/* New invoice shortcut */}
            <Link href="/dashboard/invoices/new">
              <button className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}