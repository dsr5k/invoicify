import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"

type LineItem = {
  description: string
  quantity: number
  unit_price: number
  total: number
}

type Invoice = {
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

  tax_details: {
    cgst: number
    sgst: number
    igst: number
    other_tax: number
  }

  line_items: LineItem[]

  notes: string | null

  source_pages: number[]

  validation: {
    calculated_total: number
    difference: number
    status: "verified" | "review"
  }
}

export async function POST(request: Request) {
  try {
    console.log("========================================")
    console.log("INVOICE BATCH EXTRACTION START")
    console.log("========================================")

    // ---------------------------------------------------------
    // 1. GEMINI API KEY
    // ---------------------------------------------------------

    const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "GEMINI_API_KEY is missing",
        },
        { status: 500 }
      )
    }

    // ---------------------------------------------------------
    // 2. RECEIVE FILE
    // ---------------------------------------------------------

    const formData = await request.formData()

    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "No file received",
        },
        { status: 400 }
      )
    }

    console.log("File:", file.name)
    console.log("Type:", file.type)
    console.log("Size:", file.size)

    // ---------------------------------------------------------
    // 3. VALIDATE FILE TYPE
    // ---------------------------------------------------------

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type: ${file.type}`,
        },
        { status: 400 }
      )
    }

    // ---------------------------------------------------------
    // 4. FILE SIZE
    // ---------------------------------------------------------

    const MAX_FILE_SIZE = 50 * 1024 * 1024

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "File is larger than 50 MB",
        },
        { status: 400 }
      )
    }

    // ---------------------------------------------------------
    // 5. CONVERT FILE TO BASE64
    // ---------------------------------------------------------

    const buffer = Buffer.from(await file.arrayBuffer())

    const base64 = buffer.toString("base64")

    // ---------------------------------------------------------
    // 6. GEMINI
    // ---------------------------------------------------------

    const ai = new GoogleGenAI({
      apiKey,
    })

    // ---------------------------------------------------------
    // 7. EXTRACTION PROMPT
    // ---------------------------------------------------------

    const prompt = `
You are the invoice/document extraction engine for an accounting application.

IMPORTANT:

The uploaded file may contain:

- one invoice
- multiple invoices
- multiple bills
- multiple receipts
- multiple pages belonging to different invoices

You MUST identify every separate invoice/bill/receipt in the uploaded document.

DO NOT combine multiple invoices into one invoice.

For example:

If a PDF contains 10 separate invoices, return 10 objects inside "documents".

Each document must be completely independent.

Return ONLY valid JSON.

Use exactly this structure:

{
  "documents": [
    {
      "vendor_name": "",
      "invoice_number": "",
      "date": "",
      "due_date": null,

      "subtotal": 0,
      "discount": 0,
      "tax_amount": 0,
      "total_amount": 0,

      "currency": "INR",
      "category": "other",

      "tax_details": {
        "cgst": 0,
        "sgst": 0,
        "igst": 0,
        "other_tax": 0
      },

      "line_items": [
        {
          "description": "",
          "quantity": 0,
          "unit_price": 0,
          "total": 0
        }
      ],

      "notes": null,

      "source_pages": []
    }
  ]
}

==================================================
EXTRACTION RULES
==================================================

1. Detect EVERY separate invoice.

2. NEVER merge two invoices.

3. If two invoices belong to the same vendor, they must still be separate documents.

4. Extract the vendor/company name.

5. Extract invoice number exactly as printed.

6. Extract invoice date.

7. Extract due date if available.

8. Extract subtotal exactly as printed.

9. Extract discount exactly as printed.

10. Extract total tax.

11. Extract final invoice total exactly as printed.

12. Extract currency.

13. Extract every line item.

14. Extract quantity.

15. Extract unit price.

16. Extract line-item total.

17. Extract CGST separately.

18. Extract SGST separately.

19. Extract IGST separately.

20. Extract any other tax separately.

21. Identify the invoice category where possible.

22. Record the page number(s) containing each invoice.

23. Do NOT invent information.

24. Missing text = "".

25. Missing numeric value = 0.

26. Missing date = "".

27. Missing due date = null.

28. All numeric fields must be actual numbers.

29. Do NOT include currency symbols inside numbers.

30. Do NOT put commas inside numeric values.

Correct:
12200

Incorrect:
"₹12,200"

31. Do NOT calculate totals yourself unless the document explicitly provides them.

32. The printed invoice total is the source of truth.

==================================================
MULTI-PAGE RULE
==================================================

An invoice may occupy multiple pages.

If pages 1 and 2 belong to the same invoice:

"source_pages": [1, 2]

Do NOT create two invoices.

If page 1 contains invoice A and page 2 contains invoice B:

Create two separate objects.

==================================================
IMPORTANT
==================================================

The final "documents" array must contain EVERY invoice detected in the uploaded file.

If there are 10 invoices, return 10 objects.

