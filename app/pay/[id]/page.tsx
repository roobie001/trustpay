"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, PackageSearch } from "lucide-react";
import { supabase, type EscrowOrder } from "@/lib/supabase";
import { formatNaira } from "@/lib/format";

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

  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
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
    })();
    return () => {
      active = false;
    };
  }, [id]);

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    if (!order) return;
    setError(null);

    if (!buyerName.trim() || !buyerPhone.trim()) {
      setError("Please enter your name and phone number.");
      return;
    }

    setPaying(true);

    // Simulated checkout — swap for a real Paystack popup in production.
    await new Promise((resolve) => setTimeout(resolve, 1400));

    const { error: updateError } = await supabase
      .from("escrow_orders")
      .update({
        buyer_name: buyerName.trim(),
        buyer_phone: buyerPhone.trim(),
        status: "HELD_IN_ESCROW",
      })
      .eq("id", order.id);

    if (updateError) {
      setPaying(false);
      setError(updateError.message);
      return;
    }

    router.push(`/order/${order.id}`);
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
          This escrow link doesn&apos;t exist or was removed.
        </p>
      </div>
    );
  }

  if (order.status !== "PENDING_PAYMENT") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-zinc-50 px-4 text-center">
        <ShieldCheck className="h-8 w-8 text-emerald-500" />
        <p className="text-sm font-medium text-zinc-600">
          This order has already been paid for.
        </p>
        <a
          href={`/order/${order.id}`}
          className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
        >
          View order status &rarr;
        </a>
      </div>
    );
  }

  const total = Number(order.amount) + Number(order.delivery_fee);

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">
            {order.item_title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Sold by {order.seller_name}
          </p>
        </div>

        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-sm leading-relaxed text-emerald-800">
            <span className="font-semibold">100% Vault Protected:</span> The
            seller is not paid until you receive and inspect your package.
          </p>
        </div>

        <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between text-zinc-600">
              <span>Item Cost</span>
              <span className="font-medium text-zinc-900">
                {formatNaira(Number(order.amount))}
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-600">
              <span>Delivery Fee</span>
              <span className="font-medium text-zinc-900">
                {formatNaira(Number(order.delivery_fee))}
              </span>
            </div>
            <div className="h-px bg-zinc-100" />
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-900">
                Total to Lock
              </span>
              <span className="text-lg font-bold text-emerald-600">
                {formatNaira(total)}
              </span>
            </div>
          </div>
        </div>

        <form
          onSubmit={handlePay}
          className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Your Name
              </label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Phone Number
              </label>
              <input
                type="tel"
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="e.g. 08012345678"
                className="w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            {error && (
              <p className="text-sm font-medium text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={paying}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Locking funds in vault...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Pay {formatNaira(total)} into Escrow
                </>
              )}
            </button>
          </div>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-400">
          Simulated checkout for demo purposes.
        </p>
      </div>
    </div>
  );
}
