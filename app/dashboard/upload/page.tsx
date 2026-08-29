"use client"

import { useState, useCallback } from "react"
import * as XLSX from "xlsx"
import { createClient } from "@/app/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  XCircle,
  Sparkles,
  Trash2,
  Save,
  AlertTriangle,
  Download,
} from "lucide-react"

type LineItem = {
  description: string
  quantity: number
  unit_price: number
  total: number
}

type InvoiceData = {
  vendor_name: string
  invoice_number: string
  date: string
  due_date: string | null

  subtotal: number
  discount: number
  tax_amount: number
  total_amount: number

  currency: string
  category: string

  tax_details?: {
    cgst: number
    sgst: number
    igst: number
    other_tax: number
  }

  line_items: LineItem[]

  notes: string | null

  source_pages?: number[]

  validation?: {
    calculated_total: number
    difference: number
    status: "verified" | "review"
  }
}

type ExtractedInvoice = {
  id: string
  file_name: string
  status: "processing" | "done" | "error"
  error_message?: string
  data?: InvoiceData
}

type ExtractionResponse = {
  success: boolean
  data?: {
    file_name: string
    invoice_count: number
    documents: InvoiceData[]
    summary: {
      subtotal: number
      discount: number
      tax: number
      total: number
      verified: number
      needs_review: number
    }
  }
  error?: string
}
function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();

  // Already YYYY-MM-DD — pass through unchanged
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // DD-MM-YYYY | DD/MM/YYYY | DD.MM.YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (dmyMatch) {
    const [, dd, mm, yyyy] = dmyMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // Fallback: let Date parse it and reformat (handles "July 30, 2026" etc.)
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

