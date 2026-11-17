import { NextRequest, NextResponse } from "next/server";
import { PaystackError, verifyTransaction } from "@/lib/paystack";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { orderId?: unknown; reference?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { orderId, reference } = body;
  if (typeof orderId !== "string" || typeof reference !== "string" || !reference.trim()) {
    return NextResponse.json({ error: "orderId and reference are required" }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { data: order, error: orderError } = await admin
      .from("escrow_orders")
      .select("id, amount, delivery_fee, status, paystack_reference")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error("[verify-payment] failed to load order:", orderError.message);
      return NextResponse.json({ error: "Unable to load order" }, { status: 500 });
    }
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const verification = await verifyTransaction(reference.trim());
    const transaction = verification.data;
    if (
      transaction.status !== "success" ||
      transaction.reference !== reference.trim() ||
      transaction.metadata?.order_id !== order.id ||
      transaction.currency !== "NGN" ||
      transaction.amount !== Math.round((Number(order.amount) + Number(order.delivery_fee || 0)) * 100)
    ) {
      return NextResponse.json({ error: "Payment could not be verified for this order" }, { status: 409 });
    }

    if (order.status === "HELD_IN_ESCROW" && order.paystack_reference === reference.trim()) {
      return NextResponse.json({ success: true, status: order.status });
    }
    if (order.status !== "PENDING_PAYMENT") {
      return NextResponse.json({ error: "Order is no longer awaiting payment" }, { status: 409 });
    }

    const { data: updated, error: updateError } = await admin
      .from("escrow_orders")
      .update({
        status: "HELD_IN_ESCROW",
        paystack_reference: transaction.reference,
        paid_at: transaction.paid_at ?? new Date().toISOString(),
      })
      .eq("id", order.id)
      .eq("status", "PENDING_PAYMENT")
      .select("status")
      .maybeSingle();

    if (updateError) {
      console.error(`[verify-payment] failed to update order ${order.id}:`, updateError.message);
      return NextResponse.json({ error: "Unable to update payment status" }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "Order status changed during verification" }, { status: 409 });
    }

    return NextResponse.json({ success: true, status: updated.status });
  } catch (error) {
    if (error instanceof PaystackError) {
      return NextResponse.json({ error: "Paystack verification failed" }, { status: error.status || 502 });
    }
    console.error("[verify-payment] unexpected error:", error);
    return NextResponse.json({ error: "Payment verification failed" }, { status: 500 });
  }
}
