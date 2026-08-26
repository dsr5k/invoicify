import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 60
export const runtime = "nodejs"

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.1-flash-lite"

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

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

    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      )
    }

    const mimeType = file.type || "application/pdf"

    if (!ALLOWED_TYPES.has(mimeType)) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Please upload PDF, JPG, JPEG, PNG, WEBP, HEIC, or HEIF.",
        },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()

    // Protect server/API from extremely large uploads
    const MAX_FILE_SIZE = 20 * 1024 * 1024

    if (bytes.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "File is too large. Maximum supported size is 20MB.",
        },
        { status: 400 }
      )
    }

    const base64 = Buffer.from(bytes).toString("base64")

    console.log("[extract] Starting Gemini extraction:", {
      file: file.name,
      type: mimeType,
      sizeKB: Math.round(bytes.byteLength / 1024),
      model: GEMINI_MODEL,
    })

    const prompt = `
You are an expert invoice and GST document extraction engine.

Analyze the uploaded invoice/document carefully.

Extract ONLY information that actually exists in the document.
Do not invent, estimate, hallucinate, or replace missing values with zero.

Return ONLY valid JSON.
No markdown.
No code fences.
No explanation before or after the JSON.

Use exactly this schema:

{
  "vendor_name": "string or null",
  "invoice_number": "string or null",
  "date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "subtotal": "number or null",
  "tax_amount": "number or null",
  "total_amount": "number or null",
  "currency": "string or null",
  "category": "travel | food | office_supplies | software | marketing | utilities | rent | salaries | services | other",
  "line_items": [
    {
      "description": "string",
      "quantity": "number or null",
      "unit_price": "number or null",
      "total": "number or null"
    }
  ],
  "notes": "string or null",
  "gstin_vendor": "string or null",
  "gstin_customer": "string or null",
  "cgst_amount": "number or null",
  "sgst_amount": "number or null",
  "igst_amount": "number or null"
}

RULES:

1. Read every visible number carefully.
2. Extract the actual GRAND TOTAL / FINAL AMOUNT.
3. Do not return 0 unless the document explicitly shows 0.
4. If a value is unavailable, use null.
5. Preserve all line items you can identify.
6. Convert dates to YYYY-MM-DD only when the date can be determined reliably.
7. Currency should be INR for ₹ Indian invoices unless another currency is clearly shown.
8. GST values must be extracted separately when present.
9. For Indian GST invoices, identify CGST, SGST, IGST, GSTIN where available.
10. Ensure subtotal + applicable taxes approximately matches total_amount when all values are available.
11. Do not include commentary, confidence scores, or additional fields.
12. Return syntactically valid JSON.
`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()

      console.error(
        "[extract] Gemini API error:",
        response.status,
        errorText.slice(0, 1000)
      )

      let errorMessage = `Gemini API error: ${response.status}`

      if (response.status === 429) {
        errorMessage =
          "AI request limit reached. Please wait a moment and try again."
      }

      if (response.status === 503) {
        errorMessage =
          "AI model is currently busy. Please try again in a few moments."
      }

      return NextResponse.json(
        {
          error: errorMessage,
          status: response.status,
        },
        { status: response.status >= 500 ? 503 : response.status }
      )
    }

    const result = await response.json()

    const text =
      result.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || "")
        .join("") || ""

    if (!text.trim()) {
      console.error(
        "[extract] Empty Gemini response:",
        JSON.stringify(result).slice(0, 1000)
      )

      return NextResponse.json(
        {
          error: "Gemini could not extract data from this document",
        },
        { status: 500 }
      )
    }

    console.log(
      "[extract] Gemini response:",
      text.slice(0, 1000)
    )

    let cleaned = text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    try {
      const extracted = JSON.parse(cleaned)

      console.log("[extract] SUCCESS:", {
        vendor: extracted.vendor_name,
        invoice: extracted.invoice_number,
        total: extracted.total_amount,
        items: extracted.line_items?.length || 0,
      })

      return NextResponse.json({
        success: true,
        data: extracted,
      })
    } catch {
      // Fallback: try to locate JSON object inside response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        try {
          const extracted = JSON.parse(jsonMatch[0])

          return NextResponse.json({
            success: true,
            data: extracted,
          })
        } catch {
          // Continue to error response
        }
      }

      console.error(
        "[extract] Failed to parse JSON:",
        cleaned.slice(0, 1000)
      )

      return NextResponse.json(
        {
          error: "Failed to parse AI extraction response",
          raw: cleaned.slice(0, 500),
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("[extract] Server error:", error)

    return NextResponse.json(
      {
        error: error?.message || "Internal server error",
      },
      { status: 500 }
    )
  }
}
