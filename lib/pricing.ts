/**
 * Platform charge and derived sell price — the single source of truth.
 *
 * A service is priced as: provider cost + our charge, in NGN per 1,000.
 * The charge has two independent parts that compose:
 *
 *   - a markup percent over the cost, and
 *   - a flat NGN amount added on top.
 *
 * Either, both, or neither can be set. Each falls back to a global default
 * when the service itself doesn't override it. The sell price is never typed
 * by hand when a cost is known — it is derived here, so an order can't be
 * priced below cost by accident.
 *
 * Services with no known cost (provider_rate is null — manually fulfilled)
 * are not touched by any of this; their price is entered by hand.
 */

export interface ChargeInputs {
  /** What the provider charges per 1,000, in NGN. Null = unknown (manual). */
  providerRate: number | null;
  /** Per-service markup percent, or null to use the global default. */
  chargePercent: number | null;
  /** Per-service flat NGN per 1,000, or null to use the global default. */
  chargeFlat: number | null;
}

export interface GlobalChargeDefaults {
  percent: number;
  flat: number;
}

export interface ResolvedCharge {
  percent: number;
  flat: number;
}

function finiteOr(value: number | null, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The effective charge for a service: its override where set, else global. */
export function resolveCharge(
  inputs: ChargeInputs,
  defaults: GlobalChargeDefaults
): ResolvedCharge {
  return {
    percent: finiteOr(inputs.chargePercent, defaults.percent),
    flat: finiteOr(inputs.chargeFlat, defaults.flat),
  };
}

/** Our money per 1,000, given a known cost and the resolved charge. */
export function computeCharge(cost: number, charge: ResolvedCharge): number {
  return round2(cost * (charge.percent / 100) + charge.flat);
}

/**
 * The sell price per 1,000. Returns null when there is no known cost — the
 * caller keeps the hand-entered price in that case.
 */
export function computeSellPrice(
  inputs: ChargeInputs,
  defaults: GlobalChargeDefaults
): number | null {
  if (inputs.providerRate == null || !Number.isFinite(inputs.providerRate)) {
    return null;
  }
  const charge = resolveCharge(inputs, defaults);
  return round2(inputs.providerRate * (1 + charge.percent / 100) + charge.flat);
}

/**
 * Reads the global defaults from a `system_settings` row set, tolerating a
 * missing or malformed value (falls back to the historical 30% / ₦0).
 */
export function globalDefaultsFrom(
  settings: { key: string; value: string }[] | null | undefined
): GlobalChargeDefaults {
  const byKey = new Map((settings ?? []).map((s) => [s.key, Number(s.value)]));
  const percent = byKey.get("bestclout_markup_percent");
  const flat = byKey.get("default_charge_flat");
  return {
    percent: Number.isFinite(percent) ? (percent as number) : 30,
    flat: Number.isFinite(flat) ? (flat as number) : 0,
  };
}
