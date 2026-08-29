"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/app/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft, Download, Printer, Share2, Loader2,
  CheckCircle, Clock, Send, AlertTriangle, FileText
} from "lucide-react"
import Link from "next/link"

type Invoice = {
  id: string; invoice_number: string; status: string; issue_date: string;
  due_date: string | null; total_amount: number; currency: string; notes: string | null;
  customers: { name: string; email: string | null; phone: string | null; address: string | null; gstin: string | null } | null
}
type LineItem = { id: string; description: string; quantity: number; unit_price: number; total: number }
type Profile = {
  business_name: string | null; owner_name: string | null; email: string | null; phone: string | null;
  address: string | null; city: string | null; state: string | null; pincode: string | null;
  gstin: string | null; pan: string | null; bank_name: string | null; account_name: string | null;
  account_number: string | null; ifsc_code: string | null; upi_id: string | null;
}

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  draft: { icon: FileText, color: "text-white/40", bg: "bg-white/5 border-white/10" },
  sent: { icon: Send, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  paid: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  overdue: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
}

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items, setItems] = useState<LineItem[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fmt = (n: number) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: invoice?.currency || "INR", maximumFractionDigits: 2
  }).format(n || 0)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: inv }, { data: li }, { data: prof }] = await Promise.all([
        supabase.from("invoices").select("*, customers(name, email, phone, address, gstin)").eq("id", id).single(),
        supabase.from("line_items").select("*").eq("invoice_id", id).order("sort_order"),
        supabase.from("profiles").select("*").eq("id", user.id).single(),
      ])

      setInvoice(inv)
      setItems(li ?? [])
      setProfile(prof)
      setLoading(false)
    }
    load()
  }, [id])

  async function updateStatus(status: string) {
    await supabase.from("invoices").update({ status }).eq("id", id)
    setInvoice(prev => prev ? { ...prev, status } : prev)
  }

  function handlePrint() {
    const content = printRef.current
    if (!content) return

    const win = window.open("", "_blank")
    if (!win) return

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${invoice?.invoice_number || "Invoice"}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #e5e7eb; }
          .brand h1 { font-size: 24px; font-weight: 700; color: #111; }
          .brand p { font-size: 12px; color: #666; margin-top: 4px; }
          .invoice-title { text-align: right; }
          .invoice-title h2 { font-size: 28px; font-weight: 800; color: #4f46e5; text-transform: uppercase; letter-spacing: 2px; }
          .invoice-title .inv-number { font-size: 14px; color: #666; margin-top: 4px; }
          .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
          .party-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #999; font-weight: 600; margin-bottom: 8px; }
          .party-name { font-size: 16px; font-weight: 600; color: #111; }
          .party-detail { font-size: 12px; color: #666; margin-top: 2px; }
          .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; padding: 16px; background: #f9fafb; border-radius: 8px; }
          .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 600; }
          .meta-value { font-size: 14px; font-weight: 600; color: #111; margin-top: 4px; }
          .status-paid { color: #16a34a; } .status-sent { color: #2563eb; } .status-draft { color: #666; } .status-overdue { color: #dc2626; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; font-weight: 600; padding: 10px 12px; border-bottom: 2px solid #e5e7eb; }
          th:nth-child(2), th:nth-child(3), th:nth-child(4) { text-align: right; }
          td { padding: 12px; font-size: 13px; border-bottom: 1px solid #f3f4f6; color: #333; }
          td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: right; font-variant-numeric: tabular-nums; }
          .totals { display: flex; justify-content: flex-end; margin-bottom: 32px; }
          .totals-box { width: 280px; }
          .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #666; }
          .totals-row.total { border-top: 2px solid #111; padding-top: 12px; margin-top: 8px; font-size: 18px; font-weight: 700; color: #111; }
          .totals-row .label { font-weight: 500; }
          .bank-section { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; }
          .bank-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #999; font-weight: 600; margin-bottom: 12px; }
          .bank-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .bank-item { font-size: 12px; }
          .bank-label { color: #999; }
          .bank-value { color: #333; font-weight: 500; }
          .notes { margin-top: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; font-size: 12px; color: #666; }
          .notes-title { font-weight: 600; color: #333; margin-bottom: 4px; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #999; padding-top: 16px; border-top: 1px solid #e5e7eb; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `)
    win.document.close()
    setTimeout(() => { win.print() }, 500)
  }

  if (loading) {
    return <div className="p-8 flex items-center justify-center h-full"><Loader2 className="h-6 w-6 text-white/20 animate-spin" /></div>
  }

  if (!invoice) {
    return <div className="p-8 text-center text-white/30">Invoice not found</div>
  }

  const subtotal = items.reduce((s, i) => s + Number(i.total || i.quantity * i.unit_price), 0)
  const taxAmount = Number(invoice.total_amount) - subtotal
  const taxRate = subtotal > 0 ? Math.round((taxAmount / subtotal) * 100) : 18
  const cgst = taxAmount / 2
  const sgst = taxAmount / 2
  const sc = statusConfig[invoice.status] || statusConfig.draft
  const StatusIcon = sc.icon

  return (
    <div className="p-8 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/invoices">
            <button className="h-9 w-9 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{invoice.invoice_number}</h1>
            <p className="text-white/40 text-sm mt-0.5">{invoice.customers?.name || "No customer"}</p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium capitalize ${sc.bg} ${sc.color}`}>
            <StatusIcon className="h-3 w-3" />
            {invoice.status}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Actions */}
          {invoice.status === "draft" && (
            <Button onClick={() => updateStatus("sent")} size="sm" variant="outline" className="border-blue-500/20 text-blue-400 hover:bg-blue-500/10 gap-1.5">
              <Send className="h-3.5 w-3.5" /> Mark Sent
            </Button>
          )}
          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <Button onClick={() => updateStatus("paid")} size="sm" variant="outline" className="border-green-500/20 text-green-400 hover:bg-green-500/10 gap-1.5">
              <CheckCircle className="h-3.5 w-3.5" /> Mark Paid
            </Button>
          )}

          <Button onClick={handlePrint} variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 text-white gap-1.5">
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button onClick={handlePrint} className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 gap-1.5 shadow-lg shadow-blue-500/20">
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Invoice Preview */}
      <div className="bg-white rounded-xl shadow-2xl shadow-black/20 overflow-hidden">
        <div ref={printRef} className="p-10 text-gray-900" style={{ color: "#1a1a1a" }}>
          {/* Header */}
          <div className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px", paddingBottom: "24px", borderBottom: "2px solid #e5e7eb" }}>
            <div className="brand">
              <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#111" }}>
                {profile?.business_name || "Your Business"}
              </h1>
              {profile?.gstin && <p style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>GSTIN: {profile.gstin}</p>}
              {profile?.pan && <p style={{ fontSize: "12px", color: "#666" }}>PAN: {profile.pan}</p>}
              {profile?.phone && <p style={{ fontSize: "12px", color: "#666" }}>{profile.phone}</p>}
              {profile?.email && <p style={{ fontSize: "12px", color: "#666" }}>{profile.email}</p>}
              {(profile?.address || profile?.city) && (
                <p style={{ fontSize: "12px", color: "#666" }}>
                  {[profile.address, profile.city, profile.state, profile.pincode].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <h2 style={{ fontSize: "28px", fontWeight: 800, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "2px" }}>
                Invoice
              </h2>
              <p style={{ fontSize: "14px", color: "#666", marginTop: "4px" }}>{invoice.invoice_number}</p>
            </div>
          </div>

          {/* Bill To + Meta */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginBottom: "32px" }}>
            <div>
              <p style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#999", fontWeight: 600, marginBottom: "8px" }}>Bill To</p>
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#111" }}>{invoice.customers?.name || "—"}</p>
              {invoice.customers?.email && <p style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>{invoice.customers.email}</p>}
              {invoice.customers?.phone && <p style={{ fontSize: "12px", color: "#666" }}>{invoice.customers.phone}</p>}
              {invoice.customers?.address && <p style={{ fontSize: "12px", color: "#666" }}>{invoice.customers.address}</p>}
              {invoice.customers?.gstin && <p style={{ fontSize: "12px", color: "#666" }}>GSTIN: {invoice.customers.gstin}</p>}
            </div>
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <p style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#999", fontWeight: 600 }}>Issue Date</p>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#111", marginTop: "4px" }}>
                    {new Date(invoice.issue_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#999", fontWeight: 600 }}>Due Date</p>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#111", marginTop: "4px" }}>
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#999", fontWeight: 600 }}>Status</p>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: invoice.status === "paid" ? "#16a34a" : invoice.status === "overdue" ? "#dc2626" : "#111", marginTop: "4px", textTransform: "capitalize" }}>
                    {invoice.status}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#999", fontWeight: 600, padding: "10px 12px", borderBottom: "2px solid #e5e7eb" }}>Description</th>
                <th style={{ textAlign: "right", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#999", fontWeight: 600, padding: "10px 12px", borderBottom: "2px solid #e5e7eb" }}>Qty</th>
                <th style={{ textAlign: "right", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#999", fontWeight: 600, padding: "10px 12px", borderBottom: "2px solid #e5e7eb" }}>Rate</th>
                <th style={{ textAlign: "right", fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "#999", fontWeight: 600, padding: "10px 12px", borderBottom: "2px solid #e5e7eb" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding: "12px", fontSize: "13px", borderBottom: "1px solid #f3f4f6", color: "#333" }}>{item.description}</td>
                  <td style={{ padding: "12px", fontSize: "13px", borderBottom: "1px solid #f3f4f6", color: "#333", textAlign: "right" }}>{item.quantity}</td>
                  <td style={{ padding: "12px", fontSize: "13px", borderBottom: "1px solid #f3f4f6", color: "#333", textAlign: "right" }}>{fmt(item.unit_price)}</td>
                  <td style={{ padding: "12px", fontSize: "13px", borderBottom: "1px solid #f3f4f6", color: "#333", textAlign: "right", fontWeight: 500 }}>{fmt(Number(item.total) || item.quantity * item.unit_price)}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "#999", fontSize: "13px" }}>No line items</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "32px" }}>
            <div style={{ width: "280px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px", color: "#666" }}>
                <span>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              {taxAmount > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px", color: "#666" }}>
                    <span>CGST ({taxRate / 2}%)</span><span>{fmt(cgst)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px", color: "#666" }}>
                    <span>SGST ({taxRate / 2}%)</span><span>{fmt(sgst)}</span>
                  </div>
                </>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #111", paddingTop: "12px", marginTop: "8px", fontSize: "18px", fontWeight: 700, color: "#111" }}>
                <span>Total</span><span>{fmt(Number(invoice.total_amount))}</span>
              </div>
            </div>
          </div>

          {/* Bank Details */}
          {(profile?.bank_name || profile?.upi_id) && (
            <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid #e5e7eb" }}>
              <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1.5px", color: "#999", fontWeight: 600, marginBottom: "12px" }}>Payment Details</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
                {profile.bank_name && <div><span style={{ color: "#999" }}>Bank: </span><span style={{ color: "#333", fontWeight: 500 }}>{profile.bank_name}</span></div>}
                {profile.account_name && <div><span style={{ color: "#999" }}>Account Name: </span><span style={{ color: "#333", fontWeight: 500 }}>{profile.account_name}</span></div>}
                {profile.account_number && <div><span style={{ color: "#999" }}>Account No: </span><span style={{ color: "#333", fontWeight: 500 }}>{profile.account_number}</span></div>}
                {profile.ifsc_code && <div><span style={{ color: "#999" }}>IFSC: </span><span style={{ color: "#333", fontWeight: 500 }}>{profile.ifsc_code}</span></div>}
                {profile.upi_id && <div><span style={{ color: "#999" }}>UPI: </span><span style={{ color: "#333", fontWeight: 500 }}>{profile.upi_id}</span></div>}
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div style={{ marginTop: "24px", padding: "16px", background: "#f9fafb", borderRadius: "8px", fontSize: "12px", color: "#666" }}>
              <p style={{ fontWeight: 600, color: "#333", marginBottom: "4px" }}>Notes</p>
              {invoice.notes}
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: "40px", textAlign: "center", fontSize: "11px", color: "#999", paddingTop: "16px", borderTop: "1px solid #e5e7eb" }}>
            Thank you for your business! · Generated by Invoicify
          </div>
        </div>
      </div>
    </div>
  )
}
