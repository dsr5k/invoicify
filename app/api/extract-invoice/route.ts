import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 60

type LineItem = {
  description: string
  quantity: number
  unit_price: number
  total: number
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not set" },
        { status: 500 }
      )
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ]

    const mimeType =
      file.type ||
      (file.name.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "image/jpeg")

    if (!allowedTypes.includes(mimeType)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Please upload PDF, JPG, JPEG, PNG, or WEBP.",
        },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()

    console.log(
      `[extract] File: ${file.name}, Type: ${mimeType}, Size: ${Math.round(
        bytes.byteLength / 1024
      )}KB`
    )

    const base64 = Buffer.from(bytes).toString("base64")

    const prompt = `
You are an expert invoice and receipt data extraction system.

Analyze the uploaded document extremely carefully.

Extract the REAL data visible in the invoice. Do not invent, estimate,
guess, or replace missing values with random values.

Read:

1. Vendor/company name
2. Invoice number
3. Invoice date
4. Due date
5. Every line item
6. Quantity for every item
7. Unit price for every item
8. Line total for every item
9. Subtotal
10. Tax/GST amount
11. Grand total/final amount
12. Currency
13. Category
14. Notes
15. Payment terms
16. Bank/payment details if visible

IMPORTANT RULES:

- Read the actual numbers shown in the document.
- Preserve ALL line items.
- Do not combine multiple items into one.
- If an item quantity is not visible, use 1.
- If unit price is not separately visible but line total is visible,
  use the line total as unit_price when quantity is 1.
- Never make up invoice numbers.
- Never use placeholder values.
- Do not return markdown.
- Return ONLY valid JSON.

Use this EXACT structure:

{
  "vendor_name": "actual vendor name or null",
  "invoice_number": "actual invoice number or null",
  "date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "subtotal": 0,
  "tax_amount": 0,
  "total_amount": 0,
  "currency": "INR",
  "category": "travel",
  "line_items": [
    {
      "description": "actual item description",
      "quantity": 1,
      "unit_price": 0,
      "total": 0
    }
  ],
  "notes": "notes, payment terms, bank details, or null"
}

CATEGORY must be exactly one of:

travel
food
office_supplies
software
marketing
utilities
rent
salaries
services
other

DATES:
Convert dates to YYYY-MM-DD when the date is clear.
If no date exists, return null.

NUMBERS:
Return numbers only.
For example:
₹15,000.00 becomes 15000
18% GST amount ₹2,700 becomes 2700

FINAL CHECK:
Before returning JSON, verify that:

subtotal + tax_amount approximately equals total_amount

Do not change the actual invoice values just to make this equation match.
If the document contains discounts, shipping, rounding, or other charges,
preserve the actual values from the invoice.
`

    let inputContent: any[] = [
      {
        type: "input_text",
        text: prompt,
      },
    ]

    // IMAGE INPUT
    if (mimeType.startsWith("image/")) {
      inputContent.push({
        type: "input_image",
        image_url: `data:${mimeType};base64,${base64}`,
        detail: "high",
      })
    }

    // PDF INPUT
    if (mimeType === "application/pdf") {
      inputContent.push({
        type: "input_file",
        filename: file.name,
        file_data: `data:application/pdf;base64,${base64}`,
      })
    }

    console.log("[extract] Sending document to OpenAI...")

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",

          input: [
            {
              role: "user",
              content: inputContent,
            },
          ],

          temperature: 0.1,

          max_output_tokens: 8000,

          text: {
            format: {
              type: "json_object",
            },
          },
        }),
      }
    )

    if (!response.ok) {
      const errText = await response.text()

      console.error(
        "[extract] OpenAI error:",
        response.status,
        errText.slice(0, 1000)
      )

      return NextResponse.json(
        {
          error: `OpenAI error: ${response.status}`,
          raw: errText.slice(0, 1000),
        },
        { status: 500 }
      )
    }

    const responseData = await response.json()

    console.log("[extract] OpenAI response received")

    let outputText = ""

    if (responseData.output_text) {
      outputText = responseData.output_text
    }

    // Fallback extraction from Responses API output
    if (!outputText && Array.isArray(responseData.output)) {
      for (const output of responseData.output) {
        if (!Array.isArray(output.content)) continue

        for (const content of output.content) {
          if (
            content.type === "output_text" &&
            typeof content.text === "string"
          ) {
            outputText += content.text
          }
        }
      }
    }

    if (!outputText) {
      console.error(
        "[extract] No text returned:",
        JSON.stringify(responseData).slice(0, 1000)
      )

      return NextResponse.json(
        {
          error: "OpenAI could not extract data from this document",
          raw: JSON.stringify(responseData).slice(0, 1000),
        },
        { status: 500 }
      )
    }

    console.log(
      "[extract] OpenAI response:",
      outputText.slice(0, 1000)
    )

    // Clean possible markdown fences just in case
    let cleaned = outputText
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    let extracted: any

    try {
      extracted = JSON.parse(cleaned)
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        return NextResponse.json(
          {
            error: "Failed to parse OpenAI response as JSON",
            raw: cleaned.slice(0, 1000),
          },
          { status: 500 }
        )
      }

      try {
        extracted = JSON.parse(jsonMatch[0])
      } catch {
        return NextResponse.json(
          {
            error: "Failed to parse extracted invoice JSON",
            raw: cleaned.slice(0, 1000),
          },
          { status: 500 }
        )
      }
    }

    // Normalize line items
    if (!Array.isArray(extracted.line_items)) {
      extracted.line_items = []
    }

    extracted.line_items = extracted.line_items.map(
      (item: Partial<LineItem>) => ({
        description: item.description || "Unknown item",
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        total: Number(item.total) || 0,
      })
    )

    // Normalize numeric values
    extracted.subtotal = Number(extracted.subtotal) || 0
    extracted.tax_amount = Number(extracted.tax_amount) || 0
    extracted.total_amount = Number(extracted.total_amount) || 0

    // Defaults without replacing actual extracted values
    extracted.currency = extracted.currency || "INR"
    extracted.category = extracted.category || "other"

    console.log("[extract] SUCCESS:", {
      vendor: extracted.vendor_name,
      invoice_number: extracted.invoice_number,
      subtotal: extracted.subtotal,
      tax: extracted.tax_amount,
      total: extracted.total_amount,
      items: extracted.line_items.length,
    })

    return NextResponse.json({
      success: true,
      data: extracted,
      debug: outputText.slice(0, 1000),
    })
  } catch (error: any) {
    console.error("[extract] Server error:", error)

    return NextResponse.json(
      {
        error: error?.message || "Server error",
      },
      { status: 500 }
    )
  }
}