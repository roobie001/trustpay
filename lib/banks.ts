// Paystack/NIBSS bank codes, verified against GET https://api.paystack.co/bank
// (country=nigeria) on 2026-09-29. Digital bank codes (Kuda, Opay, PalmPay,
// Moniepoint) occasionally change upstream — re-verify before large releases.
export const NIGERIAN_BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "Zenith Bank", code: "057" },
  { name: "GTBank", code: "058" },
  { name: "UBA", code: "033" },
  { name: "First Bank", code: "011" },
  { name: "Fidelity Bank", code: "070" },
  { name: "Union Bank", code: "032" },
  { name: "Sterling Bank", code: "232" },
  { name: "Wema Bank", code: "035" },
  { name: "Polaris Bank", code: "076" },
  { name: "Stanbic IBTC", code: "221" },
  { name: "Ecobank", code: "050" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Opay", code: "999992" },
  { name: "PalmPay", code: "999991" },
  { name: "Moniepoint", code: "50515" },
] as const;

export function bankNameForCode(code: string): string | undefined {
  return NIGERIAN_BANKS.find((bank) => bank.code === code)?.name;
}

export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.trim();
  if (digits.length <= 4) return digits;
  return `•••• ${digits.slice(-4)}`;
}
