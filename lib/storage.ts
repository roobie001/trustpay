export interface SellerProfile {
  businessName: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  socialHandle: string;
  whatsappNumber: string;
  accountName?: string;
}

export interface BuyerProfile {
  fullName: string;
  phoneNumber: string;
  email: string;
  deliveryAddress: string;
  landmark?: string;
  refundBank?: string;
  refundAccountNumber?: string;
  saveDetails: boolean;
}

export interface DispatchInfo {
  riderPhone: string;
  trackingCode?: string;
  dispatchedAt: string;
}

export interface DisputeMessage {
  id: string;
  sender: "buyer" | "seller";
  text: string;
  timestamp: string;
}

export interface DisputeInfo {
  reason: string;
  notes: DisputeMessage[];
  evidenceImages: string[]; // base64 data URLs
  pausedAt: string;
  isResolved?: boolean;
}

export interface OrderTimestamps {
  depositedAt?: string;
  dispatchedAt?: string;
  releasedAt?: string;
}

const SELLER_PROFILE_KEY = "mediopoint_seller_profile";
const LEGACY_SELLER_PROFILE_KEY = "trustpay_seller_profile";
const BUYER_PROFILE_KEY = "mediopoint_buyer_profile";
const LEGACY_BUYER_PROFILE_KEY = "trustpay_buyer_profile";

export function getSavedSellerProfile(): SellerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SELLER_PROFILE_KEY) || localStorage.getItem(LEGACY_SELLER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSellerProfile(profile: SellerProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SELLER_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn("Failed to save seller profile:", e);
  }
}

export function getSavedBuyerProfile(): BuyerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BUYER_PROFILE_KEY) || localStorage.getItem(LEGACY_BUYER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveBuyerProfile(profile: BuyerProfile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BUYER_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn("Failed to save buyer profile:", e);
  }
}

export function getOrderDispatchInfo(orderId: string): DispatchInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(`mediopoint_dispatch_${orderId}`) ||
      localStorage.getItem(`trustpay_dispatch_${orderId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOrderDispatchInfo(orderId: string, info: DispatchInfo): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`mediopoint_dispatch_${orderId}`, JSON.stringify(info));
  } catch (e) {
    console.warn("Failed to save dispatch info:", e);
  }
}

export function getOrderDisputeInfo(orderId: string): DisputeInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(`mediopoint_dispute_${orderId}`) ||
      localStorage.getItem(`trustpay_dispute_${orderId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOrderDisputeInfo(orderId: string, info: DisputeInfo): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`mediopoint_dispute_${orderId}`, JSON.stringify(info));
  } catch (e) {
    console.warn("Failed to save dispute info:", e);
  }
}

export function getOrderTimestamps(orderId: string): OrderTimestamps {
  if (typeof window === "undefined") return {};
  try {
    const raw =
      localStorage.getItem(`mediopoint_timestamps_${orderId}`) ||
      localStorage.getItem(`trustpay_timestamps_${orderId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function updateOrderTimestamps(orderId: string, updates: Partial<OrderTimestamps>): void {
  if (typeof window === "undefined") return;
  try {
    const current = getOrderTimestamps(orderId);
    const updated = { ...current, ...updates };
    localStorage.setItem(`mediopoint_timestamps_${orderId}`, JSON.stringify(updated));
  } catch (e) {
    console.warn("Failed to update timestamps:", e);
  }
}
