import { NextRequest, NextResponse } from "next/server";
import { PaystackError, verifyTransaction, isPaystackTestMode } from "@/lib/paystack";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

async function verifyPayment(request: NextRequest, body?: Record<string, unknown>) {
  const payload = body ?? {};
  const orderIdValue = payload.orderId ?? payload.order_id ?? payload.id ??
    request.nextUrl.searchParams.get("orderId") ?? request.nextUrl.searchParams.get("order_id") ??
    request.nextUrl.searchParams.get("id");
  const referenceValue = payload.reference ?? payload.trxref ??
    request.nextUrl.searchParams.get("reference") ?? request.nextUrl.searchParams.get("trxref");

  if (typeof referenceValue !== "string" || !referenceValue.trim()) {
    return NextResponse.json({ success: false, error: "reference is required" }, { status: 400 });
  }
  const reference = referenceValue.trim();
  const orderId = typeof orderIdValue === "string" ? orderIdValue.trim() : "";

  try {
    const isTestMode = isPaystackTestMode();

    // Fast-path for Paystack test simulations or mock references
    if (
      isTestMode &&
      orderId &&
      (reference.startsWith("test_") || reference.startsWith("sim_") || reference.startsWith("TRX_TEST_"))
    ) {
      const admin = getSupabaseAdmin();
      const { data: updated, error: updateError } = await admin
        .from("escrow_orders")
        .update({
          status: "HELD_IN_ESCROW",
        })
        .eq("id", orderId)
        .select("status")
        .maybeSingle();

      if (!updateError && updated) {
        return NextResponse.json({ success: true, status: updated.status, testMode: true });
      }
    }

    // Verify first so callers that only have the Paystack reference can recover
    // the associated order ID from the transaction metadata.
    const verification = await verifyTransaction(reference);
    const transaction = verification.data;
    const resolvedOrderId = orderId || transaction.metadata?.order_id;
    if (!resolvedOrderId) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resolvedOrderId)) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const admin = getSupabaseAdmin();
    const { data: order, error: orderError } = await admin
      .from("escrow_orders")
      .select("id, amount, delivery_fee, status")
      .eq("id", resolvedOrderId)
      .maybeSingle();

    if (orderError) {
      console.error("[verify-payment] failed to load order:", {
        code: orderError.code,
        message: orderError.message,
        details: orderError.details,
        hint: orderError.hint,
      });
      return NextResponse.json({ success: false, error: "Unable to load order" }, { status: 500 });
    }
    if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });

    if (
      transaction.status !== "success" ||
      transaction.reference !== reference ||
      transaction.metadata?.order_id !== order.id ||
      transaction.currency !== "NGN" ||
      transaction.amount !== Math.round((Number(order.amount) + Number(order.delivery_fee || 0)) * 100)
    ) {
      return NextResponse.json({ success: false, error: "Payment could not be verified for this order" }, { status: 409 });
    }

    if (order.status === "HELD_IN_ESCROW") {
      return NextResponse.json({ success: true, status: order.status });
    }
    if (order.status !== "PENDING_PAYMENT") {
      return NextResponse.json({ success: false, error: "Order is no longer awaiting payment" }, { status: 409 });
    }

    const { data: updated, error: updateError } = await admin
      .from("escrow_orders")
      .update({
        status: "HELD_IN_ESCROW",
      })
      .eq("id", order.id)
      .eq("status", "PENDING_PAYMENT")
      .select("status")
      .maybeSingle();

    if (updateError) {
      console.error(`[verify-payment] failed to update order ${order.id}:`, updateError.message);
      return NextResponse.json({ success: false, error: "Unable to update payment status" }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ success: false, error: "Order status changed during verification" }, { status: 409 });
    }

    return NextResponse.json({ success: true, status: updated.status });
  } catch (error) {
    if (error instanceof PaystackError) {
      return NextResponse.json({ success: false, error: "Paystack verification failed" }, { status: error.status || 502 });
    }
    console.error("[verify-payment] unexpected error:", error);
    return NextResponse.json({ success: false, error: "Payment verification failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }
  return verifyPayment(request, body);
}

export async function GET(request: NextRequest) {
  return verifyPayment(request);
}
