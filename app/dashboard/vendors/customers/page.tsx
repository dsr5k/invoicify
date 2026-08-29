"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/app/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Users, Plus, Trash2, FileText, Phone, Mail, Loader2 } from "lucide-react"
import Link from "next/link"

type Vendor = {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  gstin: string | null
  created_at: string
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null)
  const supabase = createClient()

  // Load vendors
  useEffect(() => {
    loadVendors()
  }, [])

  async function loadVendors() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("vendors")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    setVendors(data ?? [])
    setLoading(false)
  }

  // Add vendor
  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const form = e.currentTarget
    const formData = new FormData(form)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from("vendors").insert({
      user_id: user.id,
      name: formData.get("name") as string,
      email: formData.get("email") as string || null,
      phone: formData.get("phone") as string || null,
      address: formData.get("address") as string || null,
      gstin: formData.get("gstin") as string || null,
    })

    if (error) {
      setMessage({ text: error.message, type: "error" })
    } else {
      setMessage({ text: "Vendor added!", type: "success" })
      form.reset()
      await loadVendors()
    }
    setSaving(false)
  }

  // Delete vendor
  async function handleDelete(id: string) {
    const { error } = await supabase.from("vendors").delete().eq("id", id)
    if (!error) {
      setVendors(vendors.filter(c => c.id !== id))
    }
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Vendors</h1>
        <p className="text-white/40 text-sm mt-1">{vendors.length} total clients</p>
      </div>

      {/* Add Vendor Form */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
        <h2 className="font-semibold mb-5 flex items-center gap-2">
          <Plus className="h-4 w-4 text-blue-400" />
          Add New Vendor
        </h2>

        {message && (
          <div className={`text-sm p-3 rounded-lg text-center mb-4 ${
            message.type === "success"
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-white/50 text-xs">Business / Vendor Name *</Label>
            <Input
              name="name"
              required
              placeholder="Acme Pvt. Ltd."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/50 text-xs">Email</Label>
            <Input
              name="email"
              type="email"
              placeholder="billing@acme.com"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/50 text-xs">Phone</Label>
            <Input
              name="phone"
              placeholder="+91 98765 43210"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-white/50 text-xs">GSTIN</Label>
            <Input
              name="gstin"
              placeholder="22AAAAA0000A1Z5"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label className="text-white/50 text-xs">Address</Label>
            <Input
              name="address"
              placeholder="123, MG Road, Bengaluru, Karnataka - 560001"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10"
            />
          </div>
          <div className="md:col-span-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? "Saving..." : "Save Vendor"}
            </Button>
          </div>
        </form>
      </div>

      {/* Vendors List */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="font-semibold">All Vendors</h2>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="h-6 w-6 text-white/20 mx-auto animate-spin" />
          </div>
        ) : vendors.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="h-8 w-8 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No vendors yet</p>
            <p className="text-white/20 text-xs mt-1">Add your first vendor above</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center text-sm font-bold text-white/60">
                    {vendor.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{vendor.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {vendor.email && (
                        <span className="text-xs text-white/30 flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {vendor.email}
                        </span>
                      )}
                      {vendor.phone && (
                        <span className="text-xs text-white/30 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {vendor.phone}
                        </span>
                      )}
                    </div>
                    {vendor.gstin && (
                      <p className="text-xs text-white/20 mt-0.5">GST: {vendor.gstin}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={`/dashboard/invoices/new?vendor=${vendor.id}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-white/10 bg-white/5 hover:bg-white/10 text-white gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      Invoice
                    </Button>
                  </Link>
                  <button
                    onClick={() => handleDelete(vendor.id)}
                    className="h-8 w-8 rounded-lg border border-white/5 bg-white/5 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 text-white/30 transition-colors flex items-center justify-center"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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