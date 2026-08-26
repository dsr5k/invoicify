import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export const maxDuration = 60

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini"

type LineItem = {
  description: string
  quantity: number | null
  unit_price: number | null
  total: number | null
  hsn_code?: string | null
  gst_rate?: number | null
}

type ExtractedDocument = {
  vendor_name: string | null
  vendor_gstin: string | null
  customer_name: string | null
  customer_gstin: string | null
  invoice_number: string | null
  invoice_date: string | null
  due_date: string | null
  subtotal: number | null
  discount_amount: number | null
  tax_amount: number | null
  cgst_amount: number | null
  sgst_amount: number | null
  igst_amount: number | null
  total_amount: number | null
  currency: string | null
  category: string | null
  payment_terms: string | null
  notes: string | null
  line_items: LineItem[]
}

function cleanJson(text: string) {
  let cleaned = text.trim()

  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  return cleaned
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const numberValue =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/,/g, "").replace(/[^\d.-]/g, ""))

  return Number.isFinite(numberValue) ? numberValue : null
}

function safeString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const text = String(value).trim()

  return text.length > 0 ? text : null
}

function normalizeLineItem(item: any): LineItem {
  return {
    description: safeString(item?.description) || "Unknown item",
    quantity: safeNumber(item?.quantity),
    unit_price: safeNumber(item?.unit_price),
    total: safeNumber(item?.total),
    hsn_code: safeString(item?.hsn_code),
    gst_rate: safeNumber(item?.gst_rate),
  }
}

function normalizeDocument(document: any): ExtractedDocument {
  return {
    vendor_name: safeString(document?.vendor_name),
    vendor_gstin: safeString(document?.vendor_gstin),
    customer_name: safeString(document?.customer_name),
    customer_gstin: safeString(document?.customer_gstin),
    invoice_number: safeString(document?.invoice_number),
    invoice_date: safeString(document?.invoice_date),
    due_date: safeString(document?.due_date),

    subtotal: safeNumber(document?.subtotal),
    discount_amount: safeNumber(document?.discount_amount),
    tax_amount: safeNumber(document?.tax_amount),

    cgst_amount: safeNumber(document?.cgst_amount),
    sgst_amount: safeNumber(document?.sgst_amount),
    igst_amount: safeNumber(document?.igst_amount),

    total_amount: safeNumber(document?.total_amount),

    currency: safeString(document?.currency),
    category: safeString(document?.category),
    payment_terms: safeString(document?.payment_terms),
    notes: safeString(document?.notes),

    line_items: Array.isArray(document?.line_items)
      ? document.line_items.map(normalizeLineItem)
      : [],
  }
}

function buildSummary(documents: ExtractedDocument[]) {
  const totals = documents.reduce(
    (acc, document) => {
      acc.subtotal += document.subtotal || 0
      acc.tax_amount += document.tax_amount || 0
      acc.cgst_amount += document.cgst_amount || 0
      acc.sgst_amount += document.sgst_amount || 0
      acc.igst_amount += document.igst_amount || 0
      acc.total_amount += document.total_amount || 0
      acc.line_items += document.line_items.length

      return acc
    },
    {
      subtotal: 0,
      tax_amount: 0,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_amount: 0,
      line_items: 0,
    }
  )

  return totals
}

function getMimeType(file: File) {
  if (file.type) {
    return file.type
  }

  const extension = file.name.split(".").pop()?.toLowerCase()

  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  }

  return mimeTypes[extension || ""] || "application/octet-stream"
}

