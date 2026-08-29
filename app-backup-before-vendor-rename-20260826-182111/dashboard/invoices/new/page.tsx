"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/app/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  ReceiptIndianRupee,
  MapPin,
  AlertTriangle,
  Building2,
  CreditCard,
  Printer,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

type Customer = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  state?: string | null
  address?: string | null
}

type Profile = {
  bank_name?: string | null
  account_name?: string | null
  account_number?: string | null
  ifsc_code?: string | null
  upi_id?: string | null
  invoice_prefix?: string | null
  default_tax_rate?: number | null
  default_currency?: string | null
  payment_terms?: number | null
  invoice_notes?: string | null
}

type InvoiceItem = {
  id: string
  description: string
  hsnSac: string
  quantity: number
  unitPrice: number
  discountPercent: number
  gstRate: number
}

const GST_RATES = [0, 5, 12, 18, 28]

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
]

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)
}

function normalizeState(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ")
}

function makeItem(defaultGst = 18): InvoiceItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    hsnSac: "",
    quantity: 1,
    unitPrice: 0,
    discountPercent: 0,
    gstRate: defaultGst,
  }
}

function addDays(dateString: string, days: number) {
  if (!dateString) return ""

  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)

  return date.toISOString().split("T")[0]
}

export default function NewInvoicePage() {
  const supabase = createClient()
  const router = useRouter()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [businessState, setBusinessState] = useState("")
  const [customerState, setCustomerState] = useState("")
  const [placeOfSupply, setPlaceOfSupply] = useState("")

  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  const [dueDate, setDueDate] = useState("")

  const [reverseCharge, setReverseCharge] = useState(false)

  const [notes, setNotes] = useState("")
  const [terms, setTerms] = useState("")

  const [items, setItems] = useState<InvoiceItem[]>([
    makeItem(18),
  ])

  /*
   * ------------------------------------------------------------
   * INITIAL LOAD
   * ------------------------------------------------------------
   */

  useEffect(() => {
    initializePage()
  }, [])

  async function initializePage() {
    setLoading(true)
    setError("")

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("You must be logged in to create an invoice.")
        return
      }

      /*
       * Load profile
       */

      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle()

      if (profileError) {
        console.error("Profile loading error:", profileError)
      }

      const loadedProfile = (profileData as Profile | null) || null

      setProfile(loadedProfile)

      /*
       * Load customers
       */

      const { data: customerData, error: customerError } =
        await supabase
          .from("customers")
          .select("*")
          .eq("user_id", user.id)
          .order("name", { ascending: true })

      if (customerError) {
        console.error("Customer loading error:", customerError)
        throw new Error("Could not load customers.")
      }

      setCustomers((customerData as Customer[]) || [])

      /*
       * Profile defaults
       */

      const defaultGst = Number(
        loadedProfile?.default_tax_rate ?? 18
      )

      const validGst = GST_RATES.includes(defaultGst)
        ? defaultGst
        : 18

      setItems([makeItem(validGst)])

      setNotes(loadedProfile?.invoice_notes || "")

      /*
       * Generate invoice number
       */

      await generateInvoiceNumber(
        loadedProfile?.invoice_prefix || "INV"
      )

      /*
       * Payment terms
       */

      const paymentTerms = Number(
        loadedProfile?.payment_terms ?? 30
      )

      setDueDate(addDays(issueDate, paymentTerms))
    } catch (err: any) {
      console.error("Initialize invoice page error:", err)

      setError(
        err?.message ||
          "Something went wrong while loading the invoice page."
      )
    } finally {
      setLoading(false)
    }
  }

  /*
   * ------------------------------------------------------------
   * INVOICE NUMBER
   * ------------------------------------------------------------
   */

  async function generateInvoiceNumber(prefix = "INV") {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { count, error } = await supabase
      .from("invoices")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("user_id", user.id)

    if (error) {
      console.error("Invoice number error:", error)
      return
    }

    const nextNumber = (count || 0) + 1

    setInvoiceNumber(
      `${prefix}-${new Date().getFullYear()}-${String(
        nextNumber
      ).padStart(4, "0")}`
    )
  }

  /*
   * ------------------------------------------------------------
   * ISSUE DATE / DUE DATE
   * ------------------------------------------------------------
   */

  function handleIssueDateChange(value: string) {
    setIssueDate(value)

    const paymentTerms = Number(
      profile?.payment_terms ?? 30
    )

    setDueDate(addDays(value, paymentTerms))
  }

  /*
   * ------------------------------------------------------------
   * CUSTOMER
   * ------------------------------------------------------------
   */

  function handleCustomerChange(customerId: string) {
    setSelectedCustomerId(customerId)

    const customer = customers.find(
      (item) => item.id === customerId
    )

    if (customer) {
      setCustomerState(customer.state || "")
      setPlaceOfSupply(customer.state || "")
    } else {
      setCustomerState("")
      setPlaceOfSupply("")
    }
  }

  /*
   * ------------------------------------------------------------
   * GST TYPE
   * ------------------------------------------------------------
   */

  const gstType = useMemo(() => {
    if (!businessState || !customerState) {
      return null
    }

    return normalizeState(businessState) ===
      normalizeState(customerState)
      ? "intra"
      : "inter"
  }, [businessState, customerState])

  /*
   * ------------------------------------------------------------
   * SELECTED CUSTOMER
   * ------------------------------------------------------------
   */

  const selectedCustomer = useMemo(() => {
    return customers.find(
      (customer) => customer.id === selectedCustomerId
    )
  }, [customers, selectedCustomerId])

  /*
   * ------------------------------------------------------------
   * ITEM CALCULATIONS
   * ------------------------------------------------------------
   */

  const calculatedItems = useMemo(() => {
    return items.map((item) => {
      const quantity = Math.max(
        0,
        Number(item.quantity) || 0
      )

      const unitPrice = Math.max(
        0,
        Number(item.unitPrice) || 0
      )

      const discountPercent = Math.min(
        100,
        Math.max(0, Number(item.discountPercent) || 0)
      )

      const gstRate = Math.max(
        0,
        Number(item.gstRate) || 0
      )

      const grossAmount = quantity * unitPrice

      const discountAmount =
        grossAmount * (discountPercent / 100)

      const taxableAmount =
        grossAmount - discountAmount

      const gstAmount =
        taxableAmount * (gstRate / 100)

      const totalAmount =
        taxableAmount + gstAmount

      return {
        ...item,
        quantity,
        unitPrice,
        discountPercent,
        gstRate,
        grossAmount,
        discountAmount,
        taxableAmount,
        gstAmount,
        totalAmount,
      }
    })
  }, [items])

  /*
   * ------------------------------------------------------------
   * TOTALS
   * ------------------------------------------------------------
   */

  const grossSubtotal = useMemo(
    () =>
      calculatedItems.reduce(
        (sum, item) => sum + item.grossAmount,
        0
      ),
    [calculatedItems]
  )

  const totalDiscount = useMemo(
    () =>
      calculatedItems.reduce(
        (sum, item) => sum + item.discountAmount,
        0
      ),
    [calculatedItems]
  )

  const subtotal = useMemo(
    () =>
      calculatedItems.reduce(
        (sum, item) => sum + item.taxableAmount,
        0
      ),
    [calculatedItems]
  )

  const totalGst = useMemo(
    () =>
      calculatedItems.reduce(
        (sum, item) => sum + item.gstAmount,
        0
      ),
    [calculatedItems]
  )

  const cgst =
    gstType === "intra"
      ? totalGst / 2
      : 0

  const sgst =
    gstType === "intra"
      ? totalGst / 2
      : 0

  const igst =
    gstType === "inter"
      ? totalGst
      : 0

  const grandTotal = subtotal + totalGst

  /*
   * ------------------------------------------------------------
   * ITEM HELPERS
   * ------------------------------------------------------------
   */

  function updateItem(
    id: string,
    field: keyof InvoiceItem,
    value: string | number
  ) {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== id) {
          return item
        }

        if (
          field === "quantity" ||
          field === "unitPrice" ||
          field === "discountPercent" ||
          field === "gstRate"
        ) {
          return {
            ...item,
            [field]: Number(value),
          }
        }

        return {
          ...item,
          [field]: value,
        }
      })
    )
  }

  function addItem() {
    const defaultGst = Number(
      profile?.default_tax_rate ?? 18
    )

    setItems((current) => [
      ...current,
      makeItem(
        GST_RATES.includes(defaultGst)
          ? defaultGst
          : 18
      ),
    ])
  }

  function removeItem(id: string) {
    setItems((current) => {
      if (current.length === 1) {
        return current
      }

      return current.filter(
        (item) => item.id !== id
      )
    })
  }

  /*
   * ------------------------------------------------------------
   * VALIDATION
   * ------------------------------------------------------------
   */

  function validateInvoice() {
    if (!invoiceNumber.trim()) {
      return "Invoice number is required."
    }

    if (!issueDate) {
      return "Issue date is required."
    }

    if (!selectedCustomerId) {
      return "Please select a customer."
    }

    if (!businessState) {
      return "Please select your business state."
    }

    if (!customerState) {
      return "Please select the customer's state."
    }

    if (!placeOfSupply) {
      return "Please select the place of supply."
    }

    if (!gstType) {
      return "GST type could not be determined."
    }

    if (!items.length) {
      return "Please add at least one invoice item."
    }

    for (let index = 0; index < items.length; index++) {
      const item = items[index]

      if (!item.description.trim()) {
        return `Please enter a description for Item ${
          index + 1
        }.`
      }

      if (
        !Number.isFinite(Number(item.quantity)) ||
        Number(item.quantity) <= 0
      ) {
        return `Quantity for Item ${
          index + 1
        } must be greater than zero.`
      }

      if (
        !Number.isFinite(Number(item.unitPrice)) ||
        Number(item.unitPrice) < 0
      ) {
        return `Unit price for Item ${
          index + 1
        } is invalid.`
      }

      if (
        Number(item.discountPercent) < 0 ||
        Number(item.discountPercent) > 100
      ) {
        return `Discount for Item ${
          index + 1
        } must be between 0% and 100%.`
      }

      if (
        Number(item.gstRate) < 0
      ) {
        return `GST rate for Item ${
          index + 1
        } is invalid.`
      }
    }

    return null
  }

  /*
   * ------------------------------------------------------------
   * SAVE INVOICE
   * ------------------------------------------------------------
   */

  async function saveInvoice() {
    setError("")
    setSuccess("")

    const validationError = validateInvoice()

    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error(
          "You must be logged in to create an invoice."
        )
      }

      const currency =
        profile?.default_currency || "INR"

      /*
       * Calculate average/effective tax rate.
       *
       * The actual GST amount is stored separately and is
       * the authoritative value.
       */

      const effectiveTaxRate =
        subtotal > 0
          ? (totalGst / subtotal) * 100
          : 0

      /*
       * Create invoice
       */

      const { data: invoice, error: invoiceError } =
        await supabase
          .from("invoices")
          .insert({
            user_id: user.id,
            customer_id: selectedCustomerId,

            invoice_number:
              invoiceNumber.trim(),

            status: "draft",

            issue_date: issueDate,
            due_date: dueDate || null,

            subtotal: Number(
              subtotal.toFixed(2)
            ),

            tax_rate: Number(
              effectiveTaxRate.toFixed(2)
            ),

            tax_amount: Number(
              totalGst.toFixed(2)
            ),

            total_amount: Number(
              grandTotal.toFixed(2)
            ),

            currency,

            notes:
              notes.trim() || null,

            terms:
              terms.trim() || null,

            tax_type: gstType,

            cgst_amount: Number(
              cgst.toFixed(2)
            ),

            sgst_amount: Number(
              sgst.toFixed(2)
            ),

            igst_amount: Number(
              igst.toFixed(2)
            ),

            reverse_charge:
              reverseCharge,

            place_of_supply:
              placeOfSupply,

            business_state:
              businessState,

            customer_state:
              customerState,

            gst_type:
              gstType,

            gst_amount: Number(
              totalGst.toFixed(2)
            ),

            discount_amount: Number(
              totalDiscount.toFixed(2)
            ),
          })
          .select("id")
          .single()

      if (invoiceError) {
        console.error(
          "Invoice insert error:",
          invoiceError
        )

        throw new Error(
          invoiceError.message ||
            "Failed to create invoice."
        )
      }

      /*
       * Create invoice items
       */

      const invoiceItems =
        calculatedItems.map((item) => ({
          invoice_id: invoice.id,

          description:
            item.description.trim(),

          hsn_sac:
            item.hsnSac.trim() || null,

          quantity:
            Number(item.quantity),

          unit_price:
            Number(item.unitPrice),

          gst_rate:
            Number(item.gstRate),

          taxable_amount:
            Number(
              item.taxableAmount.toFixed(2)
            ),

          gst_amount:
            Number(
              item.gstAmount.toFixed(2)
            ),

          total_amount:
            Number(
              item.totalAmount.toFixed(2)
            ),

          discount_percent:
            Number(
              item.discountPercent.toFixed(2)
            ),

          discount_amount:
            Number(
              item.discountAmount.toFixed(2)
            ),
        }))

      const { error: itemsError } =
        await supabase
          .from("invoice_items")
          .insert(invoiceItems)

      if (itemsError) {
        console.error(
          "Invoice items insert error:",
          itemsError
        )

        /*
         * Rollback invoice so we don't leave
         * a half-created invoice behind.
         */

        await supabase
          .from("invoices")
          .delete()
          .eq("id", invoice.id)

        throw new Error(
          itemsError.message ||
            "Failed to save invoice items."
        )
      }

      setSuccess(
        "Invoice created successfully."
      )

      setTimeout(() => {
        router.push(
          "/dashboard/invoices"
        )
        router.refresh()
      }, 700)
    } catch (err: any) {
      console.error(
        "Save invoice error:",
        err
      )

      setError(
        err?.message ||
          "Something went wrong while creating the invoice."
      )
    } finally {
      setSaving(false)
    }
  }

  /*
   * ------------------------------------------------------------
   * PRINT / PREVIEW
   * ------------------------------------------------------------
   */

  function handlePrint() {
    window.print()
  }

  /*
   * ------------------------------------------------------------
   * LOADING
   * ------------------------------------------------------------
   */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-7 w-7 animate-spin text-white/30 mx-auto" />

          <p className="text-sm text-white/30 mt-3">
            Loading invoice builder...
          </p>
        </div>
      </div>
    )
  }

  /*
   * ------------------------------------------------------------
   * UI
   * ------------------------------------------------------------
   */

  return (
    <div className="min-h-screen p-6 md:p-8 print:p-0">
      <div className="max-w-7xl mx-auto space-y-6 print:max-w-none">

        {/* HEADER */}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">

          <div className="flex items-center gap-3">

            <Link href="/dashboard/invoices">
              <Button
                variant="ghost"
                size="icon"
                className="text-white/50 hover:text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>

            <div>
              <h1 className="text-2xl font-bold">
                Create Invoice
              </h1>

              <p className="text-sm text-white/40 mt-1">
                Create a GST-compliant invoice
              </p>
            </div>

          </div>

          <div className="flex items-center gap-2">

            <Button
              type="button"
              onClick={handlePrint}
              variant="outline"
              className="border-white/10 bg-white/5 hover:bg-white/10 gap-2"
            >
              <Printer className="h-4 w-4" />
              Preview
            </Button>

            <Button
              onClick={saveInvoice}
              disabled={saving}
              className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Draft
                </>
              )}
            </Button>

          </div>

        </div>

        {/* ERROR */}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-start gap-3 print:hidden">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* SUCCESS */}

        {success && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-300 print:hidden">
            {success}
          </div>
        )}

        {/* BUSINESS / CUSTOMER */}

        <div className="grid lg:grid-cols-2 gap-6">

          {/* INVOICE DETAILS */}

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">

            <div className="flex items-center gap-2">
              <ReceiptIndianRupee className="h-5 w-5 text-violet-400" />

              <h2 className="font-semibold">
                Invoice Details
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">

              <div>
                <label className="block text-xs text-white/40 mb-2">
                  Invoice Number
                </label>

                <input
                  value={invoiceNumber}
                  onChange={(e) =>
                    setInvoiceNumber(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-2">
                  Issue Date
                </label>

                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) =>
                    handleIssueDateChange(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-2">
                  Due Date
                </label>

                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) =>
                    setDueDate(e.target.value)
                  }
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
                />

                <p className="text-[11px] text-white/25 mt-1">
                  Default:{" "}
                  {profile?.payment_terms ?? 30} days
                </p>
              </div>

              <div>
                <label className="block text-xs text-white/40 mb-2">
                  Currency
                </label>

                <div className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm">
                  {profile?.default_currency || "INR"}
                </div>
              </div>

            </div>
          </div>

          {/* CUSTOMER / GST */}

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-5">

            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-400" />

              <h2 className="font-semibold">
                Customer & GST
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">

              {/* BUSINESS STATE */}

              <div>
                <label className="block text-xs text-white/40 mb-2">
                  Business State
                </label>

                <select
                  value={businessState}
                  onChange={(e) =>
                    setBusinessState(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none"
                >
                  <option
                    value=""
                    className="bg-[#0a0a0f]"
                  >
                    Select state
                  </option>

                  {INDIAN_STATES.map(
                    (state) => (
                      <option
                        key={state}
                        value={state}
                        className="bg-[#0a0a0f]"
                      >
                        {state}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* CUSTOMER */}

              <div>
                <label className="block text-xs text-white/40 mb-2">
                  Customer
                </label>

                <select
                  value={selectedCustomerId}
                  onChange={(e) =>
                    handleCustomerChange(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none"
                >
                  <option
                    value=""
                    className="bg-[#0a0a0f]"
                  >
                    Select customer
                  </option>

                  {customers.map(
                    (customer) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                        className="bg-[#0a0a0f]"
                      >
                        {customer.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* CUSTOMER STATE */}

              <div>
                <label className="block text-xs text-white/40 mb-2">
                  Customer State
                </label>

                <select
                  value={customerState}
                  onChange={(e) => {
                    setCustomerState(
                      e.target.value
                    )

                    setPlaceOfSupply(
                      e.target.value
                    )
                  }}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none"
                >
                  <option
                    value=""
                    className="bg-[#0a0a0f]"
                  >
                    Select state
                  </option>

                  {INDIAN_STATES.map(
                    (state) => (
                      <option
                        key={state}
                        value={state}
                        className="bg-[#0a0a0f]"
                      >
                        {state}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* PLACE OF SUPPLY */}

              <div>
                <label className="block text-xs text-white/40 mb-2">
                  Place of Supply
                </label>

                <select
                  value={placeOfSupply}
                  onChange={(e) =>
                    setPlaceOfSupply(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none"
                >
                  <option
                    value=""
                    className="bg-[#0a0a0f]"
                  >
                    Select state
                  </option>

                  {INDIAN_STATES.map(
                    (state) => (
                      <option
                        key={state}
                        value={state}
                        className="bg-[#0a0a0f]"
                      >
                        {state}
                      </option>
                    )
                  )}
                </select>
              </div>

            </div>

            {/* GST TYPE */}

            <div
              className={`rounded-xl border px-4 py-3 ${
                gstType === "intra"
                  ? "border-green-500/20 bg-green-500/10"
                  : gstType === "inter"
                    ? "border-blue-500/20 bg-blue-500/10"
                    : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between gap-4">

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/30">
                    Supply Type
                  </p>

                  <p className="text-sm font-semibold mt-1">
                    {gstType === "intra"
                      ? "Intra-State Supply"
                      : gstType === "inter"
                        ? "Inter-State Supply"
                        : "Select both states"}
                  </p>
                </div>

                <div className="text-right">

                  <p className="text-[10px] uppercase text-white/30">
                    Tax Mode
                  </p>

                  <p className="text-sm font-semibold">
                    {gstType === "intra"
                      ? "CGST + SGST"
                      : gstType === "inter"
                        ? "IGST"
                        : "—"}
                  </p>

                </div>

              </div>
            </div>

            {/* REVERSE CHARGE */}

            <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 cursor-pointer">

              <div>
                <p className="text-sm font-medium">
                  Reverse Charge
                </p>

                <p className="text-xs text-white/30 mt-1">
                  Mark this invoice as subject to reverse charge.
                </p>
              </div>

              <input
                type="checkbox"
                checked={reverseCharge}
                onChange={(e) =>
                  setReverseCharge(
                    e.target.checked
                  )
                }
                className="h-4 w-4 accent-violet-500"
              />

            </label>

          </div>
        </div>

        {/* CUSTOMER INFO */}

        {selectedCustomer && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">

            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-5 w-5 text-violet-400" />

              <h2 className="font-semibold">
                Bill To
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-4">

              <div>
                <p className="text-xs text-white/30">
                  Customer
                </p>

                <p className="text-sm font-medium mt-1">
                  {selectedCustomer.name}
                </p>
              </div>

              <div>
                <p className="text-xs text-white/30">
                  Email
                </p>

                <p className="text-sm text-white/60 mt-1">
                  {selectedCustomer.email || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-white/30">
                  Phone
                </p>

                <p className="text-sm text-white/60 mt-1">
                  {selectedCustomer.phone || "—"}
                </p>
              </div>

              <div className="md:col-span-3">
                <p className="text-xs text-white/30">
                  Address
                </p>

                <p className="text-sm text-white/60 mt-1">
                  {selectedCustomer.address || "—"}
                </p>
              </div>

            </div>
          </div>
        )}

        {/* ITEMS */}

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">

          <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 print:hidden">

            <div>
              <h2 className="font-semibold">
                Invoice Items
              </h2>

              <p className="text-xs text-white/30 mt-1">
                Add every product or service separately.
              </p>
            </div>

            <Button
              onClick={addItem}
              variant="outline"
              className="border-white/10 bg-white/5 hover:bg-white/10 gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </Button>

          </div>

          <div className="p-6 space-y-4">

            {calculatedItems.map(
              (item, index) => (

                <div
                  key={item.id}
                  className="rounded-xl border border-white/10 bg-black/20 p-5"
                >

                  <div className="flex items-center justify-between mb-4">

                    <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                      Item {index + 1}
                    </p>

                    {items.length > 1 && (
                      <button
                        onClick={() =>
                          removeItem(item.id)
                        }
                        className="text-white/20 hover:text-red-400 transition-colors print:hidden"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}

                  </div>

                  <div className="grid md:grid-cols-12 gap-4">

                    {/* DESCRIPTION */}

                    <div className="md:col-span-3">
                      <label className="block text-xs text-white/40 mb-2">
                        Description
                      </label>

                      <input
                        value={item.description}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "description",
                            e.target.value
                          )
                        }
                        placeholder="Product / Service"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
                      />
                    </div>

                    {/* HSN */}

                    <div className="md:col-span-2">
                      <label className="block text-xs text-white/40 mb-2">
                        HSN / SAC
                      </label>

                      <input
                        value={item.hsnSac}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "hsnSac",
                            e.target.value
                          )
                        }
                        placeholder="HSN / SAC"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
                      />
                    </div>

                    {/* QUANTITY */}

                    <div className="md:col-span-1">
                      <label className="block text-xs text-white/40 mb-2">
                        Qty
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "quantity",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none"
                      />
                    </div>

                    {/* PRICE */}

                    <div className="md:col-span-2">
                      <label className="block text-xs text-white/40 mb-2">
                        Unit Price
                      </label>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "unitPrice",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none"
                      />
                    </div>

                    {/* DISCOUNT */}

                    <div className="md:col-span-1">
                      <label className="block text-xs text-white/40 mb-2">
                        Discount
                      </label>

                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={
                            item.discountPercent
                          }
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "discountPercent",
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 pr-7 text-sm outline-none"
                        />

                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 text-xs">
                          %
                        </span>
                      </div>
                    </div>

                    {/* GST */}

                    <div className="md:col-span-1">
                      <label className="block text-xs text-white/40 mb-2">
                        GST
                      </label>

                      <select
                        value={item.gstRate}
                        onChange={(e) =>
                          updateItem(
                            item.id,
                            "gstRate",
                            e.target.value
                          )
                        }
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2.5 text-sm outline-none"
                      >
                        {GST_RATES.map(
                          (rate) => (
                            <option
                              key={rate}
                              value={rate}
                              className="bg-[#0a0a0f]"
                            >
                              {rate}%
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    {/* TOTAL */}

                    <div className="md:col-span-2">
                      <label className="block text-xs text-white/40 mb-2">
                        Total
                      </label>

                      <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-right">
                        {money(
                          item.totalAmount
                        )}
                      </div>
                    </div>

                  </div>

                  {/* ITEM BREAKDOWN */}

                  <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-x-6 gap-y-2 text-xs">

                    <span className="text-white/30">
                      Gross:{" "}
                      <strong className="text-white/70">
                        {money(
                          item.grossAmount
                        )}
                      </strong>
                    </span>

                    <span className="text-white/30">
                      Discount:{" "}
                      <strong className="text-red-400">
                        -{money(
                          item.discountAmount
                        )}
                      </strong>
                    </span>

                    <span className="text-white/30">
                      Taxable:{" "}
                      <strong className="text-white/70">
                        {money(
                          item.taxableAmount
                        )}
                      </strong>
                    </span>

                    <span className="text-white/30">
                      GST:{" "}
                      <strong className="text-white/70">
                        {money(
                          item.gstAmount
                        )}
                      </strong>
                    </span>

                    {gstType === "intra" && (
                      <>
                        <span className="text-white/30">
                          CGST:{" "}
                          <strong className="text-green-400">
                            {money(
                              item.gstAmount /
                                2
                            )}
                          </strong>
                        </span>

                        <span className="text-white/30">
                          SGST:{" "}
                          <strong className="text-green-400">
                            {money(
                              item.gstAmount /
                                2
                            )}
                          </strong>
                        </span>
                      </>
                    )}

                    {gstType === "inter" && (
                      <span className="text-white/30">
                        IGST:{" "}
                        <strong className="text-blue-400">
                          {money(
                            item.gstAmount
                          )}
                        </strong>
                      </span>
                    )}

                  </div>

                </div>
              )
            )}

          </div>
        </div>

        {/* BOTTOM SECTION */}

        <div className="grid lg:grid-cols-2 gap-6">

          {/* NOTES / TERMS */}

          <div className="space-y-6">

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">

              <h2 className="font-semibold mb-4">
                Notes
              </h2>

              <textarea
                value={notes}
                onChange={(e) =>
                  setNotes(e.target.value)
                }
                placeholder="Thank you for your business..."
                rows={4}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
              />

            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">

              <h2 className="font-semibold mb-4">
                Terms & Conditions
              </h2>

              <textarea
                value={terms}
                onChange={(e) =>
                  setTerms(e.target.value)
                }
                placeholder="Payment is due within the specified payment period..."
                rows={5}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-violet-500/50"
              />

            </div>

          </div>

          {/* SUMMARY */}

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 h-fit">

            <h2 className="font-semibold mb-5">
              Invoice Summary
            </h2>

            <div className="space-y-3">

              <div className="flex justify-between text-sm">
                <span className="text-white/40">
                  Gross Subtotal
                </span>

                <span>
                  {money(grossSubtotal)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-white/40">
                  Discount
                </span>

                <span className="text-red-400">
                  -{money(totalDiscount)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-white/40">
                  Taxable Amount
                </span>

                <span>
                  {money(subtotal)}
                </span>
              </div>

              <div className="border-t border-white/10 pt-3">

                {gstType === "intra" ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/40">
                        CGST
                      </span>

                      <span className="text-green-400">
                        {money(cgst)}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm mt-3">
                      <span className="text-white/40">
                        SGST
                      </span>

                      <span className="text-green-400">
                        {money(sgst)}
                      </span>
                    </div>
                  </>
                ) : gstType === "inter" ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">
                      IGST
                    </span>

                    <span className="text-blue-400">
                      {money(igst)}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/40">
                      GST
                    </span>

                    <span>
                      {money(totalGst)}
                    </span>
                  </div>
                )}

              </div>

              <div className="border-t border-white/10 pt-5 mt-4 flex justify-between items-end">

                <div>
                  <p className="text-xs text-white/30">
                    Grand Total
                  </p>

                  <p className="text-2xl font-bold mt-1">
                    {money(grandTotal)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-white/25">
                    Currency
                  </p>

                  <p className="text-xs text-white/50 mt-1">
                    {profile?.default_currency ||
                      "INR"}
                  </p>
                </div>

              </div>

            </div>

          </div>
        </div>

        {/* PAYMENT DETAILS */}

        {(profile?.bank_name ||
          profile?.account_number ||
          profile?.upi_id) && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">

            <div className="flex items-center gap-2 mb-5">

              <CreditCard className="h-5 w-5 text-blue-400" />

              <h2 className="font-semibold">
                Payment Information
              </h2>

            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">

              {profile?.bank_name && (
                <div>
                  <p className="text-xs text-white/30">
                    Bank
                  </p>

                  <p className="text-sm text-white/70 mt-1">
                    {profile.bank_name}
                  </p>
                </div>
              )}

              {profile?.account_name && (
                <div>
                  <p className="text-xs text-white/30">
                    Account Name
                  </p>

                  <p className="text-sm text-white/70 mt-1">
                    {profile.account_name}
                  </p>
                </div>
              )}

              {profile?.account_number && (
                <div>
                  <p className="text-xs text-white/30">
                    Account Number
                  </p>

                  <p className="text-sm text-white/70 mt-1">
                    {profile.account_number}
                  </p>
                </div>
              )}

              {profile?.ifsc_code && (
                <div>
                  <p className="text-xs text-white/30">
                    IFSC
                  </p>

                  <p className="text-sm text-white/70 mt-1">
                    {profile.ifsc_code}
                  </p>
                </div>
              )}

              {profile?.upi_id && (
                <div>
                  <p className="text-xs text-white/30">
                    UPI ID
                  </p>

                  <p className="text-sm text-white/70 mt-1">
                    {profile.upi_id}
                  </p>
                </div>
              )}

            </div>

          </div>
        )}

        {/* FINAL ACTIONS */}

        <div className="flex justify-end gap-3 pb-10 print:hidden">

          <Link href="/dashboard/invoices">
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 hover:bg-white/10"
            >
              Cancel
            </Button>
          </Link>

          <Button
            onClick={handlePrint}
            variant="outline"
            className="border-white/10 bg-white/5 hover:bg-white/10 gap-2"
          >
            <Printer className="h-4 w-4" />
            Preview / Print
          </Button>

          <Button
            onClick={saveInvoice}
            disabled={saving}
            className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Create Invoice
              </>
            )}
          </Button>

        </div>

      </div>
    </div>
  )
}