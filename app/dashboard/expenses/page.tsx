"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/app/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Loader2, Receipt, IndianRupee } from "lucide-react"

type Expense = {
  id: string
  amount: number
  category: string
  description: string | null
  date: string
  created_at: string
}

const categories = [
  "travel", "food", "office_supplies", "software",
  "marketing", "utilities", "rent", "salaries", "other"
]

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount)
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null)
  const supabase = createClient()

  useEffect(() => { loadExpenses() }, [])

  async function loadExpenses() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
    setExpenses(data ?? [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from("expenses").insert({
      user_id: user.id,
      amount: Number(fd.get("amount")),
      category: fd.get("category") as string,
      description: fd.get("description") as string || null,
      date: fd.get("date") as string || new Date().toISOString().split("T")[0],
    })

    if (error) {
      setMessage({ text: error.message, type: "error" })
    } else {
      setMessage({ text: "Expense added!", type: "success" })
      form.reset()
      await loadExpenses()
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from("expenses").delete().eq("id", id)
    setExpenses(expenses.filter(e => e.id !== id))
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Expenses</h1>
        <p className="text-white/40 text-sm mt-1">{expenses.length} entries · {formatINR(totalExpenses)} total</p>
      </div>

      {/* Add Expense Form */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-6">
        <h2 className="font-semibold mb-5 flex items-center gap-2">
          <Plus className="h-4 w-4 text-blue-400" />
          Add Expense
        </h2>
        {message && (
          <div className={`text-sm p-3 rounded-lg text-center mb-4 ${message.type === "success" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-white/50 text-xs">Amount (₹) *</Label>
            <Input name="amount" type="number" step="0.01" required placeholder="5000" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10" />
          </div>
          <div className="space-y-2">
            <Label className="text-white/50 text-xs">Category *</Label>
            <select name="category" required className="w-full h-10 rounded-md border border-white/10 bg-white/5 text-white px-3 text-sm">
              {categories.map(c => (
                <option key={c} value={c} className="bg-[#0a0a0f]">{c.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-white/50 text-xs">Date</Label>
            <Input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} className="bg-white/5 border-white/10 text-white h-10" />
          </div>
          <div className="space-y-2">
            <Label className="text-white/50 text-xs">Description</Label>
            <Input name="description" placeholder="What was this for?" className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10" />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={saving} className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {saving ? "Saving..." : "Save Expense"}
            </Button>
          </div>
        </form>
      </div>

      {/* Expenses List */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="font-semibold">All Expenses</h2>
        </div>
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="h-6 w-6 text-white/20 mx-auto animate-spin" /></div>
        ) : expenses.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt className="h-8 w-8 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No expenses yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center">
                    <IndianRupee className="h-4 w-4 text-white/30" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{expense.description || expense.category.replace("_", " ")}</p>
                    <p className="text-xs text-white/30">
                      <span className="capitalize">{expense.category.replace("_", " ")}</span> · {new Date(expense.date).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-red-400">-{formatINR(Number(expense.amount))}</p>
                  <button onClick={() => handleDelete(expense.id)} className="text-white/20 hover:text-red-400 transition-colors text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}