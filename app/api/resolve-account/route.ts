import { NextRequest, NextResponse } from "next/server";
import { PaystackError, resolveAccountNumber, isPaystackTestMode } from "@/lib/paystack";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const accountNumber = request.nextUrl.searchParams.get("account_number");
  const bankCode = request.nextUrl.searchParams.get("bank_code");

  if (!accountNumber || !/^\d{10}$/.test(accountNumber)) {
    return NextResponse.json(
      { success: false, error: "account_number must be exactly 10 digits." },
      { status: 400 }
    );
  }

  if (!bankCode) {
    return NextResponse.json(
      { success: false, error: "bank_code is required." },
      { status: 400 }
    );
  }

  try {
    const result = await resolveAccountNumber(accountNumber, bankCode);
    return NextResponse.json({ success: true, account_name: result.data.account_name });
  } catch (error) {
    // In Paystack test mode, if NIBSS live resolution fails or dummy account is tested,
    // gracefully resolve with a test beneficiary so test escrow links can be generated seamlessly.
    if (isPaystackTestMode()) {
      return NextResponse.json({
        success: true,
        account_name: "TEST ACCOUNT BENEFICIARY (PAYSTACK TEST)",
        isTestMode: true,
      });
    }

    if (error instanceof PaystackError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to resolve account at this time." },
      { status: 502 }
    );
  }
}
