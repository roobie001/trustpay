"use client";

import { use, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  Sparkles,
  PhoneCall,
  X,
  Share2,
} from "lucide-react";
import { supabase, type EscrowOrder, type EscrowStatus } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { maskAccountNumber } from "@/lib/banks";
import { PLATFORM_FEE_RATE } from "@/lib/fees";
import { BRAND_NAME, DEMO_DISPUTE_REFERENCE, VAULT_NAME } from "@/lib/constants";
import {
  type DispatchInfo,
  type BuyerProfile,
  getOrderDispatchInfo,
  saveOrderDispatchInfo,
  getSavedBuyerProfile,
  getOrderTimestamps,
  updateOrderTimestamps,
} from "@/lib/storage";
import { HeroVaultCard } from "@/components/HeroVaultCard";
import { LiveStepper } from "@/components/LiveStepper";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { DisputeDrawer } from "@/components/DisputeDrawer";
import { CompletedReceipt } from "@/components/CompletedReceipt";

export default function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const sellerKeyParam = searchParams.get("key");
  const paymentReference = searchParams.get("reference");

  const [order, setOrder] = useState<EscrowOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Seamless Role Switcher: togglable between "buyer" and "seller"
  const [currentRole, setCurrentRole] = useState<"buyer" | "seller">("buyer");

  // Dispatch details state (for seller inline modal/form)
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [riderPhone, setRiderPhone] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [dispatchInfo, setDispatchInfo] = useState<DispatchInfo | null>(null);

  // Dispute & Receipts
  const [showDisputeDrawer, setShowDisputeDrawer] = useState(false);
  const [savedBuyer, setSavedBuyer] = useState<BuyerProfile | null>(null);

  // Verify seller secret key if key param is present
  useEffect(() => {
    let active = true;
    if (!sellerKeyParam) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/orders/${id}/verify-seller?key=${encodeURIComponent(sellerKeyParam)}`
        );
        const json = await res.json();
        if (active && json.isSeller) {
          setCurrentRole("seller");
        }
      } catch {
        // default to buyer
      }
    })();
    return () => {
      active = false;
    };
  }, [id, sellerKeyParam]);

  // Load saved storage info
  useEffect(() => {
    const dInfo = getOrderDispatchInfo(id);
    if (dInfo) setDispatchInfo(dInfo);

    const bProfile = getSavedBuyerProfile();
    if (bProfile) setSavedBuyer(bProfile);
  }, [id]);

  // Load and poll order data
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

    let pollInFlight = false;
    let paymentConfirmed = false;
    const poll = setInterval(async () => {
      if (pollInFlight) return;
      pollInFlight = true;
      try {
        if (paymentReference && !paymentConfirmed) {
          await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: id, reference: paymentReference }),
            signal: AbortSignal.timeout(6000),
          });
        }

        const { data } = await supabase
          .from("escrow_orders")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (!active || !data) return;
        setOrder(data);
        if (data.status !== "PENDING_PAYMENT") paymentConfirmed = true;
      } catch (error) {
        console.error("Failed to refresh order status:", error);
      } finally {
        pollInFlight = false;
      }
    }, 3000);

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
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [id, paymentReference]);

  // Mark as dispatched
  async function handleDispatchSubmit() {
    if (!order) return;
    if (!riderPhone.trim()) {
      setActionError("Please provide the dispatch rider's phone number.");
      return;
    }

    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerKey: sellerKeyParam }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setActionError(json.error ?? "Unable to mark order as dispatched.");
        return;
      }

      const info: DispatchInfo = {
        riderPhone: riderPhone.trim(),
        trackingCode: trackingCode.trim() || undefined,
        dispatchedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }),
      };
      saveOrderDispatchInfo(order.id, info);
      setDispatchInfo(info);

      updateOrderTimestamps(order.id, {
        dispatchedAt: info.dispatchedAt,
      });

      setOrder(json.order);
      setShowDispatchModal(false);
    } catch {
      setActionError("Unable to update dispatch status. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Release funds
  async function handleReleaseFunds() {
    if (!order) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerKey: sellerKeyParam ?? undefined }),
      });
      const json = await res.json();

      if (!json.success) {
        setActionError(json.error ?? "Failed to release funds.");
        return;
      }

      updateOrderTimestamps(order.id, {
        releasedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }),
      });

      setOrder(json.order);
      confetti({
        particleCount: 160,
        spread: 90,
        origin: { y: 0.6 },
        colors: ["#EAB308", "#10B981", "#FACC15"],
      });
    } catch {
      setActionError("Failed to release funds. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Raise dispute
  async function handleRaiseDispute() {
    if (!order) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("escrow_orders")
        .update({ status: "DISPUTED" })
        .eq("id", order.id)
        .select("*")
        .single();
      if (error) throw error;
      if (data) setOrder(data);
      setShowDisputeDrawer(true);
    } catch {
      setActionError("Unable to update dispute status.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-[#030712]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          <p className="text-xs font-semibold text-slate-400">Syncing with secure vault...</p>
        </div>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-[#030712] px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 border border-white/[0.08] text-slate-400 mb-2">
          <PackageSearch className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-white">Order Not Found</h2>
        <p className="text-xs text-slate-400 max-w-xs mt-1">
          This escrow deal does not exist or was removed.
        </p>
      </div>
    );
  }

  const total = Number(order.amount) + Number(order.delivery_fee || 0);
  const netPayout = total * (1 - PLATFORM_FEE_RATE);
  const isDisputed = order.status === "DISPUTED";
  const timestamps = getOrderTimestamps(order.id);

  return (
    <div className="relative min-h-screen dot-grid text-slate-100 flex flex-col items-center px-4 py-8 sm:py-12">
      {/* Background ambient lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-amber-500/10 blur-[130px] rounded-full" />
        <div className="absolute top-1/2 -right-40 w-[420px] h-[420px] bg-emerald-500/8 blur-[140px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-[430px] space-y-4">
        {/* Seamless Role Switcher (Buyer View / Seller View) */}
        <RoleSwitcher currentRole={currentRole} onRoleChange={setCurrentRole} />

        {/* Header */}
        <header className="text-center">
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {order.item_title}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {currentRole === "seller" ? (
              <>
                Customer: <span className="text-slate-200 font-semibold">{order.buyer_name || "Awaiting customer details"}</span>
              </>
            ) : (
              <>
                Vendor: <span className="text-amber-400 font-semibold">{order.seller_name}</span> &middot;{" "}
                {order.seller_phone}
              </>
            )}
          </p>
        </header>

        {/* Pending Payment Alert */}
        {order.status === "PENDING_PAYMENT" && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0B1120] p-4 shadow-xl">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-400" />
            <p className="text-xs text-slate-300">
              Awaiting buyer escrow deposit. Funds will lock safely before vendor dispatches.
            </p>
          </div>
        )}

        {/* Dispute Active Banner */}
        {isDisputed && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs">
              <TriangleAlert className="h-4 w-4 text-rose-400 shrink-0" />
              <span>Escrow Payout Paused: Case #{DEMO_DISPUTE_REFERENCE}</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Dispute logged. Payout to vendor is currently frozen while evidence and notes are reviewed.
            </p>
            <button
              type="button"
              onClick={() => setShowDisputeDrawer(true)}
              className="mt-1 h-9 px-3.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-bold text-rose-200 transition"
            >
              View Dispute &amp; Evidence Panel
            </button>
          </div>
        )}

        {/* Hero Escrow Vault Card */}
        <HeroVaultCard
          amount={total}
          status={order.status}
          itemTitle={order.item_title}
          sellerName={order.seller_name}
          isSeller={currentRole === "seller"}
          netPayout={netPayout}
          isDisputed={isDisputed}
        />

        {/* Completed Escrow Receipt Screen (When FUNDS_RELEASED) */}
        {order.status === "FUNDS_RELEASED" ? (
          <CompletedReceipt
            order={order}
            buyerProfile={savedBuyer}
            timestamps={timestamps}
          />
        ) : (
          /* 4-Step Vertical Progress Stepper */
          <LiveStepper
            status={order.status}
            isDisputed={isDisputed}
            isSeller={currentRole === "seller"}
            dispatchInfo={dispatchInfo}
          />
        )}

        {/* Action Error Banner */}
        {actionError && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
            <TriangleAlert className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Role-Based Controls */}
        <div className="space-y-2 pt-1">
          {/* Seller Control: Mark as Dispatched (when funded) */}
          {currentRole === "seller" && !isDisputed && order.status === "HELD_IN_ESCROW" && (
            <button
              type="button"
              onClick={() => setShowDispatchModal(true)}
              disabled={busy}
              className="flex min-h-[44px] h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 transition active:scale-[0.99] disabled:opacity-60"
            >
              <Truck className="h-4 w-4 stroke-[2.5]" />
              <span>Mark as Dispatched (Enter Rider Details)</span>
            </button>
          )}

          {/* Buyer Controls: Confirm Delivery & Release / Raise Dispute */}
          {currentRole === "buyer" &&
            !isDisputed &&
            (order.status === "HELD_IN_ESCROW" || order.status === "DISPATCHED") && (
              <>
                {order.status === "DISPATCHED" && (
                  <button
                    type="button"
                    onClick={handleReleaseFunds}
                    disabled={busy}
                    className="flex min-h-[44px] h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition active:scale-[0.99] disabled:opacity-60"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Releasing Funds...</span>
                      </>
                    ) : (
                      <>
                        <Wallet className="h-5 w-5" />
                        <span>Confirm Delivery &amp; Release Funds</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRaiseDispute}
                  disabled={busy}
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 transition"
                >
                  <TriangleAlert className="h-3.5 w-3.5" />
                  <span>Raise a Dispute (Pause Payout)</span>
                </button>
              </>
            )}
        </div>

        {/* Modal: Seller Inline Dispatch Details Input */}
        {showDispatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0B1120] p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Enter Dispatch Details</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Dispatch Rider Phone Number *
                </label>
                <input
                  type="tel"
                  value={riderPhone}
                  onChange={(e) => setRiderPhone(e.target.value)}
                  placeholder="e.g. 08099887766"
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0F172A] px-3 text-xs font-mono tabular-nums text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Buyer will see this phone number with a 1-tap call button.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Tracking Code or Courier (Optional)
                </label>
                <input
                  type="text"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="e.g. GIG-78291 / Max Delivery"
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0F172A] px-3 text-xs font-mono text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="h-11 flex-1 rounded-xl border border-white/[0.1] text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDispatchSubmit}
                  disabled={busy}
                  className="h-11 flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 stroke-[3]" />}
                  <span>Confirm Dispatch</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dispute Drawer / Panel */}
        <DisputeDrawer
          orderId={order.id}
          itemTitle={order.item_title}
          isOpen={showDisputeDrawer}
          onClose={() => setShowDisputeDrawer(false)}
          onResolveAndRelease={handleReleaseFunds}
          currentUserRole={currentRole}
        />
      </div>
    </div>
  );
}
