/**
 * Joins class names, skipping falsy values.
 * Kept dependency-free on purpose so it can be imported from both
 * client components and server route handlers.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Wallet funding bounds, in whole naira. Shared by the funding form and the
 * server-side validator in /api/paystack/initialize so the two can never
 * disagree about what's allowed.
 */
export const MIN_DEPOSIT_NAIRA = 1000;
export const MAX_DEPOSIT_NAIRA = 1_000_000;

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}
