import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { bankNameForCode } from "@/lib/banks";

export const runtime = "nodejs";

interface CreateOrderBody {
  item_title?: string;
  amount?: number;
  delivery_fee?: number;
  seller_name?: string;
  seller_phone?: string;
  seller_bank_code?: string;
  seller_account_number?: string;
}

export async function POST(request: NextRequest) {
  let body: CreateOrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    item_title,
    amount,
    delivery_fee = 0,
    seller_name,
    seller_phone,
    seller_bank_code,
    seller_account_number,
  } = body;

  if (
    !item_title?.trim() ||
    !seller_name?.trim() ||
    !seller_phone?.trim() ||
    !seller_bank_code?.trim() ||
    !seller_account_number?.trim()
  ) {
    return NextResponse.json(
      { success: false, error: "Missing required order fields." },
      { status: 400 }
    );
  }

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { success: false, error: "amount must be a positive number." },
      { status: 400 }
    );
  }

  if (typeof delivery_fee !== "number" || !Number.isFinite(delivery_fee) || delivery_fee < 0) {
    return NextResponse.json(
      { success: false, error: "delivery_fee must be a non-negative number." },
      { status: 400 }
    );
  }

  if (!/^\d{10}$/.test(seller_account_number)) {
    return NextResponse.json(
      { success: false, error: "seller_account_number must be exactly 10 digits." },
      { status: 400 }
    );
  }

  const sellerBankName = bankNameForCode(seller_bank_code);
  if (!sellerBankName) {
    return NextResponse.json(
      { success: false, error: "Unrecognized seller_bank_code." },
      { status: 400 }
    );
  }

  try {
    const admin = getSupabaseAdmin();

    const { data: order, error: insertError } = await admin
      .from("escrow_orders")
      .insert({
        item_title: item_title.trim(),
        amount,
        delivery_fee,
        seller_name: seller_name.trim(),
        seller_phone: seller_phone.trim(),
        seller_bank: sellerBankName,
        seller_bank_code,
        seller_account_number,
      })
      .select("id")
      .single();

    if (insertError || !order) {
      return NextResponse.json(
        { success: false, error: insertError?.message ?? "Failed to create order." },
        { status: 500 }
      );
    }

    const sellerSecretKey = randomUUID();

    const { error: secretError } = await admin
      .from("escrow_order_secrets")
      .insert({ order_id: order.id, seller_secret_key: sellerSecretKey });

    if (secretError) {
      // Don't leave an order behind that the seller can never manage.
      await admin.from("escrow_orders").delete().eq("id", order.id);
      return NextResponse.json(
        { success: false, error: "Failed to secure the new order. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: order.id, sellerKey: sellerSecretKey });
  } catch (error) {
    console.error("[orders] server error:", error);
    return NextResponse.json(
      { success: false, error: "Server is not configured to create orders yet." },
      { status: 500 }
    );
  }
}
