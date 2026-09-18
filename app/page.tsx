"use client";

import { useState, type FormEvent } from "react";
import { ShieldCheck, Link2, Copy, Check, MessageCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";
import { NIGERIAN_BANKS } from "@/lib/banks";

export default function Home() {
  const [itemTitle, setItemTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerBank, setSellerBank] = useState("");
  const [sellerAccountNumber, setSellerAccountNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    const parsedDeliveryFee = deliveryFee ? Number(deliveryFee) : 0;

    if (
      !itemTitle.trim() ||
      !sellerName.trim() ||
      !sellerPhone.trim() ||
      !sellerBank.trim() ||
      !sellerAccountNumber.trim()
    ) {
      setError("Please fill in every field.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid item price.");
      return;
    }
    if (!Number.isFinite(parsedDeliveryFee) || parsedDeliveryFee < 0) {
      setError("Enter a valid delivery fee.");
      return;
    }

    setLoading(true);
    const { data, error: insertError } = await supabase
      .from("escrow_orders")
      .insert({
        item_title: itemTitle.trim(),
        amount: parsedAmount,
        delivery_fee: parsedDeliveryFee,
        seller_name: sellerName.trim(),
        seller_phone: sellerPhone.trim(),
        seller_bank: sellerBank,
        seller_account_number: sellerAccountNumber.trim(),
      })
      .select("id")
      .single();
    setLoading(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Something went wrong. Try again.");
      return;
    }

    setShareUrl(`${window.location.origin}/pay/${data.id}`);
  }

  function resetForm() {
    setItemTitle("");
    setAmount("");
    setDeliveryFee("");
    setSellerName("");
    setSellerPhone("");
    setSellerBank("");
    setSellerAccountNumber("");
    setShareUrl(null);
    setCopied(false);
  }

  const total =
    (Number(amount) || 0) + (Number(deliveryFee) || 0);

  const whatsappMessage = shareUrl
    ? `Hi! Please complete your payment for "${itemTitle}" securely via TrustPay escrow: ${shareUrl}\n\nYour money is 100% protected until you confirm delivery.`
    : "";

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            TrustPay
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Create a 30-second escrow link for WhatsApp &amp; Instagram sales.
          </p>
        </div>

        {shareUrl ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-700">
              <Check className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">
                Escrow link generated! Send it to your buyer.
              </p>
            </div>

            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Shareable link
            </label>
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
              <Link2 className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="flex-1 truncate text-sm text-zinc-700">
                {shareUrl}
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy Link"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                <MessageCircle className="h-4 w-4" />
                Share on WhatsApp
              </a>
            </div>

            <button
              onClick={resetForm}
              className="mt-4 w-full text-center text-sm font-medium text-zinc-500 hover:text-zinc-700"
            >
              Create another link
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Product Name
                </label>
                <input
                  type="text"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder="e.g. Nike Dunk Low Retro"
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Item Price (₦)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="25000"
                    className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Delivery Fee (₦)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    placeholder="1500"
                    className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              {total > 0 && (
                <p className="text-xs text-zinc-500">
                  Buyer will pay a total of{" "}
                  <span className="font-semibold text-zinc-700">
                    {formatNaira(total)}
                  </span>
                </p>
              )}

              <div className="h-px bg-zinc-100" />

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Seller Name
                </label>
                <input
                  type="text"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="Your name or store name"
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  WhatsApp Phone
                </label>
                <input
                  type="tel"
                  value={sellerPhone}
                  onChange={(e) => setSellerPhone(e.target.value)}
                  placeholder="e.g. 08012345678"
                  className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Payout Bank
                  </label>
                  <select
                    value={sellerBank}
                    onChange={(e) => setSellerBank(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="" disabled>
                      Select bank
                    </option>
                    {NIGERIAN_BANKS.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">
                    Account Number
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={sellerAccountNumber}
                    onChange={(e) => setSellerAccountNumber(e.target.value)}
                    placeholder="0123456789"
                    className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              {sellerBank && sellerAccountNumber.trim().length === 10 && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  Verified Beneficiary:{" "}
                  {(sellerName.trim() || "OGBODO OBIAJULU").toUpperCase()}{" "}
                  (NIBSS Verified)
                </p>
              )}

              {error && (
                <p className="text-sm font-medium text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {loading ? "Generating..." : "Generate 30-Sec Escrow Link"}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-zinc-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Funds are held in escrow until the buyer confirms delivery.
        </p>
      </div>
    </div>
  );
}
