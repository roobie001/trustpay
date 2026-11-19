"use client";

import { ShieldCheck, Truck, Wallet, TriangleAlert, Clock, Lock } from "lucide-react";
import { formatNaira } from "@/lib/format";
import { VAULT_NAME } from "@/lib/constants";
import type { EscrowStatus } from "@/lib/supabase";

interface HeroVaultCardProps {
  amount: number;
  status: EscrowStatus;
  itemTitle: string;
  sellerName?: string;
  isSeller?: boolean;
  netPayout?: number;
  isDisputed?: boolean;
}

export function HeroVaultCard({
  amount,
  status,
  itemTitle,
  sellerName,
  isSeller = false,
  netPayout,
  isDisputed = false,
}: HeroVaultCardProps) {
  const getBadgeConfig = () => {
    if (isDisputed || status === "DISPUTED") {
      return {
        label: "ESCROW PAYOUT PAUSED",
        classes: "bg-rose-500/15 text-rose-400 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.25)]",
        dotClasses: "bg-rose-400",
        icon: TriangleAlert,
      };
    }
    switch (status) {
      case "HELD_IN_ESCROW":
        return {
          label: "FUNDS IN ESCROW",
          classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]",
          dotClasses: "bg-emerald-400",
          icon: Lock,
        };
      case "DISPATCHED":
        return {
          label: "DISPATCHED / IN TRANSIT",
          classes: "bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.25)]",
          dotClasses: "bg-amber-400",
          icon: Truck,
        };
      case "FUNDS_RELEASED":
        return {
          label: "DELIVERY CONFIRMED",
          classes: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]",
          dotClasses: "bg-emerald-400",
          icon: Wallet,
        };
      case "PENDING_PAYMENT":
      default:
        return {
          label: "AWAITING DEPOSIT",
          classes: "bg-slate-800 text-slate-300 border-slate-700",
          dotClasses: "bg-slate-400",
          icon: Clock,
        };
    }
  };

  const badge = getBadgeConfig();
  const BadgeIcon = badge.icon;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0B1120] border border-white/[0.08] text-white p-5 sm:p-6 shadow-2xl">
      {/* Soft ambient gold/emerald radial glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Vault Card Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800/90 border border-white/[0.08] text-amber-400 shadow-inner">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200">
                {VAULT_NAME}
              </span>
              <span className="rounded bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-400">
                P2P ESCROW
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Neutral Midpoint Security</p>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${badge.classes}`}
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${badge.dotClasses}`}
            />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${badge.dotClasses}`} />
          </span>
          <BadgeIcon className="h-3 w-3" />
          <span>{badge.label}</span>
        </div>
      </div>

      {/* Locked Naira Amount Display */}
      <div className="py-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {status === "FUNDS_RELEASED"
              ? "Total Settled Amount"
              : isSeller
              ? "Funds Locked for this Order"
              : "Funds Held in Escrow"}
          </span>
          {isSeller && netPayout !== undefined && (
            <span className="text-xs font-mono tabular-nums text-emerald-400 font-semibold">
              Net Payout: {formatNaira(netPayout)}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-3xl font-extrabold tracking-tight text-white tabular-nums sm:text-4xl">
            {formatNaira(amount)}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
          <span className="font-medium text-slate-200">{itemTitle}</span>
          {sellerName && (
            <>
              <span className="text-slate-600">&middot;</span>
              <span>Vendor: {sellerName}</span>
            </>
          )}
        </div>
      </div>

      {/* 24h Auto-Release Protection Window Pill */}
      {status !== "FUNDS_RELEASED" && !isDisputed && (
        <div className="mt-1 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-300">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          <p className="leading-snug">
            {isSeller ? (
              <>
                <strong className="font-semibold text-amber-200">24h Seller Guarantee:</strong> Funds
                auto-disburse to your bank 24 hours after dispatch if the buyer is unresponsive.
              </>
            ) : (
              <>
                <strong className="font-semibold text-amber-200">24h Auto-Release Window:</strong>{" "}
                Inspect your package upon arrival. Funds release to the vendor 24 hours post-dispatch
                unless you raise a dispute.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
