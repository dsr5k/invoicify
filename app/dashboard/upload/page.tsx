"use client"

import { useState, type DragEvent } from "react"
import * as XLSX from "xlsx"
import { createClient } from "@/app/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
  XCircle,
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
  source_file?: File
}

type ExtractionResponse = {
  success: boolean
  data?: {
    file_name: string
    invoice_count: number
    documents: InvoiceData[]
  }
  error?: string
}

const MAX_FILES_PER_BATCH = 50
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_CONCURRENT_UPLOADS = 3

function safeNumber(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatInvoiceDate(
  value: string | null | undefined
): string {
  if (!value?.trim()) return "—"

  const date = value.trim()

  const dotMatch = date.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/
  )

  if (dotMatch) {
    const [, day, month, year] = dotMatch
    return `${day.padStart(2, "0")}/${month.padStart(
      2,
      "0"
    )}/${year}`
  }

  const slashMatch = date.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  )

  if (slashMatch) {
    const [, day, month, year] = slashMatch
    return `${day.padStart(2, "0")}/${month.padStart(
      2,
      "0"
    )}/${year}`
  }

  const isoMatch = date.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  )

  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return `${day}/${month}/${year}`
  }

  const parsedDate = new Date(date)

  return Number.isNaN(parsedDate.getTime())
    ? date
    : parsedDate.toLocaleDateString("en-IN")
}

function calculateValidation(
  data: InvoiceData
): InvoiceData["validation"] {
  const calculatedTotal =
    safeNumber(data.subtotal) -
    safeNumber(data.discount) +
    safeNumber(data.tax_amount)

  const difference =
    safeNumber(data.total_amount) - calculatedTotal

  return {
    calculated_total: calculatedTotal,
    difference,
    status:
      Math.abs(difference) < 0.01
        ? "verified"
        : "review",
  }
}

