import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

// Checks a `?key=` query param against the order's seller secret key, which
// lives in the RLS-locked escrow_order_secrets table (never exposed to
// clients directly). Only ever returns a boolean — the key itself is never
// echoed back, so this route is safe to call from the browser.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const key = request.nextUrl.searchParams.get("key");

  if (!key) {
    return NextResponse.json({ isSeller: false });
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("escrow_order_secrets")
      .select("seller_secret_key")
      .eq("order_id", id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ isSeller: false });
    }

    return NextResponse.json({ isSeller: safeEqual(key, data.seller_secret_key) });
  } catch (error) {
    console.error("[verify-seller] server error:", error);
    return NextResponse.json({ isSeller: false }, { status: 500 });
  }
}