function isSupportedFile(mimeType: string) {
  const supported = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]

  return supported.includes(mimeType)
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("[extract] OPENAI_API_KEY is missing")

      return NextResponse.json(
        {
          success: false,
          error: "OPENAI_API_KEY is not configured",
        },
        { status: 500 }
      )
    }

    const formData = await request.formData()

    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "No file provided",
        },
        { status: 400 }
      )
    }

    const mimeType = getMimeType(file)

    if (!isSupportedFile(mimeType)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unsupported file type. Please upload PDF, JPG, JPEG, PNG, or WEBP.",
        },
        { status: 400 }
      )
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "File is too large. Maximum supported size is 20MB.",
        },
        { status: 400 }
      )
    }

    console.log(
      `[extract] Starting extraction | File: ${file.name} | Type: ${mimeType} | Size: ${Math.round(
        file.size / 1024
      )}KB | Model: ${MODEL}`
    )

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")

    const prompt = `
You are an expert invoice and receipt data extraction system.

Analyze the uploaded document carefully and extract EVERY invoice or receipt found inside it.

IMPORTANT RULES:

1. Read the ACTUAL document. Never invent values.
2. Never use placeholder values.
3. Do not guess missing numbers.
4. If a value does not exist, return null.
5. Extract EVERY visible line item.
6. Preserve exact monetary values.
7. Do not round amounts unless the source document already rounds them.
8. For Indian GST invoices, separately extract:
   - CGST
   - SGST
   - IGST
9. Extract HSN/SAC code and GST rate from line items whenever visible.
10. Dates must be returned as YYYY-MM-DD when a date can be confidently interpreted.
11. If multiple invoices/documents exist inside one uploaded file, extract ALL of them.
12. invoice_count must exactly equal the number of extracted documents.
13. The grand total must be extracted from the actual "Grand Total", "Total Amount", "Amount Payable", or equivalent field.
14. Do not calculate a total when the actual total is visible. Prefer the actual document value.
15. Read vendor/company names and invoice numbers character-by-character carefully.

Return ONLY valid JSON.

Use EXACTLY this structure:

{
  "documents": [
    {
      "vendor_name": null,
      "vendor_gstin": null,
      "customer_name": null,
      "customer_gstin": null,
      "invoice_number": null,
      "invoice_date": null,
      "due_date": null,
      "subtotal": null,
      "discount_amount": null,
      "tax_amount": null,
      "cgst_amount": null,
      "sgst_amount": null,
      "igst_amount": null,
      "total_amount": null,
      "currency": null,
      "category": null,
      "payment_terms": null,
      "notes": null,
      "line_items": [
        {
          "description": "",
          "quantity": null,
          "unit_price": null,
          "total": null,
          "hsn_code": null,
          "gst_rate": null
        }
      ]
    }
  ]
}

Allowed category values:

travel
food
office_supplies
software
marketing
utilities
rent
salaries
services
inventory
equipment
healthcare
education
other

If you cannot confidently determine the category, use "other".
`

    let input:
      | OpenAI.Responses.ResponseInputItem[]
      | undefined

    if (mimeType === "application/pdf") {
      input = [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
            {
              type: "input_file",
              filename: file.name,
              file_data: `data:application/pdf;base64,${base64}`,
            },
          ],
        },
      ]
    } else {
      input = [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${base64}`,
              detail: "high",
            },
          ],
        },
      ]
    }

    const response = await openai.responses.create({
      model: MODEL,
      input,
      temperature: 0.1,
      max_output_tokens: 12000,
    })

    const outputText = response.output_text

    console.log(
      "[extract] OpenAI response:",
      outputText.slice(0, 1000)
    )

    if (!outputText) {
      return NextResponse.json(
        {
          success: false,
          error: "OpenAI returned an empty response",
        },
        { status: 500 }
      )
    }

    const cleaned = cleanJson(outputText)

    let parsed: any

    try {
      parsed = JSON.parse(cleaned)
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/)

      if (!match) {
        console.error(
          "[extract] Failed JSON:",
          cleaned.slice(0, 1000)
        )

        return NextResponse.json(
          {
            success: false,
            error: "Failed to parse AI extraction response",
            raw: cleaned.slice(0, 1000),
          },
          { status: 500 }
        )
      }

      try {
        parsed = JSON.parse(match[0])
      } catch {
        return NextResponse.json(
          {
            success: false,
            error: "AI returned invalid JSON",
            raw: cleaned.slice(0, 1000),
          },
          { status: 500 }
        )
      }
    }

    const rawDocuments = Array.isArray(parsed?.documents)
      ? parsed.documents
      : []

    if (rawDocuments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No invoice data could be extracted from this document",
        },
        { status: 422 }
      )
    }

    const documents = rawDocuments.map(normalizeDocument)

    const data = {
      file_name: file.name,
      invoice_count: documents.length,
      documents,
      summary: buildSummary(documents),
    }

    console.log("[extract] SUCCESS:", {
      file: file.name,
      invoices: data.invoice_count,
      lineItems: data.summary.line_items,
      total: data.summary.total_amount,
    })

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error("[extract] Server error:", error)

    const status =
      error?.status && Number.isInteger(error.status)
        ? error.status
        : 500

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "An unexpected error occurred while extracting the invoice",
      },
      { status }
    )
  }
}