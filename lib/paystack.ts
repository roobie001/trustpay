// Server-only. Never import this file from a "use client" component —
// PAYSTACK_SECRET_KEY must never reach the browser bundle.
const PAYSTACK_BASE_URL = "https://api.paystack.co";

export class PaystackError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PaystackError";
    this.status = status;
  }
}

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("Missing PAYSTACK_SECRET_KEY environment variable (server-only).");
  }
  return key;
}

async function paystackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json || json.status === false) {
    const message = json?.message ?? `Paystack request failed (${res.status})`;
    throw new PaystackError(message, res.status || 502);
  }

  return json as T;
}

export interface ResolvedAccount {
  account_number: string;
  account_name: string;
  bank_id: number;
}

export function resolveAccountNumber(accountNumber: string, bankCode: string) {
  const params = new URLSearchParams({
    account_number: accountNumber,
    bank_code: bankCode,
  });
  return paystackFetch<{ status: boolean; message: string; data: ResolvedAccount }>(
    `/bank/resolve?${params.toString()}`
  );
}

export interface TransferRecipientData {
  recipient_code: string;
  active: boolean;
}

export function createTransferRecipient(input: {
  name: string;
  account_number: string;
  bank_code: string;
}) {
  return paystackFetch<{ status: boolean; message: string; data: TransferRecipientData }>(
    "/transferrecipient",
    {
      method: "POST",
      body: JSON.stringify({ type: "nuban", currency: "NGN", ...input }),
    }
  );
}

export interface TransferData {
  transfer_code: string;
  reference: string;
  status: string;
}

export function initiateTransfer(input: {
  amount: number;
  recipient: string;
  reference: string;
  reason: string;
}) {
  return paystackFetch<{ status: boolean; message: string; data: TransferData }>("/transfer", {
    method: "POST",
    body: JSON.stringify({ source: "balance", ...input }),
  });
}
