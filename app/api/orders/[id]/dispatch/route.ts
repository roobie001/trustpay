import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { sellerKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.sellerKey !== "string" || !body.sellerKey) {
    return NextResponse.json({ success: false, error: "Seller authorization is required." }, { status: 403 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: secret, error: secretError } = await admin
      .from("escrow_order_secrets")
      .select("seller_secret_key")
      .eq("order_id", id)
      .maybeSingle();
    if (secretError) throw secretError;
    if (!secret || secret.seller_secret_key !== body.sellerKey) {
      return NextResponse.json({ success: false, error: "Invalid seller authorization." }, { status: 403 });
    }

    const { data: order, error } = await admin
      .from("escrow_orders")
      .update({ status: "DISPATCHED" })
      .eq("id", id)
      .eq("status", "HELD_IN_ESCROW")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!order) {
      return NextResponse.json({ success: false, error: "Order is not ready to dispatch." }, { status: 409 });
    }
    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error(`[dispatch] failed for order ${id}:`, error);
    return NextResponse.json({ success: false, error: "Unable to update order status." }, { status: 500 });
  }
}
