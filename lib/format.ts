export function formatNaira(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `₦ ${safeAmount.toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
