export const BRAND_NAME = "MedioPoint";
export const BRAND_TAGLINE = "The Neutral Escrow Bridge for Social Commerce";
export const VAULT_NAME = `${BRAND_NAME} Vault`;
export const DEMO_DISPUTE_REFERENCE = "MDP-902";

export function whatsappPaymentMessage(itemTitle: string, buyerUrl: string): string {
  return `Hi! Please complete your payment for "${itemTitle}" securely via ${BRAND_NAME} escrow: ${buyerUrl}\n\nYour money is 100% protected until you confirm delivery.`;
}
