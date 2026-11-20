"use client";

import { use, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import PaystackPop from "@paystack/inline-js";
import confetti from "canvas-confetti";
import {
  ShieldCheck,
  Loader2,
  PackageSearch,
  Check,
  Wallet,
  TriangleAlert,
  ArrowRight,
  User,
  Phone,
  Mail,
  Lock,
  MapPin,
  Landmark,
  Share2,
  CheckCircle2,
  MessageCircle,
  CreditCard,
  Copy,
  Zap,
} from "lucide-react";
import { supabase, type EscrowOrder } from "@/lib/supabase";
import { formatNaira, getDeliveryHandoverPin } from "@/lib/format";
import { BRAND_NAME, DEMO_DISPUTE_REFERENCE, VAULT_NAME } from "@/lib/constants";
import {
  type BuyerProfile,
  type DispatchInfo,
  getSavedBuyerProfile,
  saveBuyerProfile,
  saveOrderDeliveryDetails,
  getOrderDispatchInfo,
  getOrderDisputeInfo,
  getOrderTimestamps,
  updateOrderTimestamps,
} from "@/lib/storage";
import { MediopointLogo } from "@/components/MediopointLogo";
import { HeroVaultCard } from "@/components/HeroVaultCard";
import { LiveStepper } from "@/components/LiveStepper";
import { TrustBar } from "@/components/TrustBar";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { DisputeDrawer } from "@/components/DisputeDrawer";
import { CompletedReceipt } from "@/components/CompletedReceipt";

const PAYSTACK_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ||
  "pk_test_1d97a029666e02a048a09df20486ad8c08f2231d";

export default function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [order, setOrder] = useState<EscrowOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Buyer Profile Form
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [refundBank, setRefundBank] = useState("");
  const [refundAccountNumber, setRefundAccountNumber] = useState("");
  const [saveDetails, setSaveDetails] = useState(true);
  const [savedBuyer, setSavedBuyer] = useState<BuyerProfile | null>(null);
  const [isEditingBuyer, setIsEditingBuyer] = useState(false);

  // Active state controls
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<"buyer" | "seller">("buyer");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showDisputeDrawer, setShowDisputeDrawer] = useState(false);
  const [dispatchInfo, setDispatchInfo] = useState<DispatchInfo | null>(null);

  // Paystack Test Mode helpers
  const [copiedTestCard, setCopiedTestCard] = useState(false);
  const isTestMode = PAYSTACK_PUBLIC_KEY.startsWith("pk_test_");

  // Load saved buyer profile on mount
  useEffect(() => {
    const profile = getSavedBuyerProfile();
    if (profile) {
      setSavedBuyer(profile);
      setBuyerName(profile.fullName || "");
      setBuyerPhone(profile.phoneNumber || "");
      setBuyerEmail(profile.email || "");
      setDeliveryAddress(profile.deliveryAddress || "");
      setLandmark(profile.landmark || "");
      setRefundBank(profile.refundBank || "");
      setRefundAccountNumber(profile.refundAccountNumber || "");
      setIsEditingBuyer(false);
    } else {
      setIsEditingBuyer(true);
    }
  }, []);

  // Save buyer tracking link
  useEffect(() => {
    try {
      const trackingUrl = `${window.location.origin}/pay/${id}`;
      const storageKey = "mediopoint_buyer_tracking_links";
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      const links = Array.isArray(saved)
        ? saved.filter((url): url is string => typeof url === "string")
        : [];
      localStorage.setItem(
        storageKey,
        JSON.stringify([trackingUrl, ...links.filter((url) => url !== trackingUrl)].slice(0, 50))
      );
    } catch (storageError) {
      console.warn("Unable to save buyer tracking link:", storageError);
    }
  }, [id]);

  // Load order and dispatch info from storage & Supabase
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

    const dInfo = getOrderDispatchInfo(id);
    if (dInfo) setDispatchInfo(dInfo);

    const channel = supabase
      .channel(`pay_escrow_orders:${id}`)
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

  function copyTestCardNumber() {
    navigator.clipboard.writeText("4084084084084084");
    setCopiedTestCard(true);
    setTimeout(() => setCopiedTestCard(false), 2000);
  }

  // Simulate Instant Test Deposit (Friction-Free Test Mode Action)
  async function handleSimulateTestPayment() {
    if (!order) return;
    const activeName = buyerName.trim() || savedBuyer?.fullName || "Chioma Adeyemi (Test Buyer)";
    const activePhone = buyerPhone.trim() || savedBuyer?.phoneNumber || "08012345678";
    const activeEmail = buyerEmail.trim() || savedBuyer?.email || "buyer@test.com";
    const activeAddress = deliveryAddress.trim() || savedBuyer?.deliveryAddress || "14 Admiralty Way, Lekki Phase 1, Lagos";

    setPaying(true);
    setError(null);
    try {
      const testReference = `TRX_TEST_${order.id.slice(0, 8)}_${Date.now()}`;
      await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, reference: testReference }),
      });

      saveOrderDeliveryDetails(order.id, {
        fullName: activeName,
        phoneNumber: activePhone,
        deliveryAddress: activeAddress,
        landmark: landmark.trim(),
      });

      updateOrderTimestamps(order.id, {
        depositedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }),
      });

      await supabase
        .from("escrow_orders")
        .update({
          buyer_name: activeName,
          buyer_phone: activePhone,
          status: "HELD_IN_ESCROW",
        })
        .eq("id", order.id);

      const statusUrl = new URL(`/order/${order.id}`, window.location.origin);
      statusUrl.searchParams.set("reference", testReference);
      router.push(`${statusUrl.pathname}${statusUrl.search}`);
    } catch (err) {
      console.error("Test payment simulation error:", err);
      setError("Unable to simulate test payment.");
    } finally {
      setPaying(false);
    }
  }

  function handlePay(e: FormEvent) {
    e.preventDefault();
    if (!order) return;
    setError(null);

    const activeName = buyerName.trim() || savedBuyer?.fullName || "";
    const activePhone = buyerPhone.trim() || savedBuyer?.phoneNumber || "";
    const activeEmail = buyerEmail.trim() || savedBuyer?.email || "";
    const activeAddress = deliveryAddress.trim() || savedBuyer?.deliveryAddress || "";

    if (!activeName || !activePhone) {
      setError("Please provide your full name and phone number.");
      setIsEditingBuyer(true);
      return;
    }
    if (!activeEmail) {
      setError("Please enter your email address for your official escrow receipt.");
      setIsEditingBuyer(true);
      return;
    }
    if (!activeAddress) {
      setError("Please enter your delivery address/landmark for the courier.");
      setIsEditingBuyer(true);
      return;
    }
    if (!PAYSTACK_PUBLIC_KEY) {
      setError("Payments aren't configured yet. Missing Paystack public key.");
      return;
    }

    // Save buyer profile if checked
    if (saveDetails) {
      const profileToSave: BuyerProfile = {
        fullName: activeName,
        phoneNumber: activePhone,
        email: activeEmail,
        deliveryAddress: activeAddress,
        landmark: landmark.trim(),
        refundBank: refundBank.trim(),
        refundAccountNumber: refundAccountNumber.trim(),
        saveDetails: true,
      };
      saveBuyerProfile(profileToSave);
      setSavedBuyer(profileToSave);
    }

    setPaying(true);

    const total = Number(order.amount) + Number(order.delivery_fee || 0);
    const paystack = new PaystackPop();

    paystack.newTransaction({
      key: PAYSTACK_PUBLIC_KEY,
      email: activeEmail,
      amount: Math.round(total * 100),
      currency: "NGN",
      metadata: {
        order_id: order.id,
        buyer_name: activeName,
        buyer_phone: activePhone,
        delivery_address: activeAddress,
      },
      onSuccess: async (response) => {
        const reference = response.reference || response.trxref;
        if (reference) {
          try {
            const verification = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: order.id, reference }),
              signal: AbortSignal.timeout(8000),
            });
            if (!verification.ok) {
              console.error("Payment verification is still pending:", await verification.text());
            }
          } catch (verificationError) {
            console.error("Failed to verify Paystack payment:", verificationError);
          }
        }

        saveOrderDeliveryDetails(order.id, {
          fullName: activeName,
          phoneNumber: activePhone,
          deliveryAddress: activeAddress,
          landmark: landmark.trim(),
        });

        updateOrderTimestamps(order.id, {
          depositedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }),
        });

        await supabase
          .from("escrow_orders")
          .update({
            buyer_name: activeName,
            buyer_phone: activePhone,
          })
          .eq("id", order.id);

        const statusUrl = new URL(`/order/${order.id}`, window.location.origin);
        if (reference) statusUrl.searchParams.set("reference", reference);
        router.push(`${statusUrl.pathname}${statusUrl.search}`);
      },
      onCancel: () => {
        setPaying(false);
      },
    });
  }

  async function handleReleaseFunds() {
    if (!order) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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

  async function handleDisputeResolution() {
    await handleReleaseFunds();
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-[#030712]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          <p className="text-xs font-semibold text-slate-400">Loading protected checkout...</p>
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
          This escrow deal link does not exist or has expired.
        </p>
      </div>
    );
  }

  const total = Number(order.amount) + Number(order.delivery_fee || 0);
  const isDisputed = order.status === "DISPUTED";
  const timestamps = getOrderTimestamps(order.id);

  // Active Escrow State (order has been deposited / funded)
  if (order.status !== "PENDING_PAYMENT") {
    return (
      <div className="relative min-h-screen dot-grid text-slate-100 flex flex-col items-center px-4 py-8 sm:py-12">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-amber-500/10 blur-[130px] rounded-full" />
          <div className="absolute top-1/2 -right-40 w-[420px] h-[420px] bg-emerald-500/8 blur-[140px] rounded-full" />
        </div>

        <div className="relative z-10 w-full max-w-[430px] space-y-4">
          {/* Role Switcher Pill */}
          <RoleSwitcher currentRole={currentRole} onRoleChange={setCurrentRole} />

          {/* Header */}
          <div className="text-center">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              {order.item_title}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Vendor: <span className="text-amber-400 font-semibold">{order.seller_name}</span> &middot;{" "}
              {currentRole === "buyer" ? "Buyer Order Tracking" : "Seller Command Console"}
            </p>
          </div>

          {/* Hero Escrow Vault Card */}
          <HeroVaultCard
            amount={total}
            status={order.status}
            itemTitle={order.item_title}
            sellerName={order.seller_name}
            isDisputed={isDisputed}
            isSeller={currentRole === "seller"}
          />

          {/* Dispute Active Banner */}
          {isDisputed && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs">
                <TriangleAlert className="h-4 w-4 text-rose-400 shrink-0" />
                <span>Escrow Payout Paused: Active Mediation</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                A dispute was flagged under case #{DEMO_DISPUTE_REFERENCE}. Both parties can view notes &amp; upload proof in the panel below.
              </p>
              <button
                type="button"
                onClick={() => setShowDisputeDrawer(true)}
                className="mt-1 h-9 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-bold text-rose-200 transition flex items-center justify-center gap-1.5"
              >
                <span>Open Dispute &amp; Evidence Panel</span>
              </button>
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

          {/* Completed Receipt Card (When FUNDS_RELEASED) */}
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

          {/* Action Error */}
          {actionError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
              <TriangleAlert className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Buyer Role Controls */}
          {currentRole === "buyer" && !isDisputed && order.status !== "FUNDS_RELEASED" && (
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleReleaseFunds}
                disabled={busy}
                className="flex min-h-[44px] h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Releasing Escrow Funds...</span>
                  </>
                ) : (
                  <>
                    <Wallet className="h-5 w-5" />
                    <span>Confirm Delivery &amp; Release Funds</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowDisputeDrawer(true)}
                disabled={busy}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 transition"
              >
                <TriangleAlert className="h-3.5 w-3.5" />
                <span>Raise a Dispute (Pause Payout)</span>
              </button>
            </div>
          )}

          {/* Dispute Drawer Modal */}
          <DisputeDrawer
            orderId={order.id}
            itemTitle={order.item_title}
            isOpen={showDisputeDrawer}
            onClose={() => setShowDisputeDrawer(false)}
            onResolveAndRelease={handleDisputeResolution}
            currentUserRole={currentRole}
          />
        </div>
      </div>
    );
  }

  // Unpaid State: Flow 2 Buyer Checkout & Reusable Delivery Details
  return (
    <div className="relative min-h-screen dot-grid text-slate-100 flex flex-col items-center px-4 py-8 sm:py-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-amber-500/10 blur-[130px] rounded-full" />
        <div className="absolute top-1/2 -right-40 w-[420px] h-[420px] bg-emerald-500/8 blur-[140px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-[430px] space-y-4">
        {/* Deal Header */}
        <header className="flex flex-col items-center text-center mb-1">
          <MediopointLogo className="mb-3 h-12 w-12" />
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {order.item_title}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Sold by <span className="text-amber-400 font-semibold">{order.seller_name}</span> &middot;{" "}
            {order.seller_phone}
          </p>
        </header>

        {/* Paystack Test Mode Active Indicator & Test Card Banner */}
        {isTestMode && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                </span>
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Paystack Test Mode Active
                </span>
              </div>
              <span className="text-[10px] font-mono text-amber-400/80 bg-amber-500/20 px-2 py-0.5 rounded-full">
                pk_test
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug">
              Simulation environment active. You can use Paystack test card credentials or simulate instant deposit.
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={copyTestCardNumber}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 border border-white/[0.1] px-2.5 py-1.5 text-[11px] font-mono text-amber-300 hover:text-white transition"
              >
                <CreditCard className="h-3 w-3 text-amber-400" />
                <span>{copiedTestCard ? "Copied 4084 0840 8408 4084!" : "Copy Test Card"}</span>
              </button>

              <button
                type="button"
                onClick={handleSimulateTestPayment}
                disabled={paying}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-2.5 py-1.5 text-[11px] font-bold text-amber-200 transition"
              >
                <Zap className="h-3 w-3 text-amber-400" />
                <span>Simulate Instant Deposit</span>
              </button>
            </div>
          </div>
        )}

        {/* 3-Step Visual Trust Bar */}
        <TrustBar />

        {/* Order Summary Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0B1120] p-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Order Breakdown
            </span>
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              Escrow Protected
            </span>
          </div>

          <div className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span>Item Cost</span>
              <span className="font-mono font-semibold text-white tabular-nums">
                {formatNaira(Number(order.amount))}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span>Delivery Fee</span>
              <span className="font-mono font-semibold text-white tabular-nums">
                {formatNaira(Number(order.delivery_fee))}
              </span>
            </div>

            <div className="border-t border-white/[0.06] pt-2 flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-white">Total into Escrow</span>
                <p className="text-[11px] text-slate-500">Held safely until delivery</p>
              </div>
              <span className="font-mono text-2xl font-extrabold text-amber-400 tabular-nums">
                {formatNaira(total)}
              </span>
            </div>
          </div>
        </div>

        {/* Reusable Buyer Profile / Delivery Details Form */}
        <form
          onSubmit={handlePay}
          className="rounded-2xl border border-white/[0.08] bg-[#0B1120] p-5 shadow-2xl space-y-4"
        >
          {/* Saved Delivery Details Pill (Returning Buyer) */}
          {savedBuyer && !isEditingBuyer ? (
            <div className="rounded-xl border border-white/[0.08] bg-[#0F172A] p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wide">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Saved Delivery Details</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingBuyer(true)}
                  className="text-xs font-bold text-slate-300 hover:text-white px-2 py-0.5 rounded border border-white/[0.1] bg-slate-800"
                >
                  Edit
                </button>
              </div>

              <div className="text-xs space-y-1 pt-1 text-slate-300">
                <div className="font-semibold text-white">{savedBuyer.fullName}</div>
                <div className="font-mono text-slate-400">{savedBuyer.phoneNumber} &middot; {savedBuyer.email}</div>
                <div className="text-slate-400 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{savedBuyer.deliveryAddress}</span>
                </div>
              </div>
            </div>
          ) : (
            /* First-time Buyer Inputs or Editing */
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Buyer &amp; Delivery Details
                </span>
                {savedBuyer && (
                  <button
                    type="button"
                    onClick={() => setIsEditingBuyer(false)}
                    className="text-xs text-amber-400 hover:text-amber-300"
                  >
                    Use Saved Details
                  </button>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Full Name
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <User className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="e.g. Chioma Adeyemi"
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0F172A] pl-9 pr-3 text-xs sm:text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Phone Number
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <Phone className="h-4 w-4" />
                    </span>
                    <input
                      type="tel"
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      placeholder="08012345678"
                      className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0F172A] pl-9 pr-3 text-xs sm:text-sm font-mono tabular-nums text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type="email"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0F172A] pl-9 pr-3 text-xs sm:text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Doorstep Delivery Address
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="e.g. 14 Admiralty Way, Lekki Phase 1, Lagos"
                    className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0F172A] pl-9 pr-3 text-xs sm:text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Landmark (Optional)
                  </label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="Opposite Ebeano Supermarket"
                    className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0F172A] px-3 text-xs text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Refund Account (Optional)
                  </label>
                  <input
                    type="text"
                    value={refundAccountNumber}
                    onChange={(e) => setRefundAccountNumber(e.target.value)}
                    placeholder="Bank &amp; Account No"
                    className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0F172A] px-3 text-xs font-mono text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Save details checkbox */}
              <label className="flex items-center gap-2 pt-1 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveDetails}
                  onChange={(e) => setSaveDetails(e.target.checked)}
                  className="rounded border-white/[0.2] bg-slate-900 text-amber-500 focus:ring-0"
                />
                <span>Save my details for faster checkout next time</span>
              </label>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
              <TriangleAlert className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Gold CTA */}
          <button
            type="submit"
            disabled={paying}
            className="flex min-h-[44px] h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold shadow-lg shadow-amber-500/20 transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {paying ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Connecting to Paystack...</span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 stroke-[2.5]" />
                <span>Deposit into Escrow ({formatNaira(total)})</span>
              </>
            )}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-500">
          🔒 256-bit encrypted checkout powered by Paystack &amp; NIBSS.
        </p>
      </div>
    </div>
  );
}
