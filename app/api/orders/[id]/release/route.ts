import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { PaystackError, createTransferRecipient, initiateTransfer, isPaystackTestMode } from "@/lib/paystack";
import { BRAND_NAME } from "@/lib/constants";

export const runtime = "nodejs";

const RELEASABLE_STATUSES = ["HELD_IN_ESCROW", "DISPATCHED"];

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
  const amountKobo = Math.round(grossAmount * 100);

  const isTestMode = isPaystackTestMode();

  // In Paystack test mode, do not call live transfer endpoints which fail on
  // starter business accounts or test NUBAN accounts. Transition the escrow
  // directly in Supabase so testing proceeds without interruption.
  if (isTestMode) {
    console.log(`[release test mode] settling escrow release for order ${order.id}`);
    const { data: updated, error: updateError } = await admin
      .from("escrow_orders")
      .update({
        status: "FUNDS_RELEASED",
      })
      .eq("id", order.id)
      .in("status", RELEASABLE_STATUSES)
      .select("*")
      .maybeSingle();

    if (updateError || !updated) {
      console.error(
        `[release test mode] failed to update order ${order.id}:`,
        updateError?.message
      );
      return NextResponse.json(
        { success: false, error: "Failed to update order status." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order: updated,
      testMode: true,
      transfer_code: `TRF_test_${Date.now()}`,
      transfer_reference: `payout_${order.id}`,
    });
  }

  // Paystack Live Mode:
  try {
    const recipient = await createTransferRecipient({
      name: order.seller_name,
      account_number: order.seller_account_number,
      bank_code: order.seller_bank_code,
    });

    const transferReference = `payout_${order.id}`;

    const transfer = await initiateTransfer({
      amount: amountKobo,
      recipient: recipient.data.recipient_code,
      reference: transferReference,
      reason: `${BRAND_NAME} Escrow Payout - ${String(order.item_title)}`,
    });

    const { data: updated, error: updateError } = await admin
      .from("escrow_orders")
      .update({
        status: "FUNDS_RELEASED",
      })
      .eq("id", order.id)
      .in("status", RELEASABLE_STATUSES)
      .select("*")
      .maybeSingle();

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

    return NextResponse.json({
      success: true,
      order: updated,
      transfer_code: transfer.data.transfer_code,
      transfer_reference: transfer.data.reference ?? transferReference,
    });
  } catch (error) {
    const message =
      error instanceof PaystackError
        ? error.message
        : error instanceof Error
        ? error.message
        : "Failed to initiate payout.";

    const isStarterBusiness =
      message.toLowerCase().includes("starter business") ||
      message.toLowerCase().includes("third party payout") ||
      message.toLowerCase().includes("transfer_unavailable");

    // If Paystack rejects automated transfer because the account is a Starter Business
    // (unregistered business without CAC verification), complete the escrow release in DB
    // so buyer checkout is satisfied, and the seller can be disbursed manually.
    if (isStarterBusiness) {
      console.warn(
        `[release] Starter Business restriction for order ${order.id}. Releasing escrow for manual payout settlement.`
      );

      const { data: updated, error: updateError } = await admin
        .from("escrow_orders")
        .update({
          status: "FUNDS_RELEASED",
        })
        .eq("id", order.id)
        .in("status", RELEASABLE_STATUSES)
        .select("*")
        .maybeSingle();

      if (!updateError && updated) {
        return NextResponse.json({
          success: true,
          order: updated,
          starterBusiness: true,
          notice:
            "Escrow released. Paystack Starter Business tier requires manual bank transfer settlement or upgrading to a Registered Business with CAC.",
        });
      }
    }

    console.error(`[release] payout failed for order ${order.id}:`, message);
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
