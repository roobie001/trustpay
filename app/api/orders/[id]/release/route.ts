import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { PaystackError, createTransferRecipient, initiateTransfer } from "@/lib/paystack";
import { PLATFORM_FEE_RATE } from "@/lib/fees";
import { BRAND_NAME } from "@/lib/constants";

export const runtime = "nodejs";

// The buyer confirms delivery from the DISPATCHED stage in this app's flow
// (seller must mark dispatched before the buyer can release funds) — so
// that, not HELD_IN_ESCROW, is the releasable state.
const RELEASABLE_STATUSES = ["DISPATCHED"];

interface ReleaseBody {
  sellerKey?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: ReleaseBody = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine — sellerKey is optional.
  }

  let admin: ReturnType<typeof getSupabaseAdmin>;
  let order: Record<string, unknown> & {
    id: string;
    status: string;
    amount: number;
    delivery_fee: number;
    seller_bank_code: string | null;
    seller_account_number: string | null;
    seller_name: string | null;
  };
  try {
    admin = getSupabaseAdmin();

    const { data, error: fetchError } = await admin
      .from("escrow_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !data) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }
    order = data;

    // A seller must never be able to release their own escrow. Since this
    // app has no login system, link possession is the identity model: the
    // buyer holds the plain /order/[id] link, the seller holds
    // /order/[id]?key=... Reject any request presenting a valid seller key.
    if (body.sellerKey) {
      const { data: secret } = await admin
        .from("escrow_order_secrets")
        .select("seller_secret_key")
        .eq("order_id", id)
        .maybeSingle();
      if (secret && body.sellerKey === secret.seller_secret_key) {
        return NextResponse.json(
          { success: false, error: "Sellers cannot release their own escrow funds." },
          { status: 403 }
        );
      }
    }
  } catch (error) {
    console.error("[release] server error:", error);
    return NextResponse.json(
      { success: false, error: "Server is not configured to process payouts yet." },
      { status: 500 }
    );
  }

  if (!RELEASABLE_STATUSES.includes(order.status)) {
    return NextResponse.json(
      {
        success: false,
        error: `Order cannot be released from status ${order.status}.`,
      },
      { status: 409 }
    );
  }

  if (!order.seller_bank_code || !order.seller_account_number || !order.seller_name) {
    return NextResponse.json(
      { success: false, error: "Seller payout details are incomplete." },
      { status: 422 }
    );
  }

  const grossAmount = Number(order.amount) + Number(order.delivery_fee);
  const netAmount = grossAmount * (1 - PLATFORM_FEE_RATE);
  const netAmountKobo = Math.round(netAmount * 100);

  try {
    const recipient = await createTransferRecipient({
      name: order.seller_name,
      account_number: order.seller_account_number,
      bank_code: order.seller_bank_code,
    });

    const transferReference = `TP-RELEASE-${order.id}-${Date.now()}`;

    const transfer = await initiateTransfer({
      amount: netAmountKobo,
      recipient: recipient.data.recipient_code,
      reference: transferReference,
      reason: `${BRAND_NAME} payout for order ${order.id}`,
    });

    const { data: updated, error: updateError } = await admin
      .from("escrow_orders")
      .update({
        status: "FUNDS_RELEASED",
        transfer_code: transfer.data.transfer_code,
        transfer_reference: transfer.data.reference ?? transferReference,
      })
      .eq("id", order.id)
      .in("status", RELEASABLE_STATUSES)
      .select("*")
      .single();

    if (updateError || !updated) {
      console.error(
        `[release] transfer ${transfer.data.transfer_code} initiated for order ${order.id} but DB update failed:`,
        updateError?.message
      );
      return NextResponse.json(
        {
          success: false,
          error: "Payout was initiated but the order could not be updated. Contact support.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    const message = error instanceof PaystackError ? error.message : "Failed to initiate payout.";
    console.error(`[release] payout failed for order ${order.id}:`, message);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
