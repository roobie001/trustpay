export const NIGERIAN_BANKS = [
  "Access Bank",
  "Zenith Bank",
  "GTBank",
  "UBA",
  "First Bank",
  "Fidelity Bank",
  "Union Bank",
  "Sterling Bank",
  "Wema Bank",
  "Polaris Bank",
  "Stanbic IBTC",
  "Ecobank",
  "Kuda Bank",
  "Opay",
  "PalmPay",
  "Moniepoint",
] as const;

export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.trim();
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}
