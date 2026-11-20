export const BRAND_NAME = "Mediopoint";
export const BRAND_TAGLINE = "Peer-to-Peer Social Commerce Escrow";
export const VAULT_NAME = `${BRAND_NAME} Vault`;
export const DEMO_DISPUTE_REFERENCE = "MP-902";

export function whatsappPaymentMessage(itemTitle: string, buyerUrl: string): string {
  return `Hi! Please complete your payment for "${itemTitle}" securely via ${BRAND_NAME} escrow: ${buyerUrl}\n\nYour money is 100% protected until you confirm delivery.`;
}
