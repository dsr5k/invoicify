"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/app/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Loader2, Save, Building2, MapPin, Receipt, CreditCard,
  Download, LogOut, Shield, Bell, FileText, ChevronRight, Check
} from "lucide-react"

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activeTab, setActiveTab] = useState("business")
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null)
  const [stats, setStats] = useState({ invoices: 0, customers: 0, expenses: 0 })

  const [form, setForm] = useState({
    business_name: "", owner_name: "", email: "", phone: "",
    address: "", city: "", state: "", pincode: "",
    gstin: "", pan: "",
    bank_name: "", account_name: "", account_number: "", ifsc_code: "", upi_id: "",
    invoice_prefix: "INV", default_tax_rate: "18", default_currency: "INR",
    payment_terms: "30", invoice_notes: "",
  })

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load profile
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      if (profile) {
        setForm(prev => ({
          ...prev,
          business_name: profile.business_name || "",
          owner_name: profile.owner_name || "",
          email: profile.email || user.email || "",
          phone: profile.phone || "",
          address: profile.address || "",
          city: profile.city || "",
          state: profile.state || "",
          pincode: profile.pincode || "",
          gstin: profile.gstin || "",
          pan: profile.pan || "",
          bank_name: profile.bank_name || "",
          account_name: profile.account_name || "",
          account_number: profile.account_number || "",
          ifsc_code: profile.ifsc_code || "",
          upi_id: profile.upi_id || "",
          invoice_prefix: profile.invoice_prefix || "INV",
          default_tax_rate: String(profile.default_tax_rate ?? "18"),
          default_currency: profile.default_currency || "INR",
          payment_terms: String(profile.payment_terms ?? "30"),
          invoice_notes: profile.invoice_notes || "",
        }))
      }

      // Load stats
      const [{ count: ic }, { count: cc }, { count: ec }] = await Promise.all([
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("customers").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("expenses").select("*", { count: "exact", head: true }).eq("user_id", user.id),
      ])
      setStats({ invoices: ic ?? 0, customers: cc ?? 0, expenses: ec ?? 0 })

      setLoading(false)
    }
    load()
  }, [])

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from("profiles").update({
      business_name: form.business_name || null,
      owner_name: form.owner_name || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      pincode: form.pincode || null,
      gstin: form.gstin || null,
      pan: form.pan || null,
      bank_name: form.bank_name || null,
      account_name: form.account_name || null,
      account_number: form.account_number || null,
      ifsc_code: form.ifsc_code || null,
      upi_id: form.upi_id || null,
      invoice_prefix: form.invoice_prefix || "INV",
      default_tax_rate: Number(form.default_tax_rate) || 18,
      default_currency: form.default_currency || "INR",
      payment_terms: Number(form.payment_terms) || 30,
      invoice_notes: form.invoice_notes || null,
    }).eq("id", user.id)

    if (error) setMessage({ text: error.message, type: "error" })
    else setMessage({ text: "Settings saved successfully!", type: "success" })
    setSaving(false)
    setTimeout(() => setMessage(null), 3000)
  }

  async function exportData(type: "invoices" | "customers" | "expenses") {
    setExporting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let query
    if (type === "invoices") {
      query = supabase.from("invoices").select("invoice_number, status, issue_date, due_date, total_amount, currency, notes, created_at").eq("user_id", user.id)
    } else if (type === "customers") {
      query = supabase.from("customers").select("name, email, phone, address, created_at").eq("user_id", user.id)
    } else {
      query = supabase.from("expenses").select("amount, category, description, date, created_at").eq("user_id", user.id)
    }

    const { data } = await query
    if (!data || data.length === 0) {
      setMessage({ text: `No ${type} data to export`, type: "error" })
      setExporting(false)
      return
    }

    // Convert to CSV
    const headers = Object.keys(data[0]).join(",")
    const rows = data.map(row => Object.values(row).map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    const csv = [headers, ...rows].join("\n")

    // Download
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ozio_${type}_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)

    setMessage({ text: `${type} exported successfully!`, type: "success" })
    setExporting(false)
    setTimeout(() => setMessage(null), 3000)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/")
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 text-white/20 animate-spin" />
      </div>
    )
  }

  const tabs = [
    { id: "business", label: "Business", icon: Building2 },
    { id: "address", label: "Address", icon: MapPin },
    { id: "tax", label: "Tax & GST", icon: Receipt },
    { id: "bank", label: "Bank Details", icon: CreditCard },
    { id: "invoicing", label: "Invoicing", icon: FileText },
    { id: "data", label: "Data & Export", icon: Download },
    { id: "account", label: "Account", icon: Shield },
  ]

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-white/40 text-sm mt-1">Manage your business profile and preferences</p>
      </div>

      {/* Toast */}
      {message && (
        <div className={`text-sm p-3 rounded-lg flex items-center gap-2 justify-center transition-all ${
          message.type === "success"
            ? "bg-green-500/10 border border-green-500/20 text-green-400"
            : "bg-red-500/10 border border-red-500/20 text-red-400"
        }`}>
          {message.type === "success" && <Check className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="lg:w-56 shrink-0">
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-2 space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/40 hover:text-white/60 hover:bg-white/5"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {activeTab === tab.id && <ChevronRight className="h-3 w-3 ml-auto" />}
              </button>
            ))}
          </div>

          {/* Quick Stats */}
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 mt-4 space-y-3">
            <p className="text-xs text-white/30 uppercase tracking-wider font-medium">Your Data</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Invoices</span>
                <span className="text-white font-medium">{stats.invoices}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Customers</span>
                <span className="text-white font-medium">{stats.customers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Expenses</span>
                <span className="text-white font-medium">{stats.expenses}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6">

          {/* Business Info */}
          {activeTab === "business" && (
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="font-semibold text-white">Business Information</h2>
                <p className="text-white/30 text-xs mt-1">This info appears on your invoices</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">Business Name</Label>
                  <Input value={form.business_name} onChange={e => update("business_name", e.target.value)} placeholder="Acme Pvt. Ltd." className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 focus:border-violet-500/50 focus:ring-violet-500/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">Owner Name</Label>
                  <Input value={form.owner_name} onChange={e => update("owner_name", e.target.value)} placeholder="Your Name" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 focus:border-violet-500/50 focus:ring-violet-500/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">Email</Label>
                  <Input value={form.email} onChange={e => update("email", e.target.value)} type="email" className="bg-white/5 border-white/10 text-white h-10 focus:border-violet-500/50 focus:ring-violet-500/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">Phone</Label>
                  <Input value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="+91 98765 43210" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 focus:border-violet-500/50 focus:ring-violet-500/20" />
                </div>
              </div>
            </div>
          )}

          {/* Address */}
          {activeTab === "address" && (
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="font-semibold text-white">Business Address</h2>
                <p className="text-white/30 text-xs mt-1">Printed on invoices and receipts</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-white/50 text-xs">Street Address</Label>
                  <Input value={form.address} onChange={e => update("address", e.target.value)} placeholder="123, MG Road" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 focus:border-violet-500/50 focus:ring-violet-500/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">City</Label>
                  <Input value={form.city} onChange={e => update("city", e.target.value)} placeholder="Bengaluru" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 focus:border-violet-500/50 focus:ring-violet-500/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">State</Label>
                  <Input value={form.state} onChange={e => update("state", e.target.value)} placeholder="Karnataka" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 focus:border-violet-500/50 focus:ring-violet-500/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">Pincode</Label>
                  <Input value={form.pincode} onChange={e => update("pincode", e.target.value)} placeholder="560001" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 focus:border-violet-500/50 focus:ring-violet-500/20" />
                </div>
              </div>
            </div>
          )}

          {/* Tax */}
          {activeTab === "tax" && (
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="font-semibold text-white">Tax Information</h2>
                <p className="text-white/30 text-xs mt-1">GST and PAN details for compliance</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">GSTIN</Label>
                  <Input value={form.gstin} onChange={e => update("gstin", e.target.value)} placeholder="22AAAAA0000A1Z5" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 font-mono focus:border-violet-500/50 focus:ring-violet-500/20" />
                  <p className="text-white/20 text-xs">15-digit GST Identification Number</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">PAN</Label>
                  <Input value={form.pan} onChange={e => update("pan", e.target.value)} placeholder="ABCDE1234F" maxLength={10} className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 font-mono uppercase focus:border-violet-500/50 focus:ring-violet-500/20" />
                  <p className="text-white/20 text-xs">Permanent Account Number</p>
                </div>
              </div>
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3">
                <p className="text-xs text-blue-400">💡 Your GSTIN and PAN will automatically appear on all invoices you generate.</p>
              </div>
            </div>
          )}

          {/* Bank Details */}
          {activeTab === "bank" && (
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="font-semibold text-white">Bank Account Details</h2>
                <p className="text-white/30 text-xs mt-1">Shown on invoices for payment collection</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">Bank Name</Label>
                  <Input value={form.bank_name} onChange={e => update("bank_name", e.target.value)} placeholder="State Bank of India" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 focus:border-violet-500/50 focus:ring-violet-500/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">Account Holder Name</Label>
                  <Input value={form.account_name} onChange={e => update("account_name", e.target.value)} placeholder="Acme Pvt. Ltd." className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 focus:border-violet-500/50 focus:ring-violet-500/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">Account Number</Label>
                  <Input value={form.account_number} onChange={e => update("account_number", e.target.value)} placeholder="1234567890" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 font-mono focus:border-violet-500/50 focus:ring-violet-500/20" />
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">IFSC Code</Label>
                  <Input value={form.ifsc_code} onChange={e => update("ifsc_code", e.target.value)} placeholder="SBIN0001234" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 font-mono uppercase focus:border-violet-500/50 focus:ring-violet-500/20" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-white/50 text-xs">UPI ID</Label>
                  <Input value={form.upi_id} onChange={e => update("upi_id", e.target.value)} placeholder="business@upi" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 focus:border-violet-500/50 focus:ring-violet-500/20" />
                </div>
              </div>
            </div>
          )}

          {/* Invoicing Preferences */}
          {activeTab === "invoicing" && (
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="font-semibold text-white">Invoice Defaults</h2>
                <p className="text-white/30 text-xs mt-1">Pre-fill these values when creating invoices</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">Invoice Number Prefix</Label>
                  <Input value={form.invoice_prefix} onChange={e => update("invoice_prefix", e.target.value)} placeholder="INV" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 font-mono focus:border-violet-500/50 focus:ring-violet-500/20" />
                  <p className="text-white/20 text-xs">e.g. {form.invoice_prefix || "INV"}-0001</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">Default GST Rate (%)</Label>
                  <select value={form.default_tax_rate} onChange={e => update("default_tax_rate", e.target.value)} className="w-full h-10 rounded-md border border-white/10 bg-white/5 text-white px-3 text-sm focus:border-violet-500/50">
                    {["0", "5", "12", "18", "28"].map(r => (
                      <option key={r} value={r} className="bg-[#0a0a0f]">{r}%</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">Default Currency</Label>
                  <select value={form.default_currency} onChange={e => update("default_currency", e.target.value)} className="w-full h-10 rounded-md border border-white/10 bg-white/5 text-white px-3 text-sm focus:border-violet-500/50">
                    {[["INR", "₹ Indian Rupee"], ["USD", "$ US Dollar"], ["EUR", "€ Euro"], ["GBP", "£ British Pound"]].map(([code, label]) => (
                      <option key={code} value={code} className="bg-[#0a0a0f]">{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/50 text-xs">Payment Terms (days)</Label>
                  <select value={form.payment_terms} onChange={e => update("payment_terms", e.target.value)} className="w-full h-10 rounded-md border border-white/10 bg-white/5 text-white px-3 text-sm focus:border-violet-500/50">
                    {["7", "15", "30", "45", "60", "90"].map(d => (
                      <option key={d} value={d} className="bg-[#0a0a0f]">Net {d} days</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-white/50 text-xs">Default Invoice Notes</Label>
                  <textarea
                    value={form.invoice_notes}
                    onChange={e => update("invoice_notes", e.target.value)}
                    placeholder="Thank you for your business! Payment is due within the specified terms."
                    rows={3}
                    className="w-full rounded-md border border-white/10 bg-white/5 text-white placeholder:text-white/20 px-3 py-2 text-sm resize-none focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Data & Export */}
          {activeTab === "data" && (
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 space-y-5">
                <div>
                  <h2 className="font-semibold text-white">Export Your Data</h2>
                  <p className="text-white/30 text-xs mt-1">Download your data as CSV files</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => exportData("invoices")}
                    disabled={exporting}
                    className="flex items-center gap-3 p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Invoices</p>
                      <p className="text-xs text-white/30">{stats.invoices} records</p>
                    </div>
                    <Download className="h-4 w-4 text-white/20 ml-auto" />
                  </button>

                  <button
                    onClick={() => exportData("customers")}
                    disabled={exporting}
                    className="flex items-center gap-3 p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Customers</p>
                      <p className="text-xs text-white/30">{stats.customers} records</p>
                    </div>
                    <Download className="h-4 w-4 text-white/20 ml-auto" />
                  </button>

                  <button
                    onClick={() => exportData("expenses")}
                    disabled={exporting}
                    className="flex items-center gap-3 p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Receipt className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Expenses</p>
                      <p className="text-xs text-white/30">{stats.expenses} records</p>
                    </div>
                    <Download className="h-4 w-4 text-white/20 ml-auto" />
                  </button>
                </div>
                {exporting && (
                  <div className="flex items-center gap-2 text-sm text-yellow-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Exporting...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Account */}
          {activeTab === "account" && (
            <div className="space-y-4">
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6 space-y-4">
                <div>
                  <h2 className="font-semibold text-white">Account</h2>
                  <p className="text-white/30 text-xs mt-1">Manage your account and session</p>
                </div>
                <div className="flex items-center gap-4 bg-white/[0.02] rounded-lg p-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center text-lg font-bold text-white/60">
                    {form.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <p className="font-medium text-white">{form.owner_name || form.business_name || "User"}</p>
                    <p className="text-sm text-white/40">{form.email}</p>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-6 space-y-4">
                <div>
                  <h2 className="font-semibold text-red-400">Danger Zone</h2>
                  <p className="text-white/30 text-xs mt-1">Irreversible actions</p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Sign out</p>
                    <p className="text-xs text-white/30">End your current session</p>
                  </div>
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Save Button — always visible except on data/account tabs */}
          {!["data", "account"].includes(activeTab) && (
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 gap-2 shadow-lg shadow-blue-500/20 px-6"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}