"use client";

import { useState, useRef, useEffect, type ChangeEvent } from "react";
import {
  TriangleAlert,
  X,
  Upload,
  Send,
  CheckCircle2,
  Image as ImageIcon,
  ShieldAlert,
  Clock,
  Trash2,
  Scale,
  FileCheck,
} from "lucide-react";
import {
  type DisputeInfo,
  type DisputeMessage,
  getOrderDisputeInfo,
  saveOrderDisputeInfo,
} from "@/lib/storage";

interface DisputeDrawerProps {
  orderId: string;
  itemTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onResolveAndRelease: () => Promise<void>;
  currentUserRole: "buyer" | "seller";
}

const STRUCTURED_REASONS = [
  "Item not delivered",
  "Wrong or damaged item",
  "Seller delayed dispatch",
  "Other",
];

export function DisputeDrawer({
  orderId,
  itemTitle,
  isOpen,
  onClose,
  onResolveAndRelease,
  currentUserRole,
}: DisputeDrawerProps) {
  const [dispute, setDispute] = useState<DisputeInfo | null>(null);
  const [selectedReason, setSelectedReason] = useState(STRUCTURED_REASONS[0]);
  const [customNote, setCustomNote] = useState("");
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const existing = getOrderDisputeInfo(orderId);
    if (existing) {
      setDispute(existing);
      setSelectedReason(existing.reason || STRUCTURED_REASONS[0]);
      setPreviewImages(existing.evidenceImages || []);
    } else {
      const initial: DisputeInfo = {
        reason: STRUCTURED_REASONS[0],
        notes: [
          {
            id: "initial-note",
            sender: currentUserRole,
            text: `Dispute opened: ${STRUCTURED_REASONS[0]}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ],
        evidenceImages: [],
        pausedAt: new Date().toISOString(),
      };
      saveOrderDisputeInfo(orderId, initial);
      setDispute(initial);
    }
  }, [isOpen, orderId, currentUserRole]);

  if (!isOpen) return null;

  function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const nextImages = [...previewImages, reader.result];
        setPreviewImages(nextImages);
        if (dispute) {
          const updated: DisputeInfo = {
            ...dispute,
            evidenceImages: nextImages,
          };
          setDispute(updated);
          saveOrderDisputeInfo(orderId, updated);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleRemoveImage(index: number) {
    const nextImages = previewImages.filter((_, idx) => idx !== index);
    setPreviewImages(nextImages);
    if (dispute) {
      const updated: DisputeInfo = {
        ...dispute,
        evidenceImages: nextImages,
      };
      setDispute(updated);
      saveOrderDisputeInfo(orderId, updated);
    }
  }

  function handleSendNote() {
    if (!customNote.trim()) return;

    const newMsg: DisputeMessage = {
      id: Date.now().toString(),
      sender: currentUserRole,
      text: customNote.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updated: DisputeInfo = {
      reason: selectedReason,
      notes: [...(dispute?.notes || []), newMsg],
      evidenceImages: previewImages,
      pausedAt: dispute?.pausedAt || new Date().toISOString(),
    };

    setDispute(updated);
    saveOrderDisputeInfo(orderId, updated);
    setCustomNote("");
  }

  function handleReasonSelect(reason: string) {
    setSelectedReason(reason);
    if (dispute) {
      const updated: DisputeInfo = {
        ...dispute,
        reason,
      };
      setDispute(updated);
      saveOrderDisputeInfo(orderId, updated);
    }
  }

  async function handleResolve() {
    setIsResolving(true);
    try {
      if (dispute) {
        saveOrderDisputeInfo(orderId, { ...dispute, isResolved: true });
      }
      await onResolveAndRelease();
      onClose();
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl border border-rose-500/30 bg-[#0B1120] text-slate-100 p-5 sm:p-6 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Escrow Dispute Panel</h3>
                <span className="rounded-full bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">
                  Escrow Payout Paused
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{itemTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.05]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dispute Reason Selector */}
        <div className="mt-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Dispute Reason
          </label>
          <div className="grid grid-cols-2 gap-2">
            {STRUCTURED_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleReasonSelect(r)}
                className={`text-left text-xs px-3 py-2.5 rounded-xl border transition-all ${
                  selectedReason === r
                    ? "border-rose-500/50 bg-rose-500/15 text-rose-300 font-semibold"
                    : "border-white/[0.08] bg-slate-900/60 text-slate-400 hover:text-slate-200"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Escrow Settlement Criteria Info Box */}
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
            <Scale className="h-4 w-4" />
            <span>Escrow Settlement Criteria</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Funds remain securely held in the vault until both parties resolve or mediation settles based on:
          </p>
          <ul className="text-[11px] text-slate-300 space-y-1.5 pl-1">
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-amber-400">1.</span>
              <span>
                <strong className="text-white font-semibold">Seller Dispatch Proof:</strong> Verified rider phone contact and courier waybill/dispatch receipt.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-amber-400">2.</span>
              <span>
                <strong className="text-white font-semibold">Buyer Unboxing Evidence:</strong> Timestamped photo evidence and notes logged in this thread.
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="font-bold text-amber-400">3.</span>
              <span>
                <strong className="text-white font-semibold">Order Description &amp; Window:</strong> Verification against the original agreed item title and delivery note.
              </span>
            </li>
          </ul>
        </div>

        {/* Evidence Photo Upload */}
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-amber-400" />
              <span>Evidence Photos (Offline / Client-Side)</span>
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/[0.08] px-2.5 py-1 text-xs font-semibold text-slate-200 transition"
            >
              <Upload className="h-3 w-3" />
              <span>Attach Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>

          {previewImages.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {previewImages.map((src, i) => (
                <div
                  key={i}
                  className="relative group h-16 w-16 rounded-lg overflow-hidden border border-white/[0.1] bg-slate-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="Evidence preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(i)}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic">
              No evidence images attached yet. Tap &apos;Attach Photo&apos; to preview package/rider proof.
            </p>
          )}
        </div>

        {/* Notes / Message Thread */}
        <div className="mt-4 pt-3 border-t border-white/[0.06]">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
            Mediation Message Thread
          </label>
          <div className="max-h-40 overflow-y-auto space-y-2 rounded-xl bg-slate-950/60 p-3 border border-white/[0.06]">
            {dispute?.notes.map((note) => (
              <div
                key={note.id}
                className={`rounded-lg p-2 text-xs ${
                  note.sender === "buyer"
                    ? "bg-amber-500/10 border border-amber-500/20 text-slate-200"
                    : "bg-emerald-500/10 border border-emerald-500/20 text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  <span>{note.sender === "buyer" ? "Buyer" : "Vendor"}</span>
                  <span className="font-mono">{note.timestamp}</span>
                </div>
                <p className="leading-relaxed">{note.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSendNote();
                }
              }}
              placeholder={`Add a mediation note as ${currentUserRole}...`}
              className="h-10 flex-1 rounded-xl border border-white/[0.1] bg-slate-900/90 px-3 text-xs text-white placeholder:text-slate-500 outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={handleSendNote}
              className="h-10 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center justify-center"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 pt-4 border-t border-white/[0.08] flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-white/[0.1] text-xs font-bold text-slate-300 hover:bg-white/[0.05] transition"
          >
            Keep Paused &amp; Close Panel
          </button>
          <button
            type="button"
            onClick={handleResolve}
            disabled={isResolving}
            className="h-11 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold text-xs shadow-lg transition flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{isResolving ? "Resolving..." : "Resolve & Release Funds"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
