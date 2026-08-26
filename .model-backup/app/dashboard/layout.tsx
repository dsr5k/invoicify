"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/app/utils/supabase/client"
import {
  LayoutDashboard,
  FileText,
  Users,
  Receipt,
  BarChart3,
  Settings,
  Sparkles,
  Menu,
  X,
  Search,
  Plus,
  ChevronDown,
  LogOut,
  CreditCard,
  Bell,
  Command,
} from "lucide-react"

const NAV_SECTIONS = [
  {
    label: "Workspace",
    items: [
      {
        href: "/dashboard",
        label: "Overview",
        icon: LayoutDashboard,
      },
      {
        href: "/dashboard/upload",
        label: "AI Upload",
        icon: Sparkles,
        badge: "AI",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        href: "/dashboard/invoices",
        label: "Invoices",
        icon: FileText,
      },
      {
        href: "/dashboard/expenses",
        label: "Expenses",
        icon: Receipt,
      },
      {
        href: "/dashboard/customers",
        label: "Customers",
        icon: Users,
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        href: "/dashboard/reports",
        label: "Reports",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        href: "/dashboard/settings",
        label: "Settings",
        icon: Settings,
      },
    ],
  },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [email, setEmail] = useState("")

  const supabase = createClient()

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/login")
        return
      }

      setEmail(user.email || "")

      const { data } = await supabase
        .from("profiles")
        .select("business_name, owner_name")
        .eq("id", user.id)
        .single()

      if (data) {
        setProfile(data)
      }
    }

    loadUser()
  }, [router, supabase])

  useEffect(() => {
    setSidebarOpen(false)
    setUserMenu(false)
  }, [pathname])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        // Search command will be connected later.
      }

      if (e.key === "Escape") {
        setSidebarOpen(false)
        setUserMenu(false)
      }
    }

    window.addEventListener("keydown", handleKey)

    return () => {
      window.removeEventListener("keydown", handleKey)
    }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/")
  }

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }

    return pathname.startsWith(href)
  }

  function getPageName() {
    if (pathname === "/dashboard") {
      return "Overview"
    }

    const page = pathname.split("/").filter(Boolean).pop()

    if (!page) {
      return "Dashboard"
    }

    return page
      .replace(/-/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  }

  const displayName =
    profile?.business_name ||
    profile?.owner_name ||
    "My Business"

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((word: string) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <button
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`
          fixed lg:relative z-50
          flex h-full w-64 flex-col
          border-r border-white/[0.07]
          bg-[#0d1118]/95
          backdrop-blur-2xl
          shadow-[12px_0_40px_rgba(0,0,0,0.12)]
          transition-transform duration-300
          ease-[cubic-bezier(0.22,1,0.36,1)]
          ${sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        {/* Logo */}
        <div className="relative flex h-16 items-center justify-between border-b border-white/[0.06] px-5">
          <Link
            href="/dashboard"
            className="group flex items-center gap-3"
          >
            <div
              className="
                relative flex h-9 w-9 items-center justify-center
                overflow-hidden rounded-xl
                border border-white/[0.14]
                bg-gradient-to-br
                from-indigo-400
                via-indigo-500
                to-violet-700
                shadow-[0_8px_24px_rgba(79,70,229,0.30)]
                transition-all duration-300
                group-hover:-translate-y-0.5
                group-hover:shadow-[0_12px_30px_rgba(79,70,229,0.42)]
              "
            >
              <div className="absolute inset-x-0 top-0 h-px bg-white/40" />

              <FileText className="relative h-4 w-4 text-white" />
            </div>

            <div className="flex flex-col">
              <span className="text-[16px] font-semibold tracking-[-0.03em] text-white">
                Ozio
              </span>

              <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/25">
                Finance OS
              </span>
            </div>
          </Link>

          <button
            onClick={() => setSidebarOpen(false)}
            className="
              flex h-8 w-8 items-center justify-center
              rounded-lg text-white/30
              transition-colors
              hover:bg-white/[0.05]
              hover:text-white/70
              lg:hidden
            "
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Primary action */}
        <div className="px-4 pb-2 pt-5">
          <Link href="/dashboard/invoices/new">
            <button
              className="
                group relative flex w-full items-center gap-2.5
                overflow-hidden rounded-xl
                border border-indigo-400/20
                bg-gradient-to-b from-indigo-500 to-indigo-600
                px-3.5 py-2.5
                text-sm font-semibold text-white
                shadow-[0_8px_24px_rgba(79,70,229,0.20)]
                transition-all duration-200
                hover:-translate-y-0.5
                hover:from-indigo-400
                hover:to-indigo-600
                hover:shadow-[0_12px_30px_rgba(79,70,229,0.35)]
                active:translate-y-0
              "
            >
              <div className="absolute inset-x-0 top-0 h-px bg-white/25" />

              <Plus className="relative h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />

              <span className="relative">
                New Invoice
              </span>
            </button>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-6">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                <div className="mb-2 px-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/20">
                    {section.label}
                  </p>
                </div>

                <div className="space-y-1">
                  {section.items.map((item) => {
                    const active = isActive(item.href)
                    const Icon = item.icon

                    return (
                      <Link key={item.href} href={item.href}>
                        <div
                          className={`
                            group relative flex items-center gap-3
                            overflow-hidden rounded-xl
                            px-3 py-2.5
                            text-[13px] font-medium
                            transition-all duration-200
                            ${
                              active
                                ? `
                                  border border-white/[0.07]
                                  bg-gradient-to-r
                                  from-indigo-500/[0.14]
                                  via-indigo-500/[0.07]
                                  to-transparent
                                  text-white
                                  shadow-[0_4px_14px_rgba(0,0,0,0.10)]
                                `
                                : `
                                  border border-transparent
                                  text-white/40
                                  hover:bg-white/[0.045]
                                  hover:text-white/75
                                `
                            }
                          `}
                        >
                          {/* Active indicator */}
                          {active && (
                            <>
                              <div
                                className="
                                  absolute left-0 top-1/2
                                  h-5 w-[3px]
                                  -translate-y-1/2
                                  rounded-r-full
                                  bg-indigo-400
                                  shadow-[0_0_12px_rgba(129,140,248,0.8)]
                                "
                              />

                              <div className="absolute inset-y-0 left-0 w-20 bg-indigo-400/[0.04] blur-xl" />
                            </>
                          )}

                          <div
                            className={`
                              relative flex h-7 w-7
                              items-center justify-center
                              rounded-lg
                              transition-all duration-200
                              ${
                                active
                                  ? `
                                    bg-indigo-400/[0.10]
                                    text-indigo-300
                                    shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]
                                  `
                                  : `
                                    text-white/25
                                    group-hover:bg-white/[0.04]
                                    group-hover:text-white/50
                                  `
                              }
                            `}
                          >
                            <Icon className="h-[15px] w-[15px]" />
                          </div>

                          <span className="relative">
                            {item.label}
                          </span>

                          {item.badge && (
                            <span
                              className="
                                relative ml-auto
                                rounded-md
                                border border-violet-400/10
                                bg-violet-400/[0.08]
                                px-1.5 py-0.5
                                text-[8px] font-bold
                                uppercase tracking-[0.12em]
                                text-violet-300
                              "
                            >
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
          </div>
        </nav>

        {/* User area */}
        <div className="border-t border-white/[0.06] p-3">
          <div className="relative">
            <button
              onClick={() => setUserMenu(!userMenu)}
              className="
                group flex w-full items-center gap-3
                rounded-xl border border-transparent
                px-2.5 py-2.5
                transition-all duration-200
                hover:border-white/[0.06]
                hover:bg-white/[0.035]
              "
            >
              <div
                className="
                  relative flex h-9 w-9 shrink-0
                  items-center justify-center
                  rounded-xl
                  border border-indigo-400/[0.16]
                  bg-gradient-to-br
                  from-indigo-500/[0.22]
                  to-violet-500/[0.12]
                  text-xs font-bold text-indigo-100
                  shadow-[0_4px_14px_rgba(0,0,0,0.12)]
                "
              >
                <div className="absolute inset-x-1 top-0 h-px bg-white/15" />
                {initials}
              </div>

              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[12px] font-semibold text-white/80">
                  {displayName}
                </p>

                <p className="mt-0.5 truncate text-[10px] text-white/28">
                  {email}
                </p>
              </div>

              <ChevronDown
                className={`
                  h-4 w-4 shrink-0 text-white/25
                  transition-transform duration-200
                  ${userMenu ? "rotate-180" : ""}
                `}
              />
            </button>

            {/* User dropdown */}
            {userMenu && (
              <div
                className="
                  absolute bottom-full left-0 right-0 z-50 mb-2
                  overflow-hidden rounded-2xl
                  border border-white/[0.09]
                  bg-[#171b24]/98
                  p-1.5
                  shadow-[0_20px_60px_rgba(0,0,0,0.45)]
                  backdrop-blur-2xl
                "
              >
                <Link
                  href="/dashboard/settings"
                  onClick={() => setUserMenu(false)}
                  className="
                    flex items-center gap-3 rounded-xl
                    px-3 py-2.5
                    text-[12px] font-medium text-white/50
                    transition-colors
                    hover:bg-white/[0.06]
                    hover:text-white/90
                  "
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>

                <Link
                  href="/dashboard/settings"
                  onClick={() => setUserMenu(false)}
                  className="
                    flex items-center gap-3 rounded-xl
                    px-3 py-2.5
                    text-[12px] font-medium text-white/50
                    transition-colors
                    hover:bg-white/[0.06]
                    hover:text-white/90
                  "
                >
                  <CreditCard className="h-4 w-4" />
                  Billing
                </Link>

                <div className="my-1 border-t border-white/[0.06]" />

                <button
                  onClick={handleSignOut}
                  className="
                    flex w-full items-center gap-3 rounded-xl
                    px-3 py-2.5
                    text-[12px] font-medium text-red-400/70
                    transition-colors
                    hover:bg-red-500/[0.07]
                    hover:text-red-300
                  "
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* =====================================================
          MAIN APPLICATION AREA
      ===================================================== */}

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Ambient background depth */}
        <div
          className="
            pointer-events-none absolute inset-0 overflow-hidden
          "
        >
          <div
            className="
              absolute -top-48 left-1/2
              h-[32rem] w-[32rem]
              -translate-x-1/2
              rounded-full
              bg-indigo-500/[0.035]
              blur-[120px]
            "
          />
        </div>

        {/* Header */}
        <header
          className="
            relative z-30 flex h-16 shrink-0
            items-center justify-between
            border-b border-white/[0.06]
            bg-[#10141c]/75
            px-4 backdrop-blur-2xl
            sm:px-6
          "
        >
          {/* Left */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="
                flex h-9 w-9 items-center justify-center
                rounded-xl border border-white/[0.06]
                bg-white/[0.025]
                text-white/40
                transition-all duration-200
                hover:bg-white/[0.06]
                hover:text-white/80
                lg:hidden
              "
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="hidden items-center gap-2 text-sm sm:flex">
              <span className="text-white/25">
                Workspace
              </span>

              <span className="text-white/10">
                /
              </span>

              <span className="font-medium text-white/70">
                {getPageName()}
              </span>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <button
              className="
                hidden min-w-[220px] items-center gap-2.5
                rounded-xl border border-white/[0.07]
                bg-white/[0.025]
                px-3 py-2
                text-left text-[12px] text-white/30
                transition-all duration-200
                hover:border-white/[0.10]
                hover:bg-white/[0.045]
                hover:text-white/50
                md:flex
              "
            >
              <Search className="h-3.5 w-3.5" />

              <span>
                Search workspace...
              </span>

              <kbd
                className="
                  ml-auto flex items-center gap-1
                  rounded-md border border-white/[0.07]
                  bg-white/[0.025]
                  px-1.5 py-0.5
                  font-mono text-[9px] text-white/25
                "
              >
                <Command className="h-2.5 w-2.5" />
                K
              </kbd>
            </button>

            {/* Notifications */}
            <button
              className="
                relative flex h-9 w-9
                items-center justify-center
                rounded-xl border border-transparent
                text-white/30
                transition-all duration-200
                hover:border-white/[0.06]
                hover:bg-white/[0.045]
                hover:text-white/70
              "
            >
              <Bell className="h-4 w-4" />

              <span
                className="
                  absolute right-[9px] top-[8px]
                  h-1.5 w-1.5
                  rounded-full
                  border border-[#10141c]
                  bg-indigo-400
                  shadow-[0_0_8px_rgba(129,140,248,0.9)]
                "
              />
            </button>

            {/* Primary action */}
            <Link href="/dashboard/invoices/new">
              <button
                className="
                  hidden items-center gap-2
                  rounded-xl border border-indigo-400/15
                  bg-indigo-500
                  px-3.5 py-2
                  text-[12px] font-semibold text-white
                  shadow-[0_6px_20px_rgba(79,70,229,0.20)]
                  transition-all duration-200
                  hover:-translate-y-0.5
                  hover:bg-indigo-400
                  hover:shadow-[0_10px_28px_rgba(79,70,229,0.30)]
                  sm:flex
                "
              >
                <Plus className="h-3.5 w-3.5" />
                New Invoice
              </button>
            </Link>
          </div>
        </header>

        {/* =====================================================
            PAGE CONTENT
        ===================================================== */}

        <main className="relative z-10 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}