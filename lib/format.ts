export function formatNaira(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `₦ ${safeAmount.toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function getDeliveryHandoverPin(orderId: string): string {
  if (!orderId) return "4821";
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    const char = orderId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const positive = Math.abs(hash);
  const pin = 1000 + (positive % 9000);
  return pin.toString();
}
