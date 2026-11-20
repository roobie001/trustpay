"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ShieldCheck,
  Link2,
  Copy,
  Check,
  MessageCircle,
  Loader2,
  TriangleAlert,
  Store,
  Clock,
  ArrowRight,
  ExternalLink,
  Lock,
  Landmark,
  Sparkles,
  ChevronDown,
  ChevronUp,
  UserCheck,
  AtSign,
  Phone,
} from "lucide-react";
import { formatNaira } from "@/lib/format";
import { NIGERIAN_BANKS } from "@/lib/banks";
import { BRAND_NAME, VAULT_NAME, whatsappPaymentMessage } from "@/lib/constants";
import {
  type SellerProfile,
  getSavedSellerProfile,
  saveSellerProfile,
} from "@/lib/storage";
import { MediopointLogo } from "@/components/MediopointLogo";

interface CreateOrderResult {
  orderId: string;
  itemTitle: string;
  buyerUrl: string;
  sellerUrl: string;
  totalAmount: number;
  sellerPhone: string;
  sellerName: string;
  socialHandle?: string;
  deliveryNote?: string;
}

const RECENT_ORDERS_KEY = "mediopoint_recent_orders";

export default function Home() {
  // Order specific fields
  const [itemTitle, setItemTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");

  // Seller profile fields
  const [businessName, setBusinessName] = useState("");
  const [socialHandle, setSocialHandle] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [sellerBankCode, setSellerBankCode] = useState("");
  const [sellerAccountNumber, setSellerAccountNumber] = useState("");
  const [savedProfile, setSavedProfile] = useState<SellerProfile | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateOrderResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<CreateOrderResult[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  // Bank resolution
  const [resolving, setResolving] = useState(false);
  const [resolvedAccountName, setResolvedAccountName] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const recentDealsRef = useRef<HTMLElement | null>(null);

  // Load saved seller profile and recent orders on mount
  useEffect(() => {
    const profile = getSavedSellerProfile();
    if (profile) {
      setSavedProfile(profile);
      setBusinessName(profile.businessName || "");
      setSocialHandle(profile.socialHandle || "");
      setWhatsappNumber(profile.whatsappNumber || "");
      setSellerBankCode(profile.bankCode || "");
      setSellerAccountNumber(profile.accountNumber || "");
      setResolvedAccountName(profile.accountName || null);
      setIsEditingProfile(false);
    } else {
      setIsEditingProfile(true);
    }

    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_ORDERS_KEY) ?? "[]");
      if (Array.isArray(saved)) setRecentOrders(saved);
    } catch {
      localStorage.removeItem(RECENT_ORDERS_KEY);
    }
  }, []);

  // Bank resolution effect
  useEffect(() => {
    let active = true;

    const timer = setTimeout(async () => {
      if (!active) return;
      if (!sellerBankCode || sellerAccountNumber.trim().length !== 10) {
        return;
      }

      setResolving(true);
      setResolveError(null);
      try {
        const params = new URLSearchParams({
          account_number: sellerAccountNumber.trim(),
          bank_code: sellerBankCode,
        });
        const res = await fetch(`/api/resolve-account?${params.toString()}`);
        const json = await res.json();
        if (!active) return;
        if (json.success) {
          setResolvedAccountName(json.account_name);
        } else {
          setResolveError(json.error ?? "Could not verify this account.");
        }
      } catch {
        if (active) setResolveError("Could not verify this account.");
      } finally {
        if (active) setResolving(false);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [sellerBankCode, sellerAccountNumber]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    const parsedDeliveryFee = deliveryFee ? Number(deliveryFee) : 0;

    const activeSellerName = businessName.trim() || savedProfile?.businessName || "";
    const activeSellerPhone = whatsappNumber.trim() || savedProfile?.whatsappNumber || "";
    const activeBankCode = sellerBankCode.trim() || savedProfile?.bankCode || "";
    const activeAccountNum = sellerAccountNumber.trim() || savedProfile?.accountNumber || "";

    if (!itemTitle.trim()) {
      setError("Please enter the item or service name.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid item price.");
      return;
    }
    if (!activeSellerName || !activeSellerPhone || !activeBankCode || !activeAccountNum) {
      setError("Please complete all seller payout details.");
      setIsEditingProfile(true);
      return;
    }

    setLoading(true);
    try {
      const bankName = NIGERIAN_BANKS.find((b) => b.code === activeBankCode)?.name || "Bank";

      // Save/persist seller profile in localStorage
      const newProfile: SellerProfile = {
        businessName: activeSellerName,
        socialHandle: socialHandle.trim(),
        whatsappNumber: activeSellerPhone,
        bankCode: activeBankCode,
        bankName,
        accountNumber: activeAccountNum,
        accountName: resolvedAccountName || savedProfile?.accountName,
      };
      saveSellerProfile(newProfile);
      setSavedProfile(newProfile);

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_title: itemTitle.trim(),
          amount: parsedAmount,
          delivery_fee: parsedDeliveryFee,
          seller_name: activeSellerName,
          seller_phone: activeSellerPhone,
          seller_bank_code: activeBankCode,
          seller_account_number: activeAccountNum,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Something went wrong. Try again.");
        return;
      }

      const savedOrder: CreateOrderResult = {
        orderId: json.id,
        itemTitle: itemTitle.trim(),
        buyerUrl: `${window.location.origin}/pay/${json.id}`,
        sellerUrl: `${window.location.origin}/seller/${json.id}?key=${json.sellerKey}`,
        totalAmount: json.total_amount,
        sellerPhone: activeSellerPhone,
        sellerName: activeSellerName,
        socialHandle: socialHandle.trim(),
        deliveryNote: deliveryNote.trim(),
      };

      const nextRecentOrders = [
        savedOrder,
        ...recentOrders.filter((order) => order.orderId !== savedOrder.orderId),
      ];
      setRecentOrders(nextRecentOrders);
      try {
        localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(nextRecentOrders));
      } catch {
        setError(
          "Order created, but browser could not save links. Copy them now to keep access."
        );
      }
      setResult(savedOrder);
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setItemTitle("");
    setAmount("");
    setDeliveryFee("");
    setDeliveryNote("");
    setResult(null);
    setCopied(null);
  }

  async function copyLink(which: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  }

  const total = (Number(amount) || 0) + (Number(deliveryFee) || 0);

  const formattedWhatsAppMsg = result
    ? `Hello! Here is your secure ${BRAND_NAME} escrow payment link for "${result.itemTitle}":\n\n💰 Total: ${formatNaira(result.totalAmount)}\n🔗 Payment Link: ${result.buyerUrl}\n\n🛡️ Your money remains 100% protected in the ${VAULT_NAME} until you inspect and approve doorstep delivery!`
    : "";

  const whatsappBackupMessage = result
    ? `${BRAND_NAME} Private Seller Console\nOrder: ${result.itemTitle}\nAmount: ${formatNaira(result.totalAmount)}\nSeller Dashboard Link: ${result.sellerUrl}\nBuyer Link: ${result.buyerUrl}`
    : "";

  const sellerPhoneDigits = result?.sellerPhone.replace(/\D/g, "") ?? "";
  const sellerWhatsappPhone = sellerPhoneDigits.startsWith("0")
    ? `234${sellerPhoneDigits.slice(1)}`
    : sellerPhoneDigits;

  return (
    <div className="relative min-h-screen dot-grid text-slate-100 flex flex-col items-center px-4 py-8 sm:py-12">
      {/* Soft ambient background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-amber-500/10 blur-[130px] rounded-full" />
        <div className="absolute top-1/2 -right-40 w-[420px] h-[420px] bg-emerald-500/8 blur-[140px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-[430px]">
        {/* Header */}
        <header className="mb-6 flex flex-col items-center text-center">
          <MediopointLogo className="mb-3.5 h-12 w-12" />

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {BRAND_NAME}
          </h1>

          <p className="mt-1 text-xs font-medium text-slate-400 max-w-xs">
            30-second escrow links for WhatsApp &amp; Instagram deals
          </p>

          {/* Emerald Trust Indicator */}
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
            </span>
            <span>Funds Locked Until Delivery</span>
          </div>

          {/* Recent Deals Toggle Pill */}
          {recentOrders.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowRecent(true);
                setTimeout(() => recentDealsRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
              }}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#0F172A] px-3 py-1 text-xs font-semibold text-slate-300 shadow-sm transition hover:border-amber-400/50 hover:text-amber-300"
            >
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              <span>Recent Deals</span>
              <span className="ml-0.5 rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] font-bold text-slate-300">
                {recentOrders.length}
              </span>
            </button>
          )}
        </header>

        {/* 1. Reusable Seller Profile Status Pill */}
        {savedProfile && !result && (
          <div className="mb-4 rounded-xl border border-white/[0.08] bg-[#0F172A] p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <UserCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate">
                      {savedProfile.businessName}
                    </span>
                    {savedProfile.socialHandle && (
                      <span className="text-[10px] text-amber-400 font-mono">
                        {savedProfile.socialHandle}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono truncate">
                    {savedProfile.bankName} &middot; •••• {savedProfile.accountNumber.slice(-4)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="shrink-0 text-xs font-bold text-amber-400 hover:text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 transition"
              >
                {isEditingProfile ? "Done" : "Edit Profile"}
              </button>
            </div>
          </div>
        )}

        {/* Post-Creation Share Card View */}
        {result ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0B1120] p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-emerald-300">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-sm">
                <Check className="h-4 w-4 stroke-[3]" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-white">Escrow Link Generated!</p>
                <p className="text-[11px] text-emerald-300/90 leading-tight mt-0.5">
                  Share the buyer link with your customer. Funds lock in the vault before dispatch.
                </p>
              </div>
            </div>

            {/* Deal Summary Pass */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0F172A] p-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="min-w-0 pr-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Item / Deal
                  </span>
                  <p className="text-sm font-bold text-white truncate">{result.itemTitle}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Buyer Pays
                  </span>
                  <p className="font-mono text-base font-extrabold text-amber-400 tabular-nums">
                    {formatNaira(result.totalAmount)}
                  </p>
                </div>
              </div>
              <div className="pt-2.5 flex items-center justify-between text-xs text-slate-400">
                <span>Vendor:</span>
                <span className="font-semibold text-slate-200">{result.sellerName}</span>
              </div>
            </div>

            {/* Buyer Payment Link Card */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Buyer Escrow Payment Link
                </label>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Share with Customer
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0F172A] px-3 py-2.5">
                <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="flex-1 truncate font-mono text-xs text-slate-200">
                  {result.buyerUrl}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => copyLink("buyer", result.buyerUrl)}
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.1] bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white shadow-sm transition active:scale-[0.98]"
                >
                  {copied === "buyer" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>

                <a
                  href={`https://wa.me/?text=${encodeURIComponent(formattedWhatsAppMsg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-md transition active:scale-[0.98]"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Share to WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Private Seller Dashboard Link */}
            <div className="rounded-xl border border-white/[0.08] bg-[#0F172A] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                  Private Seller Dashboard
                </span>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  Keep Secret
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Use this link to mark order dispatched and receive bank payout.
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => copyLink("seller", result.sellerUrl)}
                  className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-200 transition"
                >
                  {copied === "seller" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>{copied === "seller" ? "Copied" : "Copy Seller Link"}</span>
                </button>

                <a
                  href={`https://wa.me/${sellerWhatsappPhone}?text=${encodeURIComponent(
                    whatsappBackupMessage
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-slate-800/80 hover:bg-slate-700 px-3 text-xs font-semibold text-slate-200 transition"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Save to WhatsApp</span>
                </a>
              </div>

              <div className="pt-2 flex justify-end">
                <a
                  href={result.sellerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300"
                >
                  <span>Open Seller Dashboard</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="w-full h-11 rounded-xl border border-white/[0.08] bg-slate-900 text-xs font-bold text-slate-300 hover:text-white transition"
            >
              + Create Another Escrow Link
            </button>
          </div>
        ) : (
          /* Escrow Link Form Card */
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-white/[0.08] bg-[#0B1120] p-5 sm:p-6 shadow-2xl space-y-4"
          >
            {/* Quick Order Fields */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Item / Service Name
              </label>
              <input
                type="text"
                value={itemTitle}
                onChange={(e) => setItemTitle(e.target.value)}
                placeholder="e.g. Nike Dunk Low Retro (Size 43)"
                className="h-11 w-full rounded-xl border border-white/10 bg-[#060A14] px-3.5 text-xs sm:text-sm font-medium text-white placeholder:text-slate-500 shadow-inner outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Price (₦)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-500">
                    ₦
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="35,000"
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#060A14] pl-7 pr-3 text-xs sm:text-sm font-medium font-mono tabular-nums tracking-normal text-white placeholder:text-slate-500 shadow-inner outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Delivery Fee (₦)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-500">
                    ₦
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    placeholder="2,000"
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#060A14] pl-7 pr-3 text-xs sm:text-sm font-medium font-mono tabular-nums tracking-normal text-white placeholder:text-slate-500 shadow-inner outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Optional Delivery Note
              </label>
              <input
                type="text"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="e.g. Express courier to Lekki Phase 1"
                className="h-11 w-full rounded-xl border border-white/10 bg-[#060A14] px-3.5 text-xs font-medium text-white placeholder:text-slate-500 shadow-inner outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              />
            </div>

            {/* Live Total Breakdown Pill */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-3 flex items-center justify-between">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Buyer Pays Total:
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  100% Locked in Escrow
                </span>
              </div>
              <span className="font-mono text-base sm:text-lg font-extrabold text-amber-400 tabular-nums tracking-normal">
                {formatNaira(total)}
              </span>
            </div>

            {/* Collapsible / Editable Seller Profile Form */}
            {(isEditingProfile || !savedProfile) && (
              <div className="pt-3 border-t border-white/[0.06] space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    Seller Payout Profile
                  </span>
                  {savedProfile && (
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Hide
                    </button>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Store or Brand Name
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Lagos Drips Store"
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#060A14] px-3.5 text-xs sm:text-sm text-white placeholder:text-slate-500 shadow-inner outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Social Handle
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">
                        @
                      </span>
                      <input
                        type="text"
                        value={socialHandle}
                        onChange={(e) => setSocialHandle(e.target.value.replace(/^@/, ""))}
                        placeholder="instagram/tiktok"
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#060A14] pl-7 pr-3 text-xs sm:text-sm text-white placeholder:text-slate-500 shadow-inner outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      WhatsApp Phone
                    </label>
                    <input
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="08012345678"
                      className="h-11 w-full rounded-xl border border-white/10 bg-[#060A14] px-3.5 text-xs sm:text-sm font-mono tabular-nums tracking-normal text-white placeholder:text-slate-500 shadow-inner outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Payout Bank
                    </label>
                    <select
                      value={sellerBankCode}
                      onChange={(e) => setSellerBankCode(e.target.value)}
                      className="h-11 w-full rounded-xl border border-white/10 bg-[#060A14] px-3 text-xs sm:text-sm text-white shadow-inner outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                    >
                      <option value="" disabled>
                        Select Bank
                      </option>
                      {NIGERIAN_BANKS.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Account Number
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      value={sellerAccountNumber}
                      onChange={(e) =>
                        setSellerAccountNumber(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="10-digit NUBAN"
                      className="h-11 w-full rounded-xl border border-white/10 bg-[#060A14] px-3.5 text-xs sm:text-sm font-mono tabular-nums tracking-normal text-white placeholder:text-slate-500 shadow-inner outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                    />
                  </div>
                </div>

                {/* Account verification badge */}
                {sellerBankCode && sellerAccountNumber.length === 10 && (
                  <div>
                    {resolving && (
                      <div className="flex items-center gap-2 rounded-lg bg-slate-900 p-2 text-xs text-slate-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                        <span>Verifying account with NIBSS...</span>
                      </div>
                    )}
                    {!resolving && resolvedAccountName && (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-xs font-bold text-emerald-300">
                        <Check className="h-3.5 w-3.5 text-emerald-400 stroke-[3]" />
                        <span className="truncate">✓ VERIFIED: {resolvedAccountName}</span>
                      </div>
                    )}
                    {!resolving && resolveError && (
                      <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/30 p-2 text-xs text-rose-300">
                        <TriangleAlert className="h-3.5 w-3.5 text-rose-400" />
                        <span>{resolveError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300">
                <TriangleAlert className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Primary Gold CTA */}
            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[44px] h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-extrabold shadow-lg shadow-amber-500/20 transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating Escrow Link...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Create Escrow Link</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Recent Orders Section */}
        <section
          ref={recentDealsRef}
          className="mt-6 rounded-2xl border border-white/[0.08] bg-[#0B1120] p-5 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-amber-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Recent Deals on this Device
              </h2>
            </div>
            {recentOrders.length > 0 && (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                {recentOrders.length}
              </span>
            )}
          </div>

          {recentOrders.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              No recent escrow links created on this device yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {recentOrders.map((order) => {
                const buyerCopiedKey = `recent-buyer-${order.orderId}`;
                return (
                  <div
                    key={order.orderId}
                    className="rounded-xl border border-white/[0.06] bg-[#0F172A] p-3 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white truncate max-w-[180px]">
                        {order.itemTitle}
                      </span>
                      <span className="font-mono font-bold text-amber-400 tabular-nums">
                        {formatNaira(order.totalAmount)}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => copyLink(buyerCopiedKey, order.buyerUrl)}
                        className="flex-1 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 flex items-center justify-center gap-1 transition"
                      >
                        {copied === buyerCopiedKey ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>{copied === buyerCopiedKey ? "Copied" : "Copy Buyer Link"}</span>
                      </button>

                      <a
                        href={order.buyerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 flex items-center justify-center gap-1 transition"
                      >
                        <span>Open</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-8 mb-6 text-center text-xs text-slate-500">
          <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-1">
            <MediopointLogo className="h-4 w-4 rounded-md" />
            <span className="font-semibold text-white">{BRAND_NAME} Neutral Escrow Bridge</span>
          </div>
          <p className="text-[11px]">
            Funds held securely in {VAULT_NAME} until doorstep verification.
          </p>
        </footer>
      </div>
    </div>
  );
}
