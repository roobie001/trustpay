"use client";

import { use, useEffect, useRef, useState } from "react";
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
  LayoutDashboard,
  Landmark,
  Receipt,
  Clock,
} from "lucide-react";
import { supabase, type EscrowOrder, type EscrowStatus } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { maskAccountNumber } from "@/lib/banks";

function settlementReference(orderId: string): string {
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    hash = (hash * 31 + orderId.charCodeAt(i)) >>> 0;
  }
  return `TRF_${(hash % 10_000_000).toString().padStart(7, "0")}`;
}

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
  const [sellerView, setSellerView] = useState(false);
  const [showPayoutToast, setShowPayoutToast] = useState(false);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [localFreeze, setLocalFreeze] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

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
        setShowPayoutToast(true);
        if (toastTimeout.current) clearTimeout(toastTimeout.current);
        toastTimeout.current = setTimeout(() => setShowPayoutToast(false), 4500);
      }
    }
  }

  async function handleConfirmFreeze() {
    setShowFreezeModal(false);
    setLocalFreeze(true);
    await updateStatus("DISPUTED");
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
  const isDisputed = order.status === "DISPUTED" || localFreeze;

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 sm:py-16">
      {showPayoutToast && (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
            <Check className="h-4 w-4 text-emerald-400" />
            {formatNaira(Number(order.amount))} sent to seller&apos;s account
          </div>
        </div>
      )}

      {showFreezeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center gap-2 text-amber-600">
              <TriangleAlert className="h-5 w-5" />
              <h3 className="text-sm font-semibold text-zinc-900">
                Freeze Escrow Vault?
              </h3>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-zinc-600">
              This will lock the payout immediately and initiate a WhatsApp
              mediation thread with the seller and dispatch courier.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFreezeModal(false)}
                className="flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmFreeze}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                Confirm Freeze
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md">
        <div className="mb-4 text-center">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            {order.item_title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {formatNaira(total)} &middot; {order.seller_name}
          </p>
        </div>

        <div className="mb-2 flex justify-center">
          <div className="inline-flex rounded-full border border-zinc-200 bg-white p-1 shadow-sm">
            <button
              onClick={() => setSellerView(false)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                !sellerView
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              Buyer View
            </button>
            <button
              onClick={() => setSellerView(true)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                sellerView
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Seller Dashboard
            </button>
          </div>
        </div>
        <p className="mb-6 text-center text-[11px] text-zinc-400">
          Demo Sandbox: Toggle enabled for evaluation &amp; testing
        </p>

        {isDisputed && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm leading-relaxed text-amber-800">
              <span className="font-semibold">⚠️ Escrow Frozen:</span> Dispute
              #TRP-902 under mediation. Seller &amp; TrustPay notified.
            </p>
          </div>
        )}

        {order.status === "FUNDS_RELEASED" && !sellerView && (
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

        {!isDisputed && order.status !== "FUNDS_RELEASED" && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-xs text-zinc-500">
            <Clock className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            {sellerView
              ? "Seller Guaranteed: Payout auto-disburses within 24h if buyer is unresponsive."
              : "Auto-Release Window: 24h post-dispatch before escrow releases automatically."}
          </div>
        )}

        {sellerView && (
          <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Landmark className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-semibold text-zinc-900">
                Seller Dashboard
              </h2>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-xl bg-zinc-50 px-3.5 py-2.5 text-sm">
              <span className="text-zinc-500">Payout destination</span>
              <span className="font-medium text-zinc-900">
                {order.seller_bank && order.seller_account_number
                  ? `${order.seller_bank} ${maskAccountNumber(order.seller_account_number)}`
                  : "Not provided"}
              </span>
            </div>

            {order.status === "FUNDS_RELEASED" ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-800">
                    Payout Receipt / Settlement
                  </p>
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-emerald-700">Recipient</dt>
                    <dd className="text-right font-medium text-emerald-900">
                      {order.seller_name}
                      <br />
                      <span className="text-xs font-normal text-emerald-700">
                        {order.seller_bank && order.seller_account_number
                          ? `${order.seller_bank} ${maskAccountNumber(order.seller_account_number)}`
                          : "Bank details not provided"}
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-emerald-700">Net Payout Amount</dt>
                    <dd className="font-semibold text-emerald-900">
                      {formatNaira(Number(order.amount))}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-emerald-700">Transaction Reference</dt>
                    <dd className="font-mono text-xs font-medium text-emerald-900">
                      {settlementReference(order.id)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                  <Check className="h-3 w-3" />
                  Disbursed to Bank via Instant NIP Rail
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                Funds will be disbursed to this account once the buyer
                confirms delivery.
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          {sellerView && !isDisputed && order.status === "HELD_IN_ESCROW" && (
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

          {!sellerView && !isDisputed && order.status === "DISPATCHED" && (
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

          {!sellerView &&
            !isDisputed &&
            (order.status === "HELD_IN_ESCROW" ||
              order.status === "DISPATCHED") && (
              <button
                onClick={() => setShowFreezeModal(true)}
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
