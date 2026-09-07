import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/app/utils/supabase/server"

type VendorPayload = {
  name?: string
  gstin?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  industry?: string | null
}

const fields = "id, name, gstin, email, phone, address, industry, created_at, updated_at"

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim() || null : null

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const search = request.nextUrl.searchParams.get("search")?.trim() ?? ""
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 100), 1), 100)

  let query = supabase
    .from("vendors")
    .select(fields)
    .eq("user_id", user.id)
    .order("name", { ascending: true })
    .limit(limit)

  if (search) query = query.ilike("name", `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ vendors: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json() as VendorPayload
  const name = clean(body.name)

  if (!name) {
    return NextResponse.json({ error: "Vendor name is required." }, { status: 400 })
  }

  const vendor = {
    user_id: user.id,
    name,
    gstin: clean(body.gstin)?.toUpperCase() ?? null,
    email: clean(body.email)?.toLowerCase() ?? null,
    phone: clean(body.phone),
    address: clean(body.address),
    industry: clean(body.industry),
  }

  let lookup = supabase.from("vendors").select("id").eq("user_id", user.id)
  lookup = vendor.gstin ? lookup.eq("gstin", vendor.gstin) : lookup.ilike("name", name)

  const { data: existing, error: lookupError } = await lookup.maybeSingle()
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })

  const operation = existing
    ? supabase.from("vendors").update(vendor).eq("id", existing.id).eq("user_id", user.id)
    : supabase.from("vendors").insert(vendor)

  const { data, error } = await operation.select(fields).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ vendor: data, created: !existing }, { status: existing ? 200 : 201 })
}
