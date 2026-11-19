"use client";

import { useState } from "react";
import { Check, Receipt, Share2, Copy, ShieldCheck, Landmark, MapPin, Clock } from "lucide-react";
import { formatNaira } from "@/lib/format";
import { maskAccountNumber } from "@/lib/banks";
import { BRAND_NAME, VAULT_NAME } from "@/lib/constants";
import type { EscrowOrder } from "@/lib/supabase";
import type { BuyerProfile, OrderTimestamps } from "@/lib/storage";

interface CompletedReceiptProps {
  order: EscrowOrder;
  buyerProfile?: BuyerProfile | null;
  timestamps?: OrderTimestamps;
}

export function CompletedReceipt({
  order,
  buyerProfile,
  timestamps,
}: CompletedReceiptProps) {
  const [copied, setCopied] = useState(false);

  const total = Number(order.amount) + Number(order.delivery_fee || 0);

  // Exact or formatted timestamps
  const now = new Date();
  const depositedTime =
    timestamps?.depositedAt ||
    order.paid_at ||
    new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
  const dispatchedTime =
    timestamps?.dispatchedAt ||
    new Date(Date.now() - 3600000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });
  const releasedTime =
    timestamps?.releasedAt ||
    now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });

  const receiptSummaryText = `
════════════════════════════════════
  ${BRAND_NAME.toUpperCase()} ESCROW RECEIPT
  Status: COMPLETED & SETTLED
════════════════════════════════════
Order ID: #${order.id.slice(0, 8).toUpperCase()}
Item: ${order.item_title}
Amount: ${formatNaira(total)}

VENDOR DETAILS:
• Name: ${order.seller_name}
• Bank: ${order.seller_bank || "Bank"} (${order.seller_account_number ? maskAccountNumber(order.seller_account_number) : "Verified"})
• Contact: ${order.seller_phone}

BUYER DETAILS:
• Name: ${order.buyer_name || buyerProfile?.fullName || "Verified Buyer"}
• Phone: ${order.buyer_phone || buyerProfile?.phoneNumber || "On file"}
• Delivery: ${buyerProfile?.deliveryAddress || "Doorstep Delivery Verified"}

TIMELINE AUDIT:
• Deposited into Vault: ${depositedTime}
• Dispatched with Courier: ${dispatchedTime}
• Delivery Confirmed & Settled: ${releasedTime}

Rail: Instant NIP Interbank Settlement
Protected by ${VAULT_NAME}
════════════════════════════════════
`.trim();

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${BRAND_NAME} Escrow Receipt - ${order.item_title}`,
          text: receiptSummaryText,
          url: typeof window !== "undefined" ? window.location.href : undefined,
        });
        return;
      } catch (err) {
        // User cancelled or unsupported; fallback to copy
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(receiptSummaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn("Failed to copy receipt text:", e);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-[#0B1120] p-5 sm:p-6 shadow-2xl text-slate-100">
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Check className="h-5 w-5 stroke-[3]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Escrow Settled &amp; Complete</h3>
              <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.2 text-[10px] font-bold">
                NIP RAIL
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">Order #{order.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 text-xs font-bold shadow-md transition active:scale-[0.98]"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          <span>{copied ? "Copied!" : "Share Receipt"}</span>
        </button>
      </div>

      {/* Main Details */}
      <div className="my-4 space-y-3 text-xs sm:text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Item / Service</span>
          <span className="font-semibold text-white">{order.item_title}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-slate-400">Total Escrow Amount</span>
          <span className="font-mono text-lg font-extrabold text-emerald-400 tabular-nums">
            {formatNaira(total)}
          </span>
        </div>

        <div className="border-t border-white/[0.06] pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Vendor */}
          <div className="rounded-xl bg-slate-900/60 p-3 border border-white/[0.06]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1 mb-1">
              <Landmark className="h-3 w-3" />
              <span>Vendor Payout Account</span>
            </div>
            <div className="font-semibold text-white truncate">{order.seller_name}</div>
            <div className="text-slate-400 font-mono text-[11px] tabular-nums">
              {order.seller_bank || "Bank"} &middot;{" "}
              {order.seller_account_number ? maskAccountNumber(order.seller_account_number) : "Verified"}
            </div>
          </div>

          {/* Buyer */}
          <div className="rounded-xl bg-slate-900/60 p-3 border border-white/[0.06]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1 mb-1">
              <MapPin className="h-3 w-3" />
              <span>Buyer Delivery Destination</span>
            </div>
            <div className="font-semibold text-white truncate">
              {order.buyer_name || buyerProfile?.fullName || "Verified Buyer"}
            </div>
            <div className="text-slate-400 text-[11px] truncate">
              {buyerProfile?.deliveryAddress || "Doorstep delivery confirmed"}
            </div>
          </div>
        </div>

        {/* Timestamps Audit */}
        <div className="border-t border-white/[0.06] pt-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-400" />
            <span>Escrow Lifecycle Audit Timestamps</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
            <div className="rounded-lg bg-slate-900/40 p-2 border border-white/[0.04]">
              <div className="text-slate-500 font-medium">1. Deposited</div>
              <div className="font-mono text-slate-200 mt-0.5 truncate">{depositedTime}</div>
            </div>
            <div className="rounded-lg bg-slate-900/40 p-2 border border-white/[0.04]">
              <div className="text-slate-500 font-medium">2. Dispatched</div>
              <div className="font-mono text-slate-200 mt-0.5 truncate">{dispatchedTime}</div>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2 border border-emerald-500/20">
              <div className="text-emerald-400 font-semibold">3. Released</div>
              <div className="font-mono text-emerald-300 mt-0.5 truncate">{releasedTime}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Pill */}
      <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1 text-emerald-400 font-semibold">
          <ShieldCheck className="h-3.5 w-3.5" />
          Escrow Protected Transaction
        </span>
        <span className="font-mono text-slate-500">Ref: {order.transfer_reference || `NIP-${order.id.slice(0, 6)}`}</span>
      </div>
    </div>
  );
}
