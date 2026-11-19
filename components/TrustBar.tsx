"use client";

import { ShieldCheck, Truck, PackageCheck, ChevronRight } from "lucide-react";

export function TrustBar() {
  const steps = [
    {
      num: "1",
      title: "Money locks in vault",
      icon: ShieldCheck,
    },
    {
      num: "2",
      title: "Vendor dispatches",
      icon: Truck,
    },
    {
      num: "3",
      title: "Inspect & release",
      icon: PackageCheck,
    },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0F172A] p-4 shadow-xl">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
          TrustPay 3-Step Buyer Protection
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className="relative flex flex-col items-center rounded-xl bg-slate-900/90 border border-white/[0.06] p-2.5 shadow-sm"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 mb-1.5 border border-amber-500/20">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="text-[11px] font-bold text-slate-200 leading-tight">
                {step.num}. {step.title}
              </div>
              {idx < steps.length - 1 && (
                <div className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600">
                  <ChevronRight className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 text-center text-[11px] text-slate-400 leading-relaxed">
        The vendor is not paid until you receive and verify the item at your doorstep.
      </p>
    </div>
  );
}
