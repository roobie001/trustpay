"use client";

import { use, useEffect, useState } from "react";
import confetti from "canvas-confetti";
import {
  ShieldCheck,
  Truck,
  PackageCheck,
  Wallet,
  Loader2,
  PackageSearch,
  TriangleAlert,
  Check,
} from "lucide-react";
import { supabase, type EscrowOrder, type EscrowStatus } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

const STAGES: { status: EscrowStatus; label: string; icon: typeof ShieldCheck }[] = [
  { status: "HELD_IN_ESCROW", label: "Payment Locked in Vault", icon: ShieldCheck },
  { status: "DISPATCHED", label: "Dispatched with Rider", icon: Truck },
  { status: "FUNDS_RELEASED", label: "Order Delivered & Inspected", icon: PackageCheck },
  { status: "FUNDS_RELEASED", label: "Funds Released to Seller", icon: Wallet },
];

function stageIndexForStatus(status: EscrowStatus): number {
  switch (status) {
    case "PENDING_PAYMENT":
      return -1;
    case "HELD_IN_ESCROW":
      return 0;
    case "DISPATCHED":
      return 1;
    case "FUNDS_RELEASED":
      return 3;
    case "DISPUTED":
      return 0;
    default:
      return -1;
  }
}

export default function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [order, setOrder] = useState<EscrowOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase
        .from("escrow_orders")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (!data) {
        setNotFound(true);
      } else {
        setOrder(data);
      }
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`escrow_orders:${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "escrow_orders",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          if (active) setOrder(payload.new as EscrowOrder);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function updateStatus(status: EscrowStatus) {
    if (!order) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("escrow_orders")
      .update({ status })
      .eq("id", order.id)
      .select("*")
      .single();
    setBusy(false);
    if (!error && data) {
      setOrder(data);
      if (status === "FUNDS_RELEASED") {
        confetti({
          particleCount: 140,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#10B981", "#34D399", "#6EE7B7"],
        });
      }
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-zinc-50 px-4 text-center">
        <PackageSearch className="h-8 w-8 text-zinc-400" />
        <p className="text-sm font-medium text-zinc-600">
          This order doesn&apos;t exist or was removed.
        </p>
      </div>
    );
  }

  const total = Number(order.amount) + Number(order.delivery_fee);
  const activeStage = stageIndexForStatus(order.status);
  const isDisputed = order.status === "DISPUTED";

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            {order.item_title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {formatNaira(total)} &middot; {order.seller_name}
          </p>
        </div>

        {isDisputed && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm leading-relaxed text-amber-800">
              <span className="font-semibold">Funds frozen.</span> This order
              has been flagged for review. Our team will help resolve it.
            </p>
          </div>
        )}

        {order.status === "FUNDS_RELEASED" && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Payout complete
              </p>
              <p className="text-xs text-emerald-700">
                {formatNaira(total)} released to {order.seller_name}.
              </p>
            </div>
          </div>
        )}

        <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <ol className="space-y-5">
            {STAGES.map((stage, index) => {
              const Icon = stage.icon;
              const done = !isDisputed && index <= activeStage;
              const isLast = index === STAGES.length - 1;
              return (
                <li key={stage.label} className="relative flex gap-3">
                  {!isLast && (
                    <span
                      className={`absolute left-[15px] top-8 h-[calc(100%+4px)] w-px ${
                        done ? "bg-emerald-400" : "bg-zinc-200"
                      }`}
                    />
                  )}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                      done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-zinc-200 bg-zinc-50 text-zinc-300"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="pt-1">
                    <p
                      className={`text-sm font-medium ${
                        done ? "text-zinc-900" : "text-zinc-400"
                      }`}
                    >
                      {stage.label}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="space-y-3">
          {order.status === "HELD_IN_ESCROW" && (
            <button
              onClick={() => updateStatus("DISPATCHED")}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Truck className="h-4 w-4" />
              )}
              Mark as Dispatched (Seller)
            </button>
          )}

          {order.status === "DISPATCHED" && (
            <button
              onClick={() => updateStatus("FUNDS_RELEASED")}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Wallet className="h-5 w-5" />
              )}
              Confirm &amp; Release Funds
            </button>
          )}

          {(order.status === "HELD_IN_ESCROW" ||
            order.status === "DISPATCHED") && (
            <button
              onClick={() => updateStatus("DISPUTED")}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium text-zinc-400 transition hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <TriangleAlert className="h-3.5 w-3.5" />
              Report Issue / Freeze Funds
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
