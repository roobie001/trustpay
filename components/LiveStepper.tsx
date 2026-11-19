"use client";

import { ShieldCheck, Truck, PackageCheck, Wallet, Check, PhoneCall, ExternalLink, TriangleAlert } from "lucide-react";
import { VAULT_NAME } from "@/lib/constants";
import type { EscrowStatus } from "@/lib/supabase";
import type { DispatchInfo } from "@/lib/storage";

interface LiveStepperProps {
  status: EscrowStatus;
  isDisputed?: boolean;
  isSeller?: boolean;
  dispatchInfo?: DispatchInfo | null;
}

export function stageIndexForStatus(status: EscrowStatus): number {
  switch (status) {
    case "PENDING_PAYMENT":
      return 0; // step 1 active: Awaiting deposit
    case "HELD_IN_ESCROW":
      return 1; // step 2 completed/active: Funds held safely
    case "DISPATCHED":
      return 2; // step 3 active: Dispatched / out for delivery
    case "FUNDS_RELEASED":
      return 3; // all completed: Delivery confirmed & released
    case "DISPUTED":
      return 1;
    default:
      return 0;
  }
}

export function LiveStepper({
  status,
  isDisputed = false,
  isSeller = false,
  dispatchInfo,
}: LiveStepperProps) {
  const activeStage = stageIndexForStatus(status);

  const STAGES = [
    {
      num: 1,
      label: "Awaiting deposit",
      buyerDesc: "Lock payment into escrow to initiate vendor fulfillment",
      sellerDesc: "Awaiting buyer escrow deposit via secure checkout",
      icon: ShieldCheck,
    },
    {
      num: 2,
      label: "Funds held safely in escrow",
      buyerDesc: `Funds secured in ${VAULT_NAME}. Vendor cannot access funds yet`,
      sellerDesc: "Payment verified in escrow vault. Safe to dispatch package",
      icon: Wallet,
    },
    {
      num: 3,
      label: "Dispatched / out for delivery",
      buyerDesc: "Courier has picked up order and is en route to your doorstep",
      sellerDesc: "Order handed over to dispatch courier with live tracking",
      icon: Truck,
    },
    {
      num: 4,
      label: "Delivery confirmed & funds released",
      buyerDesc: "Package received & verified. Funds disbursed to vendor",
      sellerDesc: "Instant NIP bank settlement credited to your account",
      icon: PackageCheck,
    },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0F172A] p-5 sm:p-6 shadow-xl">
      <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Escrow Progress &amp; Tracking
        </h3>
        {isDisputed ? (
          <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <TriangleAlert className="h-3 w-3" />
            Payout Paused
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
            Live Sync
          </span>
        )}
      </div>

      <ol className="relative space-y-6">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon;
          // Completed if past this stage
          const isCompleted = !isDisputed && (status === "FUNDS_RELEASED" || index < activeStage);
          // Active step
          const isCurrentActive =
            !isDisputed &&
            status !== "FUNDS_RELEASED" &&
            index === activeStage;
          const isLast = index === STAGES.length - 1;

          return (
            <li key={stage.label} className="relative flex gap-3.5">
              {/* Connecting vertical line */}
              {!isLast && (
                <div
                  className={`absolute left-[15px] top-8 h-[calc(100%+8px)] w-[2px] transition-colors duration-300 ${
                    isCompleted ? "bg-emerald-500" : "bg-white/[0.08]"
                  }`}
                />
              )}

              {/* Node Icon */}
              <div
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                  isCompleted
                    ? "bg-emerald-500 text-slate-950 shadow-md ring-4 ring-emerald-500/10 font-bold"
                    : isCurrentActive
                    ? "border-2 border-amber-400 bg-amber-500/10 text-amber-300 ring-4 ring-amber-400/20"
                    : "border border-white/[0.1] bg-slate-900 text-slate-500"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4 stroke-[3]" />
                ) : isCurrentActive ? (
                  <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <Icon className="h-3.5 w-3.5 text-amber-400 relative" />
                  </span>
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>

              {/* Step Copy */}
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center gap-2">
                  <p
                    className={`text-sm font-bold transition-colors ${
                      isCompleted
                        ? "text-emerald-400"
                        : isCurrentActive
                        ? "text-white"
                        : "text-slate-500"
                    }`}
                  >
                    {stage.label}
                  </p>
                  {isCurrentActive && !isDisputed && (
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      Active
                    </span>
                  )}
                </div>

                <p
                  className={`mt-0.5 text-xs ${
                    isCompleted || isCurrentActive ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  {isSeller ? stage.sellerDesc : stage.buyerDesc}
                </p>

                {/* Prominently display Dispatch Rider Phone and Tracking Code if in Dispatched or Completed state */}
                {index === 2 && (status === "DISPATCHED" || status === "FUNDS_RELEASED") && (
                  <div className="mt-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          Assigned Dispatch Rider
                        </div>
                        <div className="font-mono text-xs font-semibold text-white tabular-nums">
                          {dispatchInfo?.riderPhone || "080-DISPATCH (Courier assigned)"}
                        </div>
                        {dispatchInfo?.trackingCode && (
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            Tracking Code: <span className="text-slate-200">{dispatchInfo.trackingCode}</span>
                          </div>
                        )}
                      </div>

                      {dispatchInfo?.riderPhone && (
                        <a
                          href={`tel:${dispatchInfo.riderPhone}`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 text-xs font-bold shadow-sm transition active:scale-[0.98]"
                        >
                          <PhoneCall className="h-3.5 w-3.5" />
                          <span>Call Rider</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
