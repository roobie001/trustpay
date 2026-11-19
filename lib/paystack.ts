// Server-only. Never import this file from a "use client" component —
// PAYSTACK_SECRET_KEY must never reach the browser bundle.
import fs from "node:fs";
import path from "node:path";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export class PaystackError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PaystackError";
    this.status = status;
  }
}

// Dynamically read .env.local and .env from disk so edits take effect immediately
// without requiring a manual restart of the Next.js dev server.
function readEnvLocal(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const cwd = process.cwd();
    const candidatePaths = [
      path.resolve(cwd, ".env.local"),
      path.resolve(cwd, ".env"),
    ];

    for (const envPath of candidatePaths) {
      if (fs.existsSync(/*turbopackIgnore: true*/ envPath)) {
        const content = fs.readFileSync(/*turbopackIgnore: true*/ envPath, "utf8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx > 0) {
              const key = trimmed.slice(0, eqIdx).trim();
              const rawVal = trimmed.slice(eqIdx + 1).trim();
              const cleanVal = rawVal.replace(/^["']|["']$/g, "").trim();
              if (env[key] === undefined) {
                env[key] = cleanVal;
              }
            }
          }
        }
      }
    }
  } catch {
    // Ignore and fallback to process.env
  }
  return env;
}

export function isPaystackTestMode(): boolean {
  const fileEnv = readEnvLocal();
  const key =
    fileEnv.PAYSTACK_SECRET_KEY ||
    process.env.PAYSTACK_SECRET_KEY ||
    "";
  const mode =
    fileEnv.PAYSTACK_MODE ||
    process.env.PAYSTACK_MODE ||
    fileEnv.NEXT_PUBLIC_PAYSTACK_MODE ||
    process.env.NEXT_PUBLIC_PAYSTACK_MODE ||
    "";
  return key.startsWith("sk_test_") || mode.toLowerCase() === "test";
}

export function getSecretKey(): string {
  const fileEnv = readEnvLocal();
  const key =
    fileEnv.PAYSTACK_SECRET_KEY ||
    process.env.PAYSTACK_SECRET_KEY ||
    "";
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

export interface VerifiedTransaction {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  metadata?: { order_id?: string } | null;
  paid_at?: string | null;
}

export function verifyTransaction(reference: string) {
  return paystackFetch<{
    status: boolean;
    message: string;
    data: VerifiedTransaction;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
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
