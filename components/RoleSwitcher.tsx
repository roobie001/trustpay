"use client";

import { User, Store } from "lucide-react";

interface RoleSwitcherProps {
  currentRole: "buyer" | "seller";
  onRoleChange: (role: "buyer" | "seller") => void;
}

export function RoleSwitcher({ currentRole, onRoleChange }: RoleSwitcherProps) {
  return (
    <div className="flex items-center justify-center mb-4">
      <div className="inline-flex rounded-full bg-[#0F172A] p-1 border border-white/[0.08] shadow-inner">
        <button
          type="button"
          onClick={() => onRoleChange("buyer")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            currentRole === "buyer"
              ? "bg-amber-500 text-slate-950 shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <User className="h-3.5 w-3.5" />
          <span>Buyer View</span>
        </button>

        <button
          type="button"
          onClick={() => onRoleChange("seller")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            currentRole === "seller"
              ? "bg-amber-500 text-slate-950 shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Store className="h-3.5 w-3.5" />
          <span>Seller View</span>
        </button>
      </div>
    </div>
  );
}