export default function UploadPage() {
  const [invoices, setInvoices] = useState<ExtractedInvoice[]>([])
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)

  const [message, setMessage] = useState<{
    text: string
    type: "error" | "success"
  } | null>(null)

  const supabase = createClient()

  // =========================================================
  // FORMAT MONEY
  // =========================================================

  const fmt = (
    value: number | null | undefined,
    currency = "INR"
  ) => {
    const amount = Number(value)

    if (!Number.isFinite(amount)) {
      return "₹0.00"
    }

    const safeCurrency =
      currency === "INR" ||
      currency === "USD" ||
      currency === "EUR" ||
      currency === "GBP"
        ? currency
        : "INR"

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  // =========================================================
  // PROCESS ONE FILE
  //
  // ONE FILE CAN RETURN MULTIPLE INVOICES
  // =========================================================

  async function processFile(
    file: File,
    placeholderId: string
  ): Promise<ExtractedInvoice[]> {
    try {
      const formData = new FormData()

      // IMPORTANT:
      // Do NOT manually set Content-Type.
      formData.append("file", file)

      const response = await fetch(
        "/api/extract-invoice",
        {
          method: "POST",
          body: formData,
        }
      )

      let result: ExtractionResponse

      try {
        result = await response.json()
      } catch {
        return [
          {
            id: placeholderId,
            file_name: file.name,
            status: "error",
            error_message: `Server returned ${response.status} but not valid JSON.`,
          },
        ]
      }

      if (!response.ok || !result.success) {
        return [
          {
            id: placeholderId,
            file_name: file.name,
            status: "error",
            error_message:
              result.error ||
              `Server returned ${response.status}.`,
          },
        ]
      }

      const documents =
        result.data?.documents ?? []

      // =====================================================
      // GEMINI FOUND NOTHING
      // =====================================================

      if (documents.length === 0) {
        return [
          {
            id: placeholderId,
            file_name: file.name,
            status: "error",
            error_message:
              "No invoice could be detected in this file.",
          },
        ]
      }

      // =====================================================
      // ONE FILE → MULTIPLE INVOICES
      // =====================================================

      return documents.map(
        (document, index) => ({
          id:
            index === 0
              ? placeholderId
              : crypto.randomUUID(),

          file_name:
            documents.length === 1
              ? file.name
              : `${file.name} · Invoice ${index + 1}`,

          status: "done",

          data: {
            vendor_name:
              document.vendor_name || "",

            invoice_number:
              document.invoice_number || "",

           date: normalizeDate(document.date) || null,

            due_date:
              normalizeDate(document.due_date) ?? null,

            subtotal:
              Number(document.subtotal) || 0,

            discount:
              Number(document.discount) || 0,

            tax_amount:
              Number(document.tax_amount) || 0,

            total_amount:
              Number(document.total_amount) || 0,

            currency:
              document.currency || "INR",

            category:
              document.category || "other",

            tax_details:
              document.tax_details,

            line_items:
              Array.isArray(
                document.line_items
              )
                ? document.line_items
                : [],

            notes:
              document.notes ?? null,

            source_pages:
              document.source_pages ?? [],

            validation:
              document.validation,
          },
        })
      )
    } catch (error) {
      console.error(
        "Invoice extraction error:",
        error
      )

      return [
        {
          id: placeholderId,
          file_name: file.name,
          status: "error",
          error_message:
            error instanceof Error
              ? error.message
              : "Failed to process file.",
        },
      ]
    }
  }

  // =========================================================
  // HANDLE FILES
  // =========================================================

  const handleFiles = useCallback(
    async (files: FileList) => {
      const validFiles = Array.from(files).filter(
        (file) =>
          file.type === "application/pdf" ||
          file.type === "image/jpeg" ||
          file.type === "image/png" ||
          file.type === "image/webp"
      )

      if (validFiles.length === 0) {
        setMessage({
          text:
            "Please upload PDF, JPG, PNG or WEBP files.",
          type: "error",
        })

        return
      }

      setMessage(null)

      // =====================================================
      // CREATE PROCESSING PLACEHOLDERS
      // =====================================================

      const placeholders =
        validFiles.map((file) => ({
          id: crypto.randomUUID(),
          file_name: file.name,
          status:
            "processing" as const,
        }))

      setInvoices((previous) => [
        ...previous,
        ...placeholders,
      ])

      // =====================================================
      // PROCESS EACH FILE
      // =====================================================

      for (
        let index = 0;
        index < validFiles.length;
        index++
      ) {
        const file = validFiles[index]

        const placeholder =
          placeholders[index]

        const results = await processFile(
          file,
          placeholder.id
        )

        // ===================================================
        // REMOVE PLACEHOLDER
        // INSERT ALL DETECTED INVOICES
        // ===================================================

        setInvoices((previous) => {
          const withoutPlaceholder =
            previous.filter(
              (invoice) =>
                invoice.id !==
                placeholder.id
            )

          return [
            ...withoutPlaceholder,
            ...results,
          ]
        })
      }
    },
    []
  )

  // =========================================================
  // DRAG & DROP
  // =========================================================

  const onDragOver = (
    event: React.DragEvent
  ) => {
    event.preventDefault()
    setDragging(true)
  }

  const onDragLeave = () => {
    setDragging(false)
  }

  const onDrop = (
    event: React.DragEvent
  ) => {
    event.preventDefault()
    setDragging(false)

    if (event.dataTransfer.files) {
      handleFiles(
        event.dataTransfer.files
      )
    }
  }

  // =========================================================
  // REMOVE INVOICE
  // =========================================================

  function removeInvoice(id: string) {
    setInvoices((previous) =>
      previous.filter(
        (invoice) =>
          invoice.id !== id
      )
    )
  }

  // =========================================================
  // SAVE ALL INVOICES
  // =========================================================

  async function saveAll() {
    setSaving(true)
    setMessage(null)

    let saved = 0
    let failed = 0

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setMessage({
          text:
            "You must be logged in to save invoices.",
          type: "error",
        })

        return
      }

      const doneInvoices =
        invoices.filter(
          (invoice) =>
            invoice.status === "done" &&
            invoice.data
        )

      // =====================================================
      // SAVE EACH INVOICE
      // =====================================================

      for (
        const invoiceEntry of doneInvoices
      ) {
        const data =
          invoiceEntry.data!

        try {
          // =================================================
          // FIND / CREATE CUSTOMER
          // =================================================

          let customerId:
            string | null = null

          if (data.vendor_name) {
            const {
              data: existingCustomer,
            } = await supabase
              .from("customers")
              .select("id")
              .eq("user_id", user.id)
              .eq(
                "name",
                data.vendor_name
              )
              .maybeSingle()

            if (existingCustomer) {
              customerId =
                existingCustomer.id
            } else {
              const {
                data: newCustomer,
                error:
                  customerError,
              } = await supabase
                .from("customers")
                .insert({
                  user_id: user.id,
                  name: data.vendor_name,
                })
                .select("id")
                .single()

              if (customerError) {
                console.error(
                  "Customer error:",
                  customerError
                )
              }

              customerId =
                newCustomer?.id ??
                null
            }
          }

          // =================================================
          // CREATE INVOICE
          // =================================================

          const {
            data: invoice,
            error:
              invoiceError,
          } = await supabase
            .from("invoices")
            .insert({
              user_id: user.id,

              customer_id:
                customerId,

              invoice_number:
                data.invoice_number ||
                `UP-${Date.now()
                  .toString(36)
                  .toUpperCase()}`,

              status: "draft",

              issue_date: normalizeDate(data.date) || null,
              due_date:
                normalizeDate(data.due_date) || null,

              total_amount:
                Number(
                  data.total_amount
                ) || 0,

              notes:
                data.notes,
            })
            .select()
            .single()

          if (
            invoiceError ||
            !invoice
          ) {
            console.error(
              "Invoice insert error:",
              invoiceError
            )

            failed++

            continue
          }

          // =================================================
          // CREATE LINE ITEMS
          // =================================================

          if (
            data.line_items &&
            data.line_items.length > 0
          ) {
            const lineItems =
              data.line_items.map(
                (
                  item,
                  itemIndex
                ) => ({
                  invoice_id:
                    invoice.id,

                  description:
                    item.description,

                  quantity:
                    Number(
                      item.quantity
                    ) || 1,

                  unit_price:
                    Number(
                      item.unit_price
                    ) || 0,

                  total:
                    Number(
                      item.total
                    ) ||
                    (
                      Number(
                        item.quantity
                      ) *
                      Number(
                        item.unit_price
                      )
                    ),

                  sort_order:
                    itemIndex,
                })
              )

            const {
              error:
                lineItemsError,
            } = await supabase
              .from("line_items")
              .insert(
                lineItems
              )

            if (lineItemsError) {
              console.error(
                "Line items error:",
                lineItemsError
              )
            }
          }

          // =================================================
          // CREATE EXPENSE
          // =================================================

          const {
            error:
              expenseError,
          } = await supabase
            .from("expenses")
            .insert({
              user_id: user.id,

              amount:
                Number(
                  data.total_amount
                ) || 0,

              category:
                data.category ||
                "other",

              description:
                `${
                  data.vendor_name ||
                  "Vendor"
                } - ${
                  data.invoice_number ||
                  "Invoice"
                }`,

              date: normalizeDate(data.date) || new Date().toISOString().split("T")[0],

            })

          if (expenseError) {
            console.error(
              "Expense error:",
              expenseError
            )
          }

          saved++
        } catch (error) {
          console.error(
            "Individual invoice save error:",
            error
          )

          failed++
        }
      }

      // =====================================================
      // RESULT MESSAGE
      // =====================================================

      if (failed === 0) {
        setMessage({
          text:
            `✅ ${saved} invoice${
              saved !== 1
                ? "s"
                : ""
            } saved successfully.`,
          type: "success",
        })
      } else {
        setMessage({
          text:
            `Saved ${saved} invoice${
              saved !== 1
                ? "s"
                : ""
            }, but ${failed} failed.`,
          type: "error",
        })
      }

      // =====================================================
      // REMOVE SAVED INVOICES
      // =====================================================

      setInvoices((previous) =>
        previous.filter(
          (invoice) =>
            !(
              invoice.status ===
                "done" &&
              invoice.data
            )
        )
      )
    } catch (error) {
      console.error(
        "Save all error:",
        error
      )

      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "Failed to save invoices.",
        type: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  // =========================================================
  // COMPUTED STATS
  // =========================================================

  const doneInvoices =
    invoices.filter(
      (invoice) =>
        invoice.status === "done" &&
        invoice.data
    )

  const processingCount =
    invoices.filter(
      (invoice) =>
        invoice.status ===
        "processing"
    ).length

  const errorCount =
    invoices.filter(
      (invoice) =>
        invoice.status === "error"
    ).length

  const totalSubtotal =
    doneInvoices.reduce(
      (sum, invoice) =>
        sum +
        Number(
          invoice.data
            ?.subtotal || 0
        ),
      0
    )

  const totalTax =
    doneInvoices.reduce(
      (sum, invoice) =>
        sum +
        Number(
          invoice.data
            ?.tax_amount || 0
        ),
      0
    )

  const totalDiscount =
    doneInvoices.reduce(
      (sum, invoice) =>
        sum +
        Number(
          invoice.data
            ?.discount || 0
        ),
      0
    )

  const totalExpense =
    doneInvoices.reduce(
      (sum, invoice) =>
        sum +
        Number(
          invoice.data
            ?.total_amount || 0
        ),
      0
    )

  const verifiedCount =
    doneInvoices.filter(
      (invoice) =>
        invoice.data
          ?.validation
          ?.status ===
        "verified"
    ).length

  const reviewCount =
    doneInvoices.filter(
      (invoice) =>
        invoice.data
          ?.validation
          ?.status ===
        "review"
    ).length

  // =========================================================
  // EXPORT TO EXCEL
  // =========================================================

  function exportToExcel() {
    const completedInvoices =
      invoices.filter(
        (invoice) =>
          invoice.status === "done" &&
          invoice.data
      )

    if (
      completedInvoices.length === 0
    ) {
      setMessage({
        text:
          "There are no processed invoices to export.",
        type: "error",
      })

      return
    }

    // =======================================================
    // SHEET 1 — INVOICE SUMMARY
    // =======================================================

    const invoiceRows =
      completedInvoices.map(
        (invoice) => {
          const data =
            invoice.data!

          return {
            "Source File":
              invoice.file_name,

            "Invoice #":
              data.invoice_number || "",

            "Vendor":
              data.vendor_name || "",

            "Date":
              data.date || "",

            "Due Date":
              data.due_date || "",

            "Currency":
              data.currency || "INR",

            "Subtotal":
              Number(data.subtotal) || 0,

            "Discount":
              Number(data.discount) || 0,

            "GST / Tax":
              Number(data.tax_amount) || 0,

            "Total Amount":
              Number(
                data.total_amount
              ) || 0,

            "Category":
              data.category || "other",

            "Line Items":
              data.line_items?.length ||
              0,

            "Source Pages":
              data.source_pages?.join(
                ", "
              ) || "",

            "Validation":
              data.validation
                ?.status ===
              "verified"
                ? "Verified"
                : "Review Required",

            "Calculation Difference":
              Number(
                data.validation
                  ?.difference
              ) || 0,
          }
        }
      )

    const invoiceSheet =
      XLSX.utils.json_to_sheet(
        invoiceRows
      )

    // =======================================================
    // SHEET 2 — LINE ITEMS
    // =======================================================

    const lineItemRows:
      Record<
        string,
        unknown
      >[] = []

    completedInvoices.forEach(
      (invoice) => {
        const data =
          invoice.data!

        if (
          !data.line_items?.length
        ) {
          return
        }

        data.line_items.forEach(
          (item, index) => {
            const quantity =
              Number(
                item.quantity
              ) || 0

            const unitPrice =
              Number(
                item.unit_price
              ) || 0

            const lineTotal =
              Number(
                item.total
              ) ||
              quantity * unitPrice

            lineItemRows.push({
              "Invoice #":
                data.invoice_number ||
                "",

              "Vendor":
                data.vendor_name ||
                "",

              "Source File":
                invoice.file_name,

              "Item #":
                index + 1,

              "Description":
                item.description ||
                "",

              "Quantity":
                quantity,

              "Unit Price":
                unitPrice,

              "Line Total":
                lineTotal,

              "Currency":
                data.currency ||
                "INR",
            })
          }
        )
      }
    )

    const lineItemSheet =
      XLSX.utils.json_to_sheet(
        lineItemRows.length > 0
          ? lineItemRows
          : [
              {
                "Invoice #": "",
                "Vendor": "",
                "Source File": "",
                "Item #": "",
                "Description":
                  "No line items detected",
                "Quantity": 0,
                "Unit Price": 0,
                "Line Total": 0,
                "Currency": "INR",
              },
            ]
      )

    // =======================================================
    // SHEET 3 — GST REPORT
    // =======================================================

    const gstRows =
      completedInvoices.map(
        (invoice) => {
          const data =
            invoice.data!

          const cgst =
            Number(
              data.tax_details?.cgst
            ) || 0

          const sgst =
            Number(
              data.tax_details?.sgst
            ) || 0

          const igst =
            Number(
              data.tax_details?.igst
            ) || 0

          const otherTax =
            Number(
              data.tax_details
                ?.other_tax
            ) || 0

          const totalTax =
            Number(
              data.tax_amount
            ) || 0

          return {
            "Invoice #":
              data.invoice_number ||
              "",

            "Vendor":
              data.vendor_name || "",

            "Taxable Amount":
              Number(
                data.subtotal
              ) || 0,

            "CGST":
              cgst,

            "SGST":
              sgst,

            "IGST":
              igst,

            "Other Tax":
              otherTax,

            "Total GST / Tax":
              totalTax,

            "Currency":
              data.currency ||
              "INR",
          }
        }
      )

    const gstSheet =
      XLSX.utils.json_to_sheet(
        gstRows
      )

    // =======================================================
    // SHEET 4 — SUMMARY
    // =======================================================

    const summaryRows = [
      {
        Metric:
          "Total Invoices",
        Value:
          completedInvoices.length,
      },

      {
        Metric:
          "Total Subtotal",
        Value:
          totalSubtotal,
      },

      {
        Metric:
          "Total Discount",
        Value:
          totalDiscount,
      },

      {
        Metric:
          "Total GST / Tax",
        Value:
          totalTax,
      },

      {
        Metric:
          "Total Expenditure",
        Value:
          totalExpense,
      },

      {
        Metric:
          "Verified Invoices",
        Value:
          verifiedCount,
      },

      {
        Metric:
          "Invoices Requiring Review",
        Value:
          reviewCount,
      },
    ]

    const summarySheet =
      XLSX.utils.json_to_sheet(
        summaryRows
      )

    // =======================================================
    // COLUMN WIDTHS
    // =======================================================

    invoiceSheet["!cols"] = [
      { wch: 35 },
      { wch: 20 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 12 },
      { wch: 15 },
      { wch: 20 },
      { wch: 24 },
    ]

    lineItemSheet["!cols"] = [
      { wch: 20 },
      { wch: 30 },
      { wch: 35 },
      { wch: 10 },
      { wch: 45 },
      { wch: 12 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
    ]

    gstSheet["!cols"] = [
      { wch: 20 },
      { wch: 30 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
      { wch: 10 },
    ]

    summarySheet["!cols"] = [
      { wch: 32 },
      { wch: 20 },
    ]

    // =======================================================
    // CREATE WORKBOOK
    // =======================================================

    const workbook =
      XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      workbook,
      invoiceSheet,
      "Invoice Summary"
    )

    XLSX.utils.book_append_sheet(
      workbook,
      lineItemSheet,
      "Line Items"
    )

    XLSX.utils.book_append_sheet(
      workbook,
      gstSheet,
      "GST Report"
    )

    XLSX.utils.book_append_sheet(
      workbook,
      summarySheet,
      "Summary"
    )

    // =======================================================
    // DOWNLOAD
    // =======================================================

    const date =
      new Date()
        .toISOString()
        .split("T")[0]

    XLSX.writeFile(
      workbook,
      `Invoicify-Invoice-Report-${date}.xlsx`
    )

    setMessage({
      text:
        `✅ Excel report generated successfully — ${completedInvoices.length} invoice${
          completedInvoices.length !==
          1
            ? "s"
            : ""
        } exported.`,

      type: "success",
    })
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="p-8 space-y-6">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-violet-400" />

          AI Invoice Upload
        </h1>

        <p className="text-white/40 text-sm mt-1">
          Upload invoices, bills or receipts.
          AI will detect and separate every
          document automatically.
        </p>
      </div>

      {/* =====================================================
          MESSAGE
      ===================================================== */}

      {message && (
        <div
          className={`text-sm p-3 rounded-lg text-center ${
            message.type ===
            "success"
              ? "bg-green-500/10 border border-green-500/20 text-green-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* =====================================================
          DROP ZONE
      ===================================================== */}

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
          dragging
            ? "border-violet-500 bg-violet-500/10"
            : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
        }`}
        onClick={() => {
          const input =
            document.createElement(
              "input"
            )

          input.type = "file"
          input.multiple = true

          input.accept =
            ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"

          input.onchange = (
            event
          ) => {
            const files = (
              event.target as HTMLInputElement
            ).files

            if (files) {
              handleFiles(files)
            }
          }

          input.click()
        }}
      >
        <Upload
          className={`h-12 w-12 mx-auto mb-4 ${
            dragging
              ? "text-violet-400"
              : "text-white/15"
          }`}
        />

        <p className="text-lg font-medium mb-1">
          {dragging
            ? "Drop invoices here"
            : "Drag & drop invoice files"}
        </p>

        <p className="text-white/30 text-sm">
          PDF · JPG · PNG · WEBP ·
          Multiple files supported
        </p>
      </div>

      {/* =====================================================
          SUMMARY
      ===================================================== */}

      {doneInvoices.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">

          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <p className="text-xs text-white/30">
              Invoices
            </p>

            <p className="text-xl font-bold mt-1">
              {doneInvoices.length}
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <p className="text-xs text-white/30">
              Subtotal
            </p>

            <p className="text-xl font-bold mt-1">
              {fmt(totalSubtotal)}
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <p className="text-xs text-white/30">
              Total GST / Tax
            </p>

            <p className="text-xl font-bold mt-1 text-yellow-400">
              {fmt(totalTax)}
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <p className="text-xs text-white/30">
              Total Expenditure
            </p>

            <p className="text-xl font-bold mt-1 text-green-400">
              {fmt(totalExpense)}
            </p>
          </div>

          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <p className="text-xs text-white/30">
              Validation
            </p>

            <p className="text-sm font-semibold mt-2">
              <span className="text-green-400">
                {verifiedCount} verified
              </span>

              {" · "}

              <span className="text-yellow-400">
                {reviewCount} review
              </span>
            </p>
          </div>

        </div>
      )}

      {/* =====================================================
          PROCESSING
      ===================================================== */}

      {(processingCount > 0 ||
        errorCount > 0) && (
        <div className="flex items-center gap-5 text-sm">

          {processingCount > 0 && (
            <span className="flex items-center gap-2 text-yellow-400">
              <Loader2 className="h-4 w-4 animate-spin" />

              Processing{" "}
              {processingCount}
            </span>
          )}

          {errorCount > 0 && (
            <span className="flex items-center gap-2 text-red-400">
              <XCircle className="h-4 w-4" />

              {errorCount} failed
            </span>
          )}

        </div>
      )}

      {/* =====================================================
          INVOICE LIST
      ===================================================== */}

      {invoices.length > 0 && (
        <div className="space-y-3">

          {invoices.map(
            (invoice) => (
              <div
                key={invoice.id}
                className="bg-white/[0.03] border border-white/5 rounded-xl p-5"
              >

                {/* HEADER */}

                <div className="flex items-center justify-between mb-4">

                  <div className="flex items-center gap-3 min-w-0">

                    <FileText className="h-5 w-5 text-white/30 shrink-0" />

                    <div className="min-w-0">

                      <p className="text-sm font-medium truncate">
                        {invoice.file_name}
                      </p>

                      {invoice.data
                        ?.source_pages
                        ?.length ? (
                        <p className="text-xs text-white/25 mt-0.5">
                          Page
                          {invoice.data.source_pages.length > 1
                            ? "s"
                            : ""}{" "}
                          {invoice.data.source_pages.join(
                            ", "
                          )}
                        </p>
                      ) : null}

                    </div>

                    {invoice.status ===
                      "processing" && (
                      <Loader2 className="h-4 w-4 text-yellow-400 animate-spin" />
                    )}

                    {invoice.status ===
                      "done" && (
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    )}

                    {invoice.status ===
                      "error" && (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}

                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeInvoice(
                        invoice.id
                      )
                    }
                    className="text-white/20 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                </div>

                {/* ERROR */}

                {invoice.status ===
                  "error" && (
                  <div className="text-red-400 text-sm bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                    {
                      invoice.error_message
                    }
                  </div>
                )}

                {/* PROCESSING */}

                {invoice.status ===
                  "processing" && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                    {[1, 2, 3, 4].map(
                      (number) => (
                        <div
                          key={number}
                          className="space-y-2"
                        >
                          <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />

                          <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
                        </div>
                      )
                    )}

                  </div>
                )}

                {/* EXTRACTED DATA */}

                {invoice.status ===
                  "done" &&
                  invoice.data && (
                    <div className="space-y-5">

                      {/* VALIDATION */}

                      {invoice.data
                        .validation && (
                        <div
                          className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                            invoice.data
                              .validation
                              .status ===
                            "verified"
                              ? "bg-green-500/5 border border-green-500/10 text-green-400"
                              : "bg-yellow-500/5 border border-yellow-500/10 text-yellow-400"
                          }`}
                        >

                          {invoice.data
                            .validation
                            .status ===
                          "verified" ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}

                          <span>
                            {invoice.data
                              .validation
                              .status ===
                            "verified"
                              ? "Invoice totals verified"
                              : "Review required — extracted total differs from calculated total"}
                          </span>

                          {Math.abs(
                            Number(
                              invoice.data
                                .validation
                                .difference
                            )
                          ) > 0 && (
                            <span className="ml-auto">
                              Difference:{" "}
                              {fmt(
                                Math.abs(
                                  Number(
                                    invoice.data
                                      .validation
                                      .difference
                                  )
                                )
                              )}
                            </span>
                          )}

                        </div>
                      )}

                      {/* MAIN DETAILS */}

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">

                        <div>
                          <span className="text-white/30 text-xs block mb-1">
                            Vendor
                          </span>

                          <span className="font-medium">
                            {invoice.data
                              .vendor_name ||
                              "—"}
                          </span>
                        </div>

                        <div>
                          <span className="text-white/30 text-xs block mb-1">
                            Invoice #
                          </span>

                          <span className="font-medium">
                            {invoice.data
                              .invoice_number ||
                              "—"}
                          </span>
                        </div>

                        <div>
                          <span className="text-white/30 text-xs block mb-1">
                            Date
                          </span>

                          <span className="font-medium">
                            {invoice.data
                              .date
                              ? new Date(
                                  invoice.data.date
                                ).toLocaleDateString(
                                  "en-IN"
                                )
                              : "—"}
                          </span>
                        </div>

                        <div>
                          <span className="text-white/30 text-xs block mb-1">
                            Total Expense
                          </span>

                          <span className="font-bold text-green-400">
                            {fmt(
                              invoice.data
                                .total_amount,
                              invoice.data
                                .currency
                            )}
                          </span>
                        </div>

                        <div>
                          <span className="text-white/30 text-xs block mb-1">
                            Subtotal
                          </span>

                          <span>
                            {fmt(
                              invoice.data
                                .subtotal,
                              invoice.data
                                .currency
                            )}
                          </span>
                        </div>

                        <div>
                          <span className="text-white/30 text-xs block mb-1">
                            Discount
                          </span>

                          <span>
                            {fmt(
                              invoice.data
                                .discount,
                              invoice.data
                                .currency
                            )}
                          </span>
                        </div>

                        <div>
                          <span className="text-white/30 text-xs block mb-1">
                            GST / Tax
                          </span>

                          <span className="text-yellow-400 font-medium">
                            {fmt(
                              invoice.data
                                .tax_amount,
                              invoice.data
                                .currency
                            )}
                          </span>
                        </div>

                        <div>
                          <span className="text-white/30 text-xs block mb-1">
                            Category
                          </span>

                          <span className="capitalize">
                            {invoice.data
                              .category
                              ?.replace(
                                /_/g,
                                " "
                              ) ||
                              "Other"}
                          </span>
                        </div>

                      </div>

                      {/* TAX BREAKDOWN */}

                      {invoice.data
                        .tax_details && (
                        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">

                          <p className="text-xs text-white/30 uppercase tracking-wider mb-3">
                            Tax Breakdown
                          </p>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">

                            <div>
                              <span className="text-white/30 text-xs block">
                                CGST
                              </span>

                              <span>
                                {fmt(
                                  invoice.data
                                    .tax_details
                                    .cgst,
                                  invoice.data
                                    .currency
                                )}
                              </span>
                            </div>

                            <div>
                              <span className="text-white/30 text-xs block">
                                SGST
                              </span>

                              <span>
                                {fmt(
                                  invoice.data
                                    .tax_details
                                    .sgst,
                                  invoice.data
                                    .currency
                                )}
                              </span>
                            </div>

                            <div>
                              <span className="text-white/30 text-xs block">
                                IGST
                              </span>

                              <span>
                                {fmt(
                                  invoice.data
                                    .tax_details
                                    .igst,
                                  invoice.data
                                    .currency
                                )}
                              </span>
                            </div>

                            <div>
                              <span className="text-white/30 text-xs block">
                                Other Tax
                              </span>

                              <span>
                                {fmt(
                                  invoice.data
                                    .tax_details
                                    .other_tax,
                                  invoice.data
                                    .currency
                                )}
                              </span>
                            </div>

                          </div>

                        </div>
                      )}

                      {/* LINE ITEMS */}

                      {invoice.data
                        .line_items
                        ?.length >
                        0 && (
                        <div className="bg-white/[0.02] rounded-lg p-4">

                          <p className="text-xs text-white/30 mb-3 uppercase tracking-wider">
                            Line Items
                          </p>

                          <div className="space-y-2">

                            {invoice.data.line_items.map(
                              (
                                item,
                                index
                              ) => (
                                <div
                                  key={index}
                                  className="flex justify-between gap-4 text-sm text-white/60 border-b border-white/5 pb-2 last:border-0 last:pb-0"
                                >

                                  <span className="truncate">
                                    {
                                      item.description
                                    }
                                  </span>

                                  <span className="tabular-nums whitespace-nowrap">

                                    {
                                      item.quantity
                                    }{" "}
                                    ×{" "}
                                    {fmt(
                                      item.unit_price,
                                      invoice.data
                                        .currency
                                    )}{" "}

                                    ={" "}

                                    {fmt(
                                      item.total ||
                                        item.quantity *
                                          item.unit_price,
                                      invoice.data
                                        .currency
                                    )}

                                  </span>

                                </div>
                              )
                            )}

                          </div>

                        </div>
                      )}

                    </div>
                  )}

              </div>
            )
          )}

        </div>
      )}

      {/* =====================================================
          EXPORT + SAVE
      ===================================================== */}

      {doneInvoices.length > 0 && (
        <div className="flex justify-end gap-3">

          {/* EXPORT EXCEL */}

          <Button
            type="button"
            onClick={exportToExcel}
            disabled={
              saving ||
              processingCount > 0
            }
            variant="outline"
            className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08] gap-2 text-base px-6 py-5"
          >
            <Download className="h-5 w-5" />

            Export Excel
          </Button>

          {/* SAVE DATABASE */}

          <Button
            type="button"
            onClick={saveAll}
            disabled={
              saving ||
              processingCount > 0
            }
            className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 gap-2 shadow-lg shadow-blue-500/20 text-base px-6 py-5"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />

                Saving{" "}
                {doneInvoices.length}{" "}
                invoices...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />

                Save All{" "}
                {doneInvoices.length}{" "}
                Invoices
              </>
            )}
          </Button>

        </div>
      )}

    </div>
  )
}