export default function UploadPage() {
  const [invoices, setInvoices] = useState<
    ExtractedInvoice[]
  >([])

  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)

  const [message, setMessage] = useState<{
    text: string
    type: "error" | "success"
  } | null>(null)

  const [editingInvoiceId, setEditingInvoiceId] =
    useState<string | null>(null)

  const [draft, setDraft] =
    useState<InvoiceData | null>(null)

  const supabase = createClient()

  const fmt = (
    value: number | null | undefined,
    currency = "INR"
  ) => {
    const supportedCurrencies = [
      "INR",
      "USD",
      "EUR",
      "GBP",
    ]

    const safeCurrency =
      supportedCurrencies.includes(currency)
        ? currency
        : "INR"

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeNumber(value))
  }

  async function processFile(
    file: File,
    placeholderId: string
  ): Promise<ExtractedInvoice[]> {
    try {
      const formData = new FormData()
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

      const documents = result.data?.documents ?? []

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

      return documents.map((document, index) => ({
        id:
          index === 0
            ? placeholderId
            : crypto.randomUUID(),

        file_name:
          documents.length === 1
            ? file.name
            : `${file.name} · Invoice ${index + 1}`,

        status: "done" as const,

        data: {
          vendor_name: document.vendor_name || "",
          invoice_number: document.invoice_number || "",
          date: document.date || "",
          due_date: document.due_date ?? null,
          subtotal: safeNumber(document.subtotal),
          discount: safeNumber(document.discount),
          tax_amount: safeNumber(document.tax_amount),
          total_amount: safeNumber(document.total_amount),
          currency: document.currency || "INR",
          category: document.category || "other",

          tax_details: document.tax_details
            ? {
                cgst: safeNumber(
                  document.tax_details.cgst
                ),
                sgst: safeNumber(
                  document.tax_details.sgst
                ),
                igst: safeNumber(
                  document.tax_details.igst
                ),
                other_tax: safeNumber(
                  document.tax_details.other_tax
                ),
              }
            : undefined,

          line_items: Array.isArray(
            document.line_items
          )
            ? document.line_items.map((item) => ({
                description: item.description || "",
                quantity: safeNumber(item.quantity),
                unit_price: safeNumber(item.unit_price),
                total: safeNumber(item.total),
              }))
            : [],

          notes: document.notes ?? null,
          source_pages: document.source_pages ?? [],

          validation: document.validation
            ? {
                calculated_total: safeNumber(
                  document.validation.calculated_total
                ),
                difference: safeNumber(
                  document.validation.difference
                ),
                status: document.validation.status,
              }
            : undefined,
        },
      }))
    } catch (error) {
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

  async function processQueuedFile(
    file: File,
    placeholder: ExtractedInvoice
  ) {
    const results = await processFile(
      file,
      placeholder.id
    )

    const resultsWithSource = results.map(
      (invoice) => ({
        ...invoice,
        source_file: file,
      })
    )

    setInvoices((previous) => {
      const withoutPlaceholder = previous.filter(
        (invoice) =>
          invoice.id !== placeholder.id
      )

      return [
        ...withoutPlaceholder,
        ...resultsWithSource,
      ]
    })
  }

  async function handleFiles(files: FileList) {
    const selectedFiles = Array.from(files)

    if (selectedFiles.length === 0) return

    if (
      selectedFiles.length >
      MAX_FILES_PER_BATCH
    ) {
      setMessage({
        text: `You can upload a maximum of ${MAX_FILES_PER_BATCH} files at one time.`,
        type: "error",
      })
      return
    }

    const acceptedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]

    const validFiles = selectedFiles.filter(
      (file) =>
        acceptedTypes.includes(file.type) &&
        file.size <= MAX_FILE_SIZE_BYTES
    )

    const skippedFiles =
      selectedFiles.length - validFiles.length

    if (validFiles.length === 0) {
      setMessage({
        text: "No valid files found. Upload PDF, JPG, PNG, or WEBP files smaller than 10 MB.",
        type: "error",
      })
      return
    }

    if (skippedFiles > 0) {
      setMessage({
        text: `${skippedFiles} file${
          skippedFiles !== 1 ? "s were" : " was"
        } skipped. Only PDF, JPG, PNG, and WEBP files up to 10 MB are allowed.`,
        type: "error",
      })
    } else {
      setMessage(null)
    }

    const placeholders: ExtractedInvoice[] =
      validFiles.map((file) => ({
        id: crypto.randomUUID(),
        file_name: file.name,
        status: "processing",
        source_file: file,
      }))

    setInvoices((previous) => [
      ...previous,
      ...placeholders,
    ])

    let nextIndex = 0

    async function worker() {
      while (nextIndex < validFiles.length) {
        const currentIndex = nextIndex
        nextIndex++

        await processQueuedFile(
          validFiles[currentIndex],
          placeholders[currentIndex]
        )
      }
    }

    await Promise.all(
      Array.from(
        {
          length: Math.min(
            MAX_CONCURRENT_UPLOADS,
            validFiles.length
          ),
        },
        worker
      )
    )
  }

  async function retryInvoice(id: string) {
    const invoice = invoices.find(
      (entry) => entry.id === id
    )

    if (!invoice?.source_file) {
      setMessage({
        text: "This file is no longer available for retry. Please upload it again.",
        type: "error",
      })
      return
    }

    setMessage(null)

    setInvoices((previous) =>
      previous.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: "processing",
              error_message: undefined,
              data: undefined,
            }
          : entry
      )
    )

    await processQueuedFile(
      invoice.source_file,
      invoice
    )
  }

  function removeInvoice(id: string) {
    setInvoices((previous) =>
      previous.filter(
        (invoice) => invoice.id !== id
      )
    )

    if (editingInvoiceId === id) {
      setEditingInvoiceId(null)
      setDraft(null)
    }
  }

  function startEditing(invoice: ExtractedInvoice) {
    if (!invoice.data) return

    setEditingInvoiceId(invoice.id)

    setDraft({
      ...invoice.data,
      tax_details: invoice.data.tax_details
        ? { ...invoice.data.tax_details }
        : {
            cgst: 0,
            sgst: 0,
            igst: 0,
            other_tax: 0,
          },
      line_items: invoice.data.line_items.map(
        (item) => ({ ...item })
      ),
    })
  }

  function cancelEditing() {
    setEditingInvoiceId(null)
    setDraft(null)
  }

  function saveEditedInvoice() {
    if (!editingInvoiceId || !draft) return

    const updatedInvoice: InvoiceData = {
      ...draft,
      validation: calculateValidation(draft),
    }

    setInvoices((previous) =>
      previous.map((invoice) =>
        invoice.id === editingInvoiceId
          ? {
              ...invoice,
              data: updatedInvoice,
            }
          : invoice
      )
    )

    setEditingInvoiceId(null)
    setDraft(null)

    setMessage({
      text: "Invoice changes saved. Review it, then use Save All when ready.",
      type: "success",
    })
  }

  function updateDraftField<
    K extends keyof InvoiceData
  >(key: K, value: InvoiceData[K]) {
    setDraft((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current
    )
  }

  function updateTaxField(
    field: keyof NonNullable<
      InvoiceData["tax_details"]
    >,
    value: string
  ) {
    setDraft((current) => {
      if (!current) return current

      return {
        ...current,
        tax_details: {
          cgst: safeNumber(
            current.tax_details?.cgst
          ),
          sgst: safeNumber(
            current.tax_details?.sgst
          ),
          igst: safeNumber(
            current.tax_details?.igst
          ),
          other_tax: safeNumber(
            current.tax_details?.other_tax
          ),
          [field]: safeNumber(value),
        },
      }
    })
  }

  function updateLineItem(
    index: number,
    field: keyof LineItem,
    value: string
  ) {
    setDraft((current) => {
      if (!current) return current

      const items = [...current.line_items]
      const currentItem = items[index]

      if (field === "description") {
        items[index] = {
          ...currentItem,
          description: value,
        }
      } else {
        items[index] = {
          ...currentItem,
          [field]: safeNumber(value),
        }
      }

      return {
        ...current,
        line_items: items,
      }
    })
  }

  function addLineItem() {
    setDraft((current) =>
      current
        ? {
            ...current,
            line_items: [
              ...current.line_items,
              {
                description: "",
                quantity: 1,
                unit_price: 0,
                total: 0,
              },
            ],
          }
        : current
    )
  }

  function removeLineItem(index: number) {
    setDraft((current) =>
      current
        ? {
            ...current,
            line_items: current.line_items.filter(
              (_, itemIndex) =>
                itemIndex !== index
            ),
          }
        : current
    )
  }

  const doneInvoices = invoices.filter(
    (invoice) =>
      invoice.status === "done" &&
      invoice.data
  )

  const processingCount = invoices.filter(
    (invoice) => invoice.status === "processing"
  ).length

  const errorCount = invoices.filter(
    (invoice) => invoice.status === "error"
  ).length

  const totalExpense = doneInvoices.reduce(
    (sum, invoice) =>
      sum +
      safeNumber(invoice.data?.total_amount),
    0
  )

  const totalLineItems = doneInvoices.reduce(
    (sum, invoice) =>
      sum +
      (invoice.data?.line_items?.length || 0),
    0
  )

  const verifiedCount = doneInvoices.filter(
    (invoice) =>
      invoice.data?.validation?.status ===
      "verified"
  ).length

  const reviewCount = doneInvoices.filter(
    (invoice) =>
      invoice.data?.validation?.status === "review"
  ).length

  function exportToExcel() {
    const completedInvoices = invoices.filter(
      (invoice) =>
        invoice.status === "done" &&
        invoice.data
    )

    if (completedInvoices.length === 0) {
      setMessage({
        text: "There are no processed invoices to export.",
        type: "error",
      })
      return
    }

    const detailedRows: Record<
      string,
      string | number
    >[] = []

    const overviewRows: Record<
      string,
      string | number
    >[] = []

    const gstRows: Record<
      string,
      string | number
    >[] = []

    let totalSubtotal = 0
    let totalDiscount = 0
    let totalTax = 0
    let totalAmount = 0
    let totalCGST = 0
    let totalSGST = 0
    let totalIGST = 0
    let totalOtherTax = 0

    completedInvoices.forEach((invoice) => {
      const data = invoice.data!

      const subtotal = safeNumber(data.subtotal)
      const discount = safeNumber(data.discount)
      const taxAmount = safeNumber(data.tax_amount)
      const invoiceTotal = safeNumber(data.total_amount)
      const cgst = safeNumber(data.tax_details?.cgst)
      const sgst = safeNumber(data.tax_details?.sgst)
      const igst = safeNumber(data.tax_details?.igst)
      const otherTax = safeNumber(
        data.tax_details?.other_tax
      )

      const sourcePages =
        data.source_pages?.length
          ? data.source_pages.join(", ")
          : ""

      const items = data.line_items || []

      totalSubtotal += subtotal
      totalDiscount += discount
      totalTax += taxAmount
      totalAmount += invoiceTotal
      totalCGST += cgst
      totalSGST += sgst
      totalIGST += igst
      totalOtherTax += otherTax

      const rowsToExport =
        items.length > 0
          ? items
          : [
              {
                description: "No line items extracted",
                quantity: 0,
                unit_price: 0,
                total: 0,
              },
            ]

      rowsToExport.forEach((item, index) => {
        detailedRows.push({
          "Source File": invoice.file_name,
          "Source Pages": sourcePages,
          "Invoice #": data.invoice_number || "",
          Vendor: data.vendor_name || "",
          "Invoice Date": formatInvoiceDate(
            data.date
          ),
          "Due Date": formatInvoiceDate(
            data.due_date
          ),
          Currency: data.currency || "INR",
          Category: data.category || "other",
          "Item #": index + 1,
          Description: item.description || "",
          Quantity: safeNumber(item.quantity),
          "Unit Price": safeNumber(item.unit_price),
          "Line Total": safeNumber(item.total),
          "Invoice Subtotal": subtotal,
          Discount: discount,
          "Invoice Tax": taxAmount,
          CGST: cgst,
          SGST: sgst,
          IGST: igst,
          "Other Tax": otherTax,
          "Invoice Total": invoiceTotal,
          "Calculated Total": safeNumber(
            data.validation?.calculated_total
          ),
          "Validation Difference": safeNumber(
            data.validation?.difference
          ),
          "Validation Status":
            data.validation?.status || "not provided",
          Notes: data.notes || "",
        })
      })

      overviewRows.push({
        "Source File": invoice.file_name,
        "Source Pages": sourcePages,
        "Invoice #": data.invoice_number || "",
        Vendor: data.vendor_name || "",
        "Invoice Date": formatInvoiceDate(data.date),
        "Due Date": formatInvoiceDate(data.due_date),
        Currency: data.currency || "INR",
        Category: data.category || "other",
        "Line Item Count": items.length,
        Subtotal: subtotal,
        Discount: discount,
        Tax: taxAmount,
        "Invoice Total": invoiceTotal,
        "Validation Status":
          data.validation?.status || "not provided",
        Notes: data.notes || "",
      })

      gstRows.push({
        "Source File": invoice.file_name,
        "Source Pages": sourcePages,
        "Invoice #": data.invoice_number || "",
        Vendor: data.vendor_name || "",
        "Invoice Date": formatInvoiceDate(data.date),
        Currency: data.currency || "INR",
        "Taxable Amount": subtotal,
        CGST: cgst,
        SGST: sgst,
        IGST: igst,
        "Other Tax": otherTax,
        "Total Tax": taxAmount,
        "Invoice Total": invoiceTotal,
      })
    })

    const summaryRows = [
      {
        Metric: "Invoices exported",
        Value: completedInvoices.length,
      },
      {
        Metric: "Detailed line-item rows",
        Value: detailedRows.length,
      },
      { Metric: "Total subtotal", Value: totalSubtotal },
      { Metric: "Total discount", Value: totalDiscount },
      { Metric: "Total CGST", Value: totalCGST },
      { Metric: "Total SGST", Value: totalSGST },
      { Metric: "Total IGST", Value: totalIGST },
      {
        Metric: "Total other tax",
        Value: totalOtherTax,
      },
      { Metric: "Total tax", Value: totalTax },
      { Metric: "Grand total", Value: totalAmount },
    ]

    function prepareSheet(
      worksheet: XLSX.WorkSheet,
      widths: number[]
    ) {
      if (!worksheet["!ref"]) return

      const range = XLSX.utils.decode_range(
        worksheet["!ref"]
      )

      worksheet["!cols"] = widths.map((width) => ({
        wch: width,
      }))

      worksheet["!autofilter"] = {
        ref: XLSX.utils.encode_range(range),
      }

      for (
        let column = range.s.c;
        column <= range.e.c;
        column++
      ) {
        const cell =
          worksheet[
            XLSX.utils.encode_cell({
              r: 0,
              c: column,
            })
          ]

        if (cell) {
          cell.s = {
            font: {
              bold: true,
              color: { rgb: "FFFFFF" },
            },
            fill: {
              fgColor: { rgb: "2563EB" },
            },
          }
        }
      }
    }

    const workbook = XLSX.utils.book_new()

    const detailedSheet =
      XLSX.utils.json_to_sheet(detailedRows)

    prepareSheet(detailedSheet, [
      30, 14, 16, 28, 14, 14, 10, 16, 9, 42,
      12, 14, 14, 16, 12, 14, 12, 12, 12, 14,
      16, 17, 19, 18, 35,
    ])

    XLSX.utils.book_append_sheet(
      workbook,
      detailedSheet,
      "Invoice Summary"
    )

    const overviewSheet =
      XLSX.utils.json_to_sheet(overviewRows)

    prepareSheet(overviewSheet, [
      30, 14, 16, 28, 14, 14, 10, 16, 15, 12,
      12, 12, 16, 18, 35,
    ])

    XLSX.utils.book_append_sheet(
      workbook,
      overviewSheet,
      "Invoice Overview"
    )

    const gstSheet =
      XLSX.utils.json_to_sheet(gstRows)

    prepareSheet(gstSheet, [
      30, 14, 16, 28, 14, 10, 16, 12, 12, 12,
      14, 14, 16,
    ])

    XLSX.utils.book_append_sheet(
      workbook,
      gstSheet,
      "GST Report"
    )

    const summarySheet =
      XLSX.utils.json_to_sheet(summaryRows)

    prepareSheet(summarySheet, [34, 18])

    XLSX.utils.book_append_sheet(
      workbook,
      summarySheet,
      "Summary"
    )

    XLSX.writeFile(
      workbook,
      `invoice-export-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    )

    setMessage({
      text: `✅ ${completedInvoices.length} invoice${
        completedInvoices.length !== 1 ? "s" : ""
      } and ${detailedRows.length} detailed row${
        detailedRows.length !== 1 ? "s" : ""
      } exported.`,
      type: "success",
    })
  }

  async function saveAll() {
    const completedInvoices = invoices.filter(
      (invoice) =>
        invoice.status === "done" &&
        invoice.data
    )

    if (completedInvoices.length === 0) {
      setMessage({
        text: "There are no processed invoices to save.",
        type: "error",
      })
      return
    }

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
          text: "You must be logged in to save invoices.",
          type: "error",
        })
        return
      }

      for (const invoiceEntry of completedInvoices) {
        const data = invoiceEntry.data!

        try {
          let customerId: string | null = null

          if (data.vendor_name) {
            const {
              data: existingCustomer,
            } = await supabase
              .from("customers")
              .select("id")
              .eq("user_id", user.id)
              .eq("name", data.vendor_name)
              .maybeSingle()

            if (existingCustomer) {
              customerId = existingCustomer.id
            } else {
              const {
                data: newCustomer,
                error: customerError,
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
                  "Customer creation error:",
                  customerError
                )
              }

              customerId = newCustomer?.id ?? null
            }
          }

          const {
            data: savedInvoice,
            error: invoiceError,
          } = await supabase
            .from("invoices")
            .insert({
              user_id: user.id,
              customer_id: customerId,
              invoice_number:
                data.invoice_number ||
                `UP-${Date.now()
                  .toString(36)
                  .toUpperCase()}`,
              status: "draft",
              issue_date:
                data.date ||
                new Date()
                  .toISOString()
                  .split("T")[0],
              due_date: data.due_date,
              total_amount: safeNumber(
                data.total_amount
              ),
              notes: data.notes,
            })
            .select()
            .single()

          if (invoiceError || !savedInvoice) {
            console.error(
              "Invoice save error:",
              invoiceError
            )
            failed++
            continue
          }

          if (data.line_items.length > 0) {
            const lineItems = data.line_items.map(
              (item, index) => ({
                invoice_id: savedInvoice.id,
                description: item.description,
                quantity: safeNumber(item.quantity) || 1,
                unit_price: safeNumber(item.unit_price),
                total:
                  safeNumber(item.total) ||
                  safeNumber(item.quantity) *
                    safeNumber(item.unit_price),
                sort_order: index,
              })
            )

            const { error: lineItemsError } =
              await supabase
                .from("line_items")
                .insert(lineItems)

            if (lineItemsError) {
              console.error(
                "Line item save error:",
                lineItemsError
              )
            }
          }

          const { error: expenseError } =
            await supabase
              .from("expenses")
              .insert({
                user_id: user.id,
                amount: safeNumber(data.total_amount),
                category: data.category || "other",
                description: `${
                  data.vendor_name || "Vendor"
                } - ${
                  data.invoice_number || "Invoice"
                }`,
                date:
                  data.date ||
                  new Date()
                    .toISOString()
                    .split("T")[0],
              })

          if (expenseError) {
            console.error(
              "Expense save error:",
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

      if (failed === 0) {
        setMessage({
          text: `✅ ${saved} invoice${
            saved !== 1 ? "s" : ""
          } saved successfully.`,
          type: "success",
        })

        setInvoices((previous) =>
          previous.filter(
            (invoice) =>
              !(
                invoice.status === "done" &&
                invoice.data
              )
          )
        )
      } else {
        setMessage({
          text: `Saved ${saved} invoice${
            saved !== 1 ? "s" : ""
          }, but ${failed} failed.`,
          type: "error",
        })
      }
    } catch (error) {
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

  function onDragOver(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault()
    setDragging(true)
  }

  function onDragLeave() {
    setDragging(false)
  }

  function onDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault()
    setDragging(false)

    if (event.dataTransfer.files.length > 0) {
      handleFiles(event.dataTransfer.files)
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-blue-400">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">
              AI-powered extraction
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight">
            Upload purchase invoices
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
            Upload PDF or image files. Review and correct
            extracted data before saving it.
          </p>
        </div>

        {message && (
          <div
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-green-500/20 bg-green-500/10 text-green-300"
                : "border-red-500/20 bg-red-500/10 text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-12 ${
            dragging
              ? "border-blue-500 bg-blue-500/10"
              : "border-white/10 bg-white/[0.025] hover:border-white/20"
          }`}
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
            <Upload className="h-7 w-7" />
          </div>

          <h2 className="mt-4 text-lg font-semibold">
            Drop invoices here
          </h2>

          <p className="mt-2 text-sm text-white/45">
            PDF, JPG, PNG, or WEBP · Max 10 MB · Up to 50 files
          </p>

          <label className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500">
            Choose files
            <input
              type="file"
              multiple
              accept=".pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                if (event.target.files) {
                  handleFiles(event.target.files)
                }

                event.target.value = ""
              }}
            />
          </label>
        </div>

        {doneInvoices.length > 0 && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Invoices extracted"
              value={doneInvoices.length}
            />

            <StatCard
              label="Line items found"
              value={totalLineItems}
            />

            <StatCard
              label="Total expense"
              value={fmt(totalExpense)}
              accent="text-green-400"
            />

            <StatCard
              label="Validation"
              value={`${verifiedCount} verified · ${reviewCount} review`}
              accent="text-yellow-300"
            />
          </div>
        )}

        {(processingCount > 0 || errorCount > 0) && (
          <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
            {processingCount > 0 && (
              <span className="flex items-center gap-2 text-yellow-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing {processingCount} file
                {processingCount !== 1 ? "s" : ""}
              </span>
            )}

            {errorCount > 0 && (
              <span className="flex items-center gap-2 text-red-300">
                <XCircle className="h-4 w-4" />
                {errorCount} failed
              </span>
            )}
          </div>
        )}

        {invoices.length > 0 && (
          <div className="mt-6 space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="rounded-xl border border-white/10 bg-white/[0.025] p-4 sm:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-white/35" />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {invoice.file_name}
                      </p>

                      {invoice.data?.source_pages?.length ? (
                        <p className="mt-1 text-xs text-white/30">
                          Page
                          {invoice.data.source_pages.length > 1
                            ? "s"
                            : ""}{" "}
                          {invoice.data.source_pages.join(", ")}
                        </p>
                      ) : null}
                    </div>

                    {invoice.status === "processing" && (
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-yellow-300" />
                    )}

                    {invoice.status === "done" && (
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                    )}

                    {invoice.status === "error" && (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removeInvoice(invoice.id)
                    }
                    className="shrink-0 text-white/30 transition hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {invoice.status === "processing" && (
                  <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[1, 2, 3, 4].map((number) => (
                      <div
                        key={number}
                        className="space-y-2"
                      >
                        <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
                        <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
                      </div>
                    ))}
                  </div>
                )}

                {invoice.status === "error" && (
                  <div className="mt-4 flex flex-col gap-3 rounded-lg border border-red-500/15 bg-red-500/10 p-3 text-sm text-red-300 sm:flex-row sm:items-center sm:justify-between">
                    <span>{invoice.error_message}</span>

                    <button
                      type="button"
                      onClick={() =>
                        retryInvoice(invoice.id)
                      }
                      disabled={!invoice.source_file}
                      className="flex w-fit items-center gap-2 rounded-md border border-red-400/25 px-3 py-1.5 text-xs font-medium transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retry
                    </button>
                  </div>
                )}

                {invoice.status === "done" &&
                  invoice.data &&
                  editingInvoiceId !== invoice.id && (
                    <InvoicePreview
                      invoice={invoice}
                      fmt={fmt}
                      onEdit={() =>
                        startEditing(invoice)
                      }
                    />
                  )}

                {invoice.status === "done" &&
                  invoice.data &&
                  editingInvoiceId === invoice.id &&
                  draft && (
                    <InvoiceEditor
                      draft={draft}
                      onCancel={cancelEditing}
                      onSave={saveEditedInvoice}
                      onUpdateField={updateDraftField}
                      onUpdateTax={updateTaxField}
                      onUpdateLine={updateLineItem}
                      onAddLine={addLineItem}
                      onRemoveLine={removeLineItem}
                    />
                  )}
              </div>
            ))}
          </div>
        )}

        {doneInvoices.length > 0 && (
          <div className="mt-7 flex flex-col justify-end gap-3 sm:flex-row">
            <Button
              onClick={exportToExcel}
              disabled={
                saving ||
                processingCount > 0 ||
                editingInvoiceId !== null
              }
              variant="outline"
              className="gap-2 border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.08]"
            >
              <FileText className="h-4 w-4" />
              Export Excel
            </Button>

            <Button
              onClick={saveAll}
              disabled={
                saving ||
                processingCount > 0 ||
                editingInvoiceId !== null
              }
              className="gap-2 bg-blue-600 hover:bg-blue-500"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving invoices...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save All {doneInvoices.length} Invoice
                  {doneInvoices.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function InvoicePreview({
  invoice,
  fmt,
  onEdit,
}: {
  invoice: ExtractedInvoice
  fmt: (
    value: number | null | undefined,
    currency?: string
  ) => string
  onEdit: () => void
}) {
  const data = invoice.data!

  return (
    <div className="mt-5 space-y-5">
      {data.validation && (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm ${
            data.validation.status === "verified"
              ? "border-green-500/15 bg-green-500/10 text-green-300"
              : "border-yellow-500/15 bg-yellow-500/10 text-yellow-200"
          }`}
        >
          {data.validation.status === "verified" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}

          <span>
            {data.validation.status === "verified"
              ? "Invoice totals verified"
              : "Review required — extracted total differs from calculated total"}
          </span>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onEdit}
          className="gap-2 border-blue-500/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20"
        >
          <Pencil className="h-4 w-4" />
          Edit invoice
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InfoItem
          label="Vendor"
          value={data.vendor_name || "—"}
        />

        <InfoItem
          label="Invoice #"
          value={data.invoice_number || "—"}
        />

        <InfoItem
          label="Date"
          value={formatInvoiceDate(data.date)}
        />

        <InfoItem
          label="Total expense"
          value={fmt(
            data.total_amount,
            data.currency
          )}
          valueClassName="font-bold text-green-400"
        />

        <InfoItem
          label="Subtotal"
          value={fmt(data.subtotal, data.currency)}
        />

        <InfoItem
          label="Discount"
          value={fmt(data.discount, data.currency)}
        />

        <InfoItem
          label="GST / Tax"
          value={fmt(
            data.tax_amount,
            data.currency
          )}
          valueClassName="text-yellow-300"
        />

        <InfoItem
          label="Category"
          value={
            data.category?.replace(/_/g, " ") ||
            "Other"
          }
        />
      </div>

      {data.line_items.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-3 text-xs uppercase tracking-wider text-white/35">
            Line items
          </p>

          <div className="space-y-2">
            {data.line_items.map((item, index) => (
              <div
                key={`${item.description}-${index}`}
                className="flex justify-between gap-4 border-b border-white/5 pb-2 text-sm text-white/65 last:border-0 last:pb-0"
              >
                <span className="min-w-0 truncate">
                  {item.description || "Unnamed item"}
                </span>

                <span className="shrink-0 whitespace-nowrap tabular-nums">
                  {item.quantity} ×{" "}
                  {fmt(
                    item.unit_price,
                    data.currency
                  )}{" "}
                  ={" "}
                  {fmt(
                    safeNumber(item.total) ||
                      safeNumber(item.quantity) *
                        safeNumber(item.unit_price),
                    data.currency
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InvoiceEditor({
  draft,
  onCancel,
  onSave,
  onUpdateField,
  onUpdateTax,
  onUpdateLine,
  onAddLine,
  onRemoveLine,
}: {
  draft: InvoiceData
  onCancel: () => void
  onSave: () => void
  onUpdateField: <K extends keyof InvoiceData>(
    key: K,
    value: InvoiceData[K]
  ) => void
  onUpdateTax: (
    field: keyof NonNullable<
      InvoiceData["tax_details"]
    >,
    value: string
  ) => void
  onUpdateLine: (
    index: number,
    field: keyof LineItem,
    value: string
  ) => void
  onAddLine: () => void
  onRemoveLine: (index: number) => void
}) {
  return (
    <div className="mt-5 space-y-5 rounded-xl border border-blue-500/25 bg-blue-500/[0.04] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-blue-100">
            Edit extracted invoice
          </p>
          <p className="mt-1 text-xs text-white/40">
            Correct any AI-extracted value before saving.
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="text-white/40 transition hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <EditorField label="Vendor name">
          <input
            value={draft.vendor_name}
            onChange={(event) =>
              onUpdateField(
                "vendor_name",
                event.target.value
              )
            }
            className="editor-input"
          />
        </EditorField>

        <EditorField label="Invoice number">
          <input
            value={draft.invoice_number}
            onChange={(event) =>
              onUpdateField(
                "invoice_number",
                event.target.value
              )
            }
            className="editor-input"
          />
        </EditorField>

        <EditorField label="Invoice date">
          <input
            value={draft.date}
            onChange={(event) =>
              onUpdateField("date", event.target.value)
            }
            placeholder="YYYY-MM-DD"
            className="editor-input"
          />
        </EditorField>

        <EditorField label="Due date">
          <input
            value={draft.due_date || ""}
            onChange={(event) =>
              onUpdateField(
                "due_date",
                event.target.value || null
              )
            }
            placeholder="YYYY-MM-DD"
            className="editor-input"
          />
        </EditorField>

        <EditorField label="Currency">
          <select
            value={draft.currency}
            onChange={(event) =>
              onUpdateField(
                "currency",
                event.target.value
              )
            }
            className="editor-input"
          >
            <option value="INR">INR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </EditorField>

        <EditorField label="Category">
          <input
            value={draft.category}
            onChange={(event) =>
              onUpdateField(
                "category",
                event.target.value
              )
            }
            className="editor-input"
          />
        </EditorField>

        <EditorField label="Subtotal">
          <input
            type="number"
            value={draft.subtotal}
            onChange={(event) =>
              onUpdateField(
                "subtotal",
                safeNumber(event.target.value)
              )
            }
            className="editor-input"
          />
        </EditorField>

        <EditorField label="Discount">
          <input
            type="number"
            value={draft.discount}
            onChange={(event) =>
              onUpdateField(
                "discount",
                safeNumber(event.target.value)
              )
            }
            className="editor-input"
          />
        </EditorField>

        <EditorField label="GST / Tax">
          <input
            type="number"
            value={draft.tax_amount}
            onChange={(event) =>
              onUpdateField(
                "tax_amount",
                safeNumber(event.target.value)
              )
            }
            className="editor-input"
          />
        </EditorField>

        <EditorField label="Invoice total">
          <input
            type="number"
            value={draft.total_amount}
            onChange={(event) =>
              onUpdateField(
                "total_amount",
                safeNumber(event.target.value)
              )
            }
            className="editor-input"
          />
        </EditorField>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/10 p-4">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-white/40">
          GST breakdown
        </p>

        <div className="grid gap-4 sm:grid-cols-4">
          <EditorField label="CGST">
            <input
              type="number"
              value={draft.tax_details?.cgst || 0}
              onChange={(event) =>
                onUpdateTax(
                  "cgst",
                  event.target.value
                )
              }
              className="editor-input"
            />
          </EditorField>

          <EditorField label="SGST">
            <input
              type="number"
              value={draft.tax_details?.sgst || 0}
              onChange={(event) =>
                onUpdateTax(
                  "sgst",
                  event.target.value
                )
              }
              className="editor-input"
            />
          </EditorField>

          <EditorField label="IGST">
            <input
              type="number"
              value={draft.tax_details?.igst || 0}
              onChange={(event) =>
                onUpdateTax(
                  "igst",
                  event.target.value
                )
              }
              className="editor-input"
            />
          </EditorField>

          <EditorField label="Other tax">
            <input
              type="number"
              value={
                draft.tax_details?.other_tax || 0
              }
              onChange={(event) =>
                onUpdateTax(
                  "other_tax",
                  event.target.value
                )
              }
              className="editor-input"
            />
          </EditorField>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/10 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">
            Line items
          </p>

          <button
            type="button"
            onClick={onAddLine}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-300 hover:text-blue-200"
          >
            <Plus className="h-3.5 w-3.5" />
            Add item
          </button>
        </div>

        <div className="space-y-3">
          {draft.line_items.map((item, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-lg border border-white/10 p-3 sm:grid-cols-[minmax(0,1fr)_80px_110px_110px_32px]"
            >
              <input
                value={item.description}
                placeholder="Item description"
                onChange={(event) =>
                  onUpdateLine(
                    index,
                    "description",
                    event.target.value
                  )
                }
                className="editor-input"
              />

              <input
                type="number"
                value={item.quantity}
                placeholder="Qty"
                onChange={(event) =>
                  onUpdateLine(
                    index,
                    "quantity",
                    event.target.value
                  )
                }
                className="editor-input"
              />

              <input
                type="number"
                value={item.unit_price}
                placeholder="Price"
                onChange={(event) =>
                  onUpdateLine(
                    index,
                    "unit_price",
                    event.target.value
                  )
                }
                className="editor-input"
              />

              <input
                type="number"
                value={item.total}
                placeholder="Total"
                onChange={(event) =>
                  onUpdateLine(
                    index,
                    "total",
                    event.target.value
                  )
                }
                className="editor-input"
              />

              <button
                type="button"
                onClick={() =>
                  onRemoveLine(index)
                }
                className="flex h-10 items-center justify-center rounded-md text-white/35 transition hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {draft.line_items.length === 0 && (
            <p className="py-3 text-sm text-white/35">
              No line items. Use “Add item” to create one.
            </p>
          )}
        </div>
      </div>

      <EditorField label="Notes">
        <textarea
          value={draft.notes || ""}
          onChange={(event) =>
            onUpdateField(
              "notes",
              event.target.value || null
            )
          }
          rows={3}
          className="editor-input min-h-[88px] resize-y"
        />
      </EditorField>

      <div className="flex flex-col justify-end gap-3 border-t border-white/10 pt-4 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-white/15 bg-transparent text-white hover:bg-white/10"
        >
          Cancel
        </Button>

        <Button
          type="button"
          onClick={onSave}
          className="gap-2 bg-blue-600 hover:bg-blue-500"
        >
          <Save className="h-4 w-4" />
          Save invoice changes
        </Button>
      </div>
    </div>
  )
}

function EditorField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-white/45">
        {label}
      </span>

      {children}
    </label>
  )
}

function StatCard({
  label,
  value,
  accent = "text-white",
}: {
  label: string
  value: string | number
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <p className="text-xs text-white/35">{label}</p>

      <p
        className={`mt-2 text-base font-semibold ${accent}`}
      >
        {value}
      </p>
    </div>
  )
}

function InfoItem({
  label,
  value,
  valueClassName = "",
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div>
      <span className="mb-1 block text-xs text-white/35">
        {label}
      </span>

      <span
        className={`block truncate text-sm font-medium capitalize ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  )
}