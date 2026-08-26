import { GoogleGenAI } from "@google/genai"
import { NextResponse } from "next/server"

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
})

export async function POST(request: Request) {
  try {
    // Check API key
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY is not configured on the server.",
        },
        { status: 500 }
      )
    }

    // Read uploaded form
    const formData = await request.formData()

    const file =
      (formData.get("file") as File | null) ||
      (formData.get("invoice") as File | null) ||
      (formData.get("document") as File | null)

    if (!file) {
      return NextResponse.json(
        {
          error: "No invoice file was uploaded.",
        },
        { status: 400 }
      )
    }

    // Supported formats
    const supportedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ]

    if (!supportedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type}. Please upload PDF, JPG, PNG or WEBP.`,
        },
        { status: 400 }
      )
    }

    // Keep initial testing reasonably sized.
    // Gemini supports inline PDF input up to 50 MB.
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: "File is too large. Maximum supported size is 50 MB.",
        },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString("base64")

    const prompt = `
You are an expert invoice data extraction system.

Analyze the uploaded invoice carefully.

Extract the invoice information and return ONLY valid JSON.

Do not use markdown.
Do not wrap the JSON in backticks.
Do not invent information.
If a field is missing, return null.

Return exactly this structure:

{
  "vendor": {
    "name": null,
    "gstin": null,
    "email": null,
    "phone": null,
    "address": null
  },
  "customer": {
    "name": null,
    "gstin": null,
    "email": null,
    "phone": null,
    "address": null
  },
  "invoice": {
    "number": null,
    "date": null,
    "due_date": null,
    "currency": null,
    "po_number": null
  },
  "items": [
    {
      "description": null,
      "quantity": null,
      "unit_price": null,
      "tax_rate": null,
      "amount": null
    }
  ],
  "summary": {
    "subtotal": null,
    "discount": null,
    "tax": null,
    "total": null
  },
  "payment": {
    "status": null,
    "method": null,
    "terms": null
  },
  "notes": null
}

Important:
- Preserve invoice numbers exactly.
- Preserve GSTIN exactly when visible.
- Extract every line item.
- Do not combine separate line items.
- Quantity should be numeric.
- Unit price should be numeric.
- Amount should be numeric.
- Tax rate should be numeric.
- subtotal, discount, tax and total should be numeric.
- Detect INR, USD, EUR, GBP etc.
- For Indian invoices, distinguish CGST/SGST/IGST when possible and include the combined tax amount in "tax".
`

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          inlineData: {
            mimeType: file.type,
            data: base64Data,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    })

    const text = response.text?.trim()

    if (!text) {
      return NextResponse.json(
        {
          error: "Gemini returned an empty response.",
        },
        { status: 502 }
      )
    }

    let extractedData

    try {
      extractedData = JSON.parse(text)
    } catch {
      console.error("Gemini returned invalid JSON:", text)

      return NextResponse.json(
        {
          error: "Gemini returned invalid JSON.",
          raw: text,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      mimeType: file.type,
      data: extractedData,
    })
  } catch (error) {
    console.error("Invoice extraction error:", error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process invoice.",
      },
      { status: 500 }
    )
  }
}