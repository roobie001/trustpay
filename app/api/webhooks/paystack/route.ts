import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

interface PaystackChargeSuccessData {
  reference: string;
  paid_at: string | null;
  metadata?: { order_id?: string; buyer_name?: string } | null;
}

interface PaystackWebhookEvent {
  event: string;
  data: PaystackChargeSuccessData;
}

function isValidSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(request: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error("[paystack webhook] PAYSTACK_SECRET_KEY is not configured.");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!signature || !isValidSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.event === "charge.success") {
    const { reference, paid_at, metadata } = event.data;
    const orderId = metadata?.order_id;

    if (!orderId) {
      console.warn(
        `[paystack webhook] charge.success with no metadata.order_id (ref=${reference})`
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    try {
      const { data, error } = await getSupabaseAdmin()
        .from("escrow_orders")
        .update({
          status: "HELD_IN_ESCROW",
          paystack_reference: reference,
          paid_at: paid_at ?? new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("status", "PENDING_PAYMENT")
        .select("id")
        .maybeSingle();

      if (error) {
        console.error(`[paystack webhook] failed to update order ${orderId}:`, error.message);
      } else if (data) {
        console.log(
          `[paystack webhook] order ${orderId} funded. ref=${reference} paid_at=${paid_at ?? "unknown"}`
        );
      } else {
        console.log(
          `[paystack webhook] order ${orderId} already processed or not PENDING_PAYMENT. ref=${reference}`
        );
      }
    } catch (error) {
      console.error(`[paystack webhook] server error updating order ${orderId}:`, error);
      // Return 5xx (not the 200 below) so Paystack retries this delivery
      // instead of the payment silently never crediting the order.
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
