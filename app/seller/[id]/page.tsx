"use client";

import { use, useEffect, useState } from "react";
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
  Lock,
  ExternalLink,
  X,
  MapPin,
  Copy,
  PhoneCall,
  MessageCircle,
} from "lucide-react";
import { supabase, type EscrowOrder } from "@/lib/supabase";
import { formatNaira, getDeliveryHandoverPin } from "@/lib/format";
import { maskAccountNumber } from "@/lib/banks";
import { PLATFORM_FEE_RATE } from "@/lib/fees";
import { BRAND_NAME, DEMO_DISPUTE_REFERENCE, VAULT_NAME } from "@/lib/constants";
import {
  type DispatchInfo,
  type BuyerProfile,
  type OrderDeliveryDetails,
  getOrderDispatchInfo,
  saveOrderDispatchInfo,
  getSavedBuyerProfile,
  getOrderDeliveryDetails,
  getOrderTimestamps,
  updateOrderTimestamps,
} from "@/lib/storage";
import { HeroVaultCard } from "@/components/HeroVaultCard";
import { LiveStepper } from "@/components/LiveStepper";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { DisputeDrawer } from "@/components/DisputeDrawer";
import { CompletedReceipt } from "@/components/CompletedReceipt";

export default function SellerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const sellerKeyParam = searchParams.get("key");

  const [order, setOrder] = useState<EscrowOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Seamless Role Switcher
  const [currentRole, setCurrentRole] = useState<"buyer" | "seller">("seller");

  // Dispatch details state
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [riderPhone, setRiderPhone] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [dispatchInfo, setDispatchInfo] = useState<DispatchInfo | null>(null);

  // Dispute & Receipts
  const [showDisputeDrawer, setShowDisputeDrawer] = useState(false);
  const [savedBuyer, setSavedBuyer] = useState<BuyerProfile | null>(null);
  const [orderDelivery, setOrderDelivery] = useState<OrderDeliveryDetails | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);

  async function handleCopyAddress(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
    }
  }

  // Verify seller secret key server-side
  useEffect(() => {
    let active = true;
    (async () => {
      if (!sellerKeyParam) {
        if (active) setIsSeller(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/orders/${id}/verify-seller?key=${encodeURIComponent(sellerKeyParam)}`
        );
        const json = await res.json();
        if (active) setIsSeller(Boolean(json.isSeller));
      } catch {
        if (active) setIsSeller(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, sellerKeyParam]);

  // Load dispatch and buyer info
  useEffect(() => {
    const dInfo = getOrderDispatchInfo(id);
    if (dInfo) setDispatchInfo(dInfo);

    const bProfile = getSavedBuyerProfile();
    if (bProfile) setSavedBuyer(bProfile);

    const dDetails = getOrderDeliveryDetails(id);
    if (dDetails) setOrderDelivery(dDetails);
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
    const poll = setInterval(async () => {
      if (pollInFlight) return;
      pollInFlight = true;
      try {
        const { data } = await supabase
          .from("escrow_orders")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (!active || !data) return;
        setOrder(data);
      } catch (error) {
        console.error("Failed to refresh seller dashboard status:", error);
      } finally {
        pollInFlight = false;
      }
    }, 3000);

    const channel = supabase
      .channel(`seller_escrow_orders:${id}`)
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
  }, [id]);

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
      setActionError("Unable to update order status. Please try again.");
    } finally {
      setBusy(false);
    }
  }

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

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-[#030712]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          <p className="text-xs font-semibold text-slate-400">Authenticating seller dashboard...</p>
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

  if (!isSeller) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-[#030712] px-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-3">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-white">Seller Authorization Required</h2>
        <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
          This is a private seller management dashboard. Please use the full private link generated for
          this order or saved to your WhatsApp.
        </p>
        <a
          href={`/pay/${order.id}`}
          className="mt-4 text-xs font-bold text-amber-400 hover:text-amber-300 underline"
        >
          View public buyer tracking link &rarr;
        </a>
      </div>
    );
  }

  const total = Number(order.amount) + Number(order.delivery_fee || 0);
  const netPayout = total * (1 - PLATFORM_FEE_RATE);
  const isDisputed = order.status === "DISPUTED";
  const timestamps = getOrderTimestamps(order.id);

  return (
    <div className="relative min-h-screen dot-grid text-slate-100 flex flex-col items-center px-4 py-8 sm:py-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-amber-500/10 blur-[130px] rounded-full" />
        <div className="absolute top-1/2 -right-40 w-[420px] h-[420px] bg-emerald-500/8 blur-[140px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-[430px] space-y-4">
        {/* Seamless Role Switcher */}
        <RoleSwitcher currentRole={currentRole} onRoleChange={setCurrentRole} />

        {/* Header */}
        <header className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400 mb-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live Sync Active
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {order.item_title}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Customer: <span className="text-slate-200 font-semibold">{order.buyer_name || "Awaiting customer"}</span>
          </p>
        </header>

        {/* Dispute Warning */}
        {isDisputed && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs">
              <TriangleAlert className="h-4 w-4 text-rose-400 shrink-0" />
              <span>Escrow Payout Paused: Case #{DEMO_DISPUTE_REFERENCE}</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Customer initiated dispute mediation. Review notes and proof in the panel below.
            </p>
            <button
              type="button"
              onClick={() => setShowDisputeDrawer(true)}
              className="mt-1 h-9 px-3.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-bold text-rose-200 transition"
            >
              Open Dispute &amp; Evidence Panel
            </button>
          </div>
        )}

        {/* Mirrored Dark Obsidian Vault Hero Card */}
        <HeroVaultCard
          amount={total}
          status={order.status}
          itemTitle={order.item_title}
          sellerName={order.seller_name}
          isSeller={currentRole === "seller"}
          netPayout={netPayout}
          isDisputed={isDisputed}
        />

        {/* 1. Unlock Buyer Delivery Details in Seller View (Post-Payment) */}
        {currentRole === "seller" && order.status !== "PENDING_PAYMENT" && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0B1120] p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Buyer Delivery Destination
                </h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                Funds Locked in Vault
              </span>
            </div>

            <div className="rounded-xl bg-[#060A14] border border-white/10 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Recipient
                </span>
                <span className="text-xs font-bold text-white">
                  {order.buyer_name || orderDelivery?.fullName || savedBuyer?.fullName || "Verified Customer"}
                </span>
              </div>

              <div className="border-t border-white/[0.06] pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Doorstep Address &amp; Landmark
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyAddress(
                        `${orderDelivery?.deliveryAddress || savedBuyer?.deliveryAddress || "Doorstep Address on file with Escrow"}${
                          orderDelivery?.landmark || savedBuyer?.landmark
                            ? ` (Landmark: ${orderDelivery?.landmark || savedBuyer?.landmark})`
                            : ""
                        }`
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition"
                  >
                    {copiedAddress ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Address</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-200 font-medium leading-relaxed">
                  {orderDelivery?.deliveryAddress || savedBuyer?.deliveryAddress || "Doorstep Address on file with Escrow"}
                </p>
                {(orderDelivery?.landmark || savedBuyer?.landmark) && (
                  <p className="text-[11px] text-amber-400/90 mt-1 font-mono">
                    Landmark: {orderDelivery?.landmark || savedBuyer?.landmark}
                  </p>
                )}
              </div>
            </div>

            {/* Buyer Contact Actions: Call & WhatsApp */}
            <div className="flex items-center gap-2 pt-1">
              <a
                href={
                  (order.buyer_phone || orderDelivery?.phoneNumber || savedBuyer?.phoneNumber)
                    ? `tel:${(order.buyer_phone || orderDelivery?.phoneNumber || savedBuyer?.phoneNumber)?.replace(/\D/g, "")}`
                    : "#"
                }
                className="flex-1 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/[0.08] text-xs font-bold text-slate-200 transition flex items-center justify-center gap-1.5"
              >
                <PhoneCall className="h-3.5 w-3.5 text-emerald-400" />
                <span>Call Buyer</span>
              </a>

              <a
                href={
                  (() => {
                    const rawDigits = (order.buyer_phone || orderDelivery?.phoneNumber || savedBuyer?.phoneNumber || "").replace(/\D/g, "");
                    const intlPhone = rawDigits.startsWith("0") ? `234${rawDigits.slice(1)}` : rawDigits;
                    return intlPhone
                      ? `https://wa.me/${intlPhone}?text=${encodeURIComponent(
                          `Hello ${order.buyer_name || orderDelivery?.fullName || savedBuyer?.fullName || "Customer"}, regarding your order for "${order.item_title}" on ${BRAND_NAME} Escrow:`
                        )}`
                      : "#";
                  })()
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-extrabold transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        )}

        {/* Hidden notice while still awaiting deposit */}
        {currentRole === "seller" && order.status === "PENDING_PAYMENT" && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0B1120] p-4 text-xs text-slate-400 flex items-center gap-2.5">
            <Lock className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Buyer delivery address &amp; contact unlock once buyer locks funds into the escrow vault.</span>
          </div>
        )}

        {/* Seller View: Courier Handover & PIN Verification Details */}
        {currentRole === "seller" && order.status === "DISPATCHED" && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0B1120] p-4 sm:p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Courier Handover &amp; Transit
                </h3>
              </div>
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                In Transit
              </span>
            </div>

            {dispatchInfo?.riderPhone ? (
              <div className="flex items-center justify-between rounded-xl bg-[#060A14] border border-white/10 p-3 text-xs">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Rider Contact
                  </span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {dispatchInfo.riderPhone}
                  </span>
                  {dispatchInfo.trackingCode && (
                    <span className="text-[10px] text-slate-400 block font-mono mt-0.5">
                      Waybill: {dispatchInfo.trackingCode}
                    </span>
                  )}
                </div>
                <a
                  href={`tel:${dispatchInfo.riderPhone.replace(/\D/g, "")}`}
                  className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 border border-white/[0.08] flex items-center gap-1 transition"
                >
                  <PhoneCall className="h-3 w-3" />
                  <span>Call Rider</span>
                </a>
              </div>
            ) : null}

            <div className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-200/90 leading-relaxed">
              <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">4-Digit Delivery Handover PIN Active</p>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  The buyer has a unique 4-digit Delivery Handover PIN. Inform your dispatch rider to collect this PIN upon parcel handover, after which the buyer confirms delivery to release your payout.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2. Anti-Fraud Delivery Handover PIN Badge (Buyer View when Dispatched) */}
        {currentRole === "buyer" && order.status === "DISPATCHED" && (
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/15 to-amber-500/5 p-4 sm:p-5 shadow-xl text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Delivery Handover PIN</span>
            </div>
            <div className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-amber-300 tabular-nums">
              {getDeliveryHandoverPin(order.id)}
            </div>
            <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
              Share this PIN with the dispatch rider <span className="font-bold text-white">only when your item arrives</span> and has been inspected.
            </p>
          </div>
        )}

        {/* Completed Escrow Receipt Screen or Stepper */}
        {order.status === "FUNDS_RELEASED" ? (
          <CompletedReceipt
            order={order}
            buyerProfile={savedBuyer}
            timestamps={timestamps}
          />
        ) : (
          <LiveStepper
            status={order.status}
            isDisputed={isDisputed}
            isSeller={currentRole === "seller"}
            dispatchInfo={dispatchInfo}
          />
        )}

        {/* Payout Destination Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0B1120] p-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-amber-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Payout Destination Bank
              </h2>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Verified
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#0F172A] p-3 text-xs">
            <span className="text-slate-400">Destination Account</span>
            <span className="font-mono font-bold text-white tabular-nums">
              {order.seller_bank && order.seller_account_number
                ? `${order.seller_bank} ${maskAccountNumber(order.seller_account_number)}`
                : "Verified"}
            </span>
          </div>

          {order.status !== "FUNDS_RELEASED" && (
            <p className="mt-2.5 text-[11px] text-slate-400">
              Funds will disburse automatically to this verified account once the buyer approves
              delivery or the 24h auto-release window completes.
            </p>
          )}
        </div>

        {/* Action Error Banner */}
        {actionError && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
            <TriangleAlert className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Role Controls */}
        <div className="space-y-2 pt-1">
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
                    <Wallet className="h-5 w-5" />
                    <span>Confirm Delivery &amp; Release Funds</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowDisputeDrawer(true)}
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
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Tracking Code (Optional)
                </label>
                <input
                  type="text"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value)}
                  placeholder="e.g. GIG-78291"
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

        {/* Dispute Drawer */}
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