If there is 1 invoice, return 1 object.
`

    console.log("Calling Gemini...")

    // ---------------------------------------------------------
    // 8. CALL GEMINI
    // ---------------------------------------------------------

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      // console.log("Gemini model:", "gemini-3.6-flash"),

      contents: [
        {
          role: "user",

          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64,
              },
            },

            {
              text: prompt,
            },
          ],
        },
      ],

      config: {
        responseMimeType: "application/json",
      },
    })

    console.log("Gemini responded")

    // ---------------------------------------------------------
    // 9. GET RESPONSE
    // ---------------------------------------------------------

    const text = response.text?.trim()

    if (!text) {
      console.error("Gemini returned empty response")

      return NextResponse.json(
        {
          success: false,
          error: "Gemini returned an empty response",
        },
        { status: 500 }
      )
    }

    console.log("Gemini response length:", text.length)

    // ---------------------------------------------------------
    // 10. PARSE JSON
    // ---------------------------------------------------------

    let parsed: any

    try {
      parsed = JSON.parse(text)
    } catch (error) {
      console.error("Gemini returned invalid JSON")
      console.error(text)

      return NextResponse.json(
        {
          success: false,
          error: "Gemini returned invalid JSON",
          raw_response: text,
        },
        { status: 502 }
      )
    }

    // ---------------------------------------------------------
    // 11. VALIDATE DOCUMENT ARRAY
    // ---------------------------------------------------------

    if (!Array.isArray(parsed.documents)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini response did not contain a documents array",
          raw_response: parsed,
        },
        { status: 500 }
      )
    }

    console.log(
      "Invoices detected:",
      parsed.documents.length
    )

    // ---------------------------------------------------------
    // 12. NORMALIZE + CALCULATE
    // ---------------------------------------------------------

    const documents: Invoice[] = parsed.documents.map(
      (invoice: any) => {

        const subtotal =
          Number(invoice.subtotal) || 0

        const discount =
          Number(invoice.discount) || 0

        const taxAmount =
          Number(invoice.tax_amount) || 0

        const printedTotal =
          Number(invoice.total_amount) || 0

        // -----------------------------------------------------
        // TAX DETAILS
        // -----------------------------------------------------

        const cgst =
          Number(invoice.tax_details?.cgst) || 0

        const sgst =
          Number(invoice.tax_details?.sgst) || 0

        const igst =
          Number(invoice.tax_details?.igst) || 0

        const otherTax =
          Number(invoice.tax_details?.other_tax) || 0

        // -----------------------------------------------------
        // LINE ITEMS
        // -----------------------------------------------------

        const lineItems: LineItem[] =
          Array.isArray(invoice.line_items)
            ? invoice.line_items.map((item: any) => ({
                description:
                  typeof item.description === "string"
                    ? item.description
                    : "",

                quantity:
                  Number(item.quantity) || 0,

                unit_price:
                  Number(item.unit_price) || 0,

                total:
                  Number(item.total) || 0,
              }))
            : []

        // -----------------------------------------------------
        // DETERMINISTIC CALCULATION
        // -----------------------------------------------------

        const calculatedTotal =
          subtotal -
          discount +
          taxAmount

        const difference =
          Math.round(
            (printedTotal - calculatedTotal) *
              100
          ) / 100

        const validationStatus =
          Math.abs(difference) <= 1
            ? "verified"
            : "review"

        return {
          vendor_name:
            typeof invoice.vendor_name === "string"
              ? invoice.vendor_name
              : "",

          invoice_number:
            typeof invoice.invoice_number === "string"
              ? invoice.invoice_number
              : "",

          date:
            typeof invoice.date === "string"
              ? invoice.date
              : "",

          due_date:
            typeof invoice.due_date === "string"
              ? invoice.due_date
              : null,

          subtotal,

          discount,

          tax_amount: taxAmount,

          total_amount: printedTotal,

          currency:
            typeof invoice.currency === "string"
              ? invoice.currency
              : "INR",

          category:
            typeof invoice.category === "string"
              ? invoice.category
              : "other",

          tax_details: {
            cgst,
            sgst,
            igst,
            other_tax: otherTax,
          },

          line_items: lineItems,

          notes:
            typeof invoice.notes === "string"
              ? invoice.notes
              : null,

          source_pages:
            Array.isArray(invoice.source_pages)
              ? invoice.source_pages
                  .map((page: any) =>
                    Number(page)
                  )
                  .filter(
                    (page: number) =>
                      Number.isFinite(page)
                  )
              : [],

          validation: {
            calculated_total: calculatedTotal,
            difference,
            status: validationStatus,
          },
        }
      }
    )

    // ---------------------------------------------------------
    // 13. BATCH TOTALS
    // ---------------------------------------------------------

    const batchSubtotal = documents.reduce(
      (sum, invoice) =>
        sum + invoice.subtotal,
      0
    )

    const batchDiscount = documents.reduce(
      (sum, invoice) =>
        sum + invoice.discount,
      0
    )

    const batchTax = documents.reduce(
      (sum, invoice) =>
        sum + invoice.tax_amount,
      0
    )

    const batchTotal = documents.reduce(
      (sum, invoice) =>
        sum + invoice.total_amount,
      0
    )

    const verifiedCount = documents.filter(
      (invoice) =>
        invoice.validation.status ===
        "verified"
    ).length

    const reviewCount = documents.filter(
      (invoice) =>
        invoice.validation.status ===
        "review"
    ).length

    // ---------------------------------------------------------
    // 14. FINAL RESPONSE
    // ---------------------------------------------------------

    const result = {
      file_name: file.name,

      invoice_count: documents.length,

      documents,

      summary: {
        subtotal: batchSubtotal,
        discount: batchDiscount,
        tax: batchTax,
        total: batchTotal,

        verified: verifiedCount,

        needs_review: reviewCount,
      },
    }

    console.log("========================================")
    console.log(
      "EXTRACTION COMPLETE:",
      documents.length,
      "invoice(s)"
    )
    console.log("SUMMARY:", result.summary)
    console.log("========================================")

    return NextResponse.json({
      success: true,
      data: result,
    })

  } catch (error: any) {

    console.error("========================================")
    console.error("INVOICE EXTRACTION ERROR")
    console.error(error)
    console.error("========================================")

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Invoice extraction failed",
      },
      { status: 500 }
    )
  }
}
