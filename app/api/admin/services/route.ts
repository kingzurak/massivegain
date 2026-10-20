import { NextResponse } from "next/server";
import { requireAdmin, badRequest, readJson, writeFailed } from "@/lib/admin/api";
import {
  computeSellPrice,
  globalDefaultsFrom,
  resolveCharge,
} from "@/lib/pricing";

export const runtime = "nodejs";

const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_CHARGE_PERCENT = 1000;

interface EditableService {
  price_per_thousand: number;
  min_quantity: number;
  max_quantity: number;
  provider_rate: number | null;
  charge_percent: number | null;
  charge_flat: number | null;
}

/**
 * Validates price/min/max together — max can only be judged against min, so
 * they're never checked in isolation. Returns a message on failure.
 */
function validateNumbers(price: number, min: number, max: number): string | null {
  if (!Number.isFinite(price) || price <= 0) return "Enter a price greater than 0.";
  if (!Number.isInteger(min) || min <= 0) return "Enter a minimum quantity greater than 0.";
  if (!Number.isInteger(max) || max < min) {
    return "Maximum quantity must be greater than or equal to the minimum.";
  }
  return null;
}

/**
 * Reads an optional charge override from the body: undefined = leave as-is,
 * null/"" = clear back to the global default, otherwise a number >= 0.
 */
function readChargeOverride(
  raw: unknown
): { ok: true; value: number | null | undefined } | { ok: false; message: string } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null || raw === "") return { ok: true, value: null };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, message: "Enter a charge of 0 or more, or leave it blank to use the default." };
  }
  return { ok: true, value };
}

/** POST /api/admin/services — create a service. */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { supabase } = guard.session;

  const body = await readJson(request);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!name) return badRequest("Enter a service name.");
  if (!categoryId) return badRequest("Choose a category.");
  if (description.length > MAX_DESCRIPTION_LENGTH) return badRequest("That description is too long.");

  const price = Number(body.pricePerThousand);
  const min = Number(body.minQuantity);
  const max = Number(body.maxQuantity);
  const numbersError = validateNumbers(price, min, max);
  if (numbersError) return badRequest(numbersError);

  const { error } = await supabase.from("services").insert({
    name,
    category_id: categoryId,
    description,
    price_per_thousand: price,
    min_quantity: min,
    max_quantity: max,
  });

  if (error) {
    if (error.code === "23503") return badRequest("That category no longer exists.");
    return writeFailed("service create", error.message);
  }

  return NextResponse.json({ ok: true });
}

/**
 * PATCH /api/admin/services — update price/min/max/active/provider cost/charge.
 *
 * Body (all optional except serviceId):
 *   { serviceId, pricePerThousand?, minQuantity?, maxQuantity?, active?,
 *     providerRate?, chargePercent?, chargeFlat? }
 *
 * Partial updates are validated against the stored row, so sending only
 * `active` (the activate/deactivate button) can't accidentally widen a
 * min/max range that was never submitted.
 *
 * `providerRate` is what the provider charges per 1,000 (NGN); `chargePercent`
 * and `chargeFlat` are what WE add on top. When a provider cost is known the
 * sell price is DERIVED as cost * (1 + percent/100) + flat (per-service value,
 * else the global default) — a hand-sent `pricePerThousand` is ignored for
 * such services, which is what guarantees we never sell below cost. A service
 * with no provider cost keeps a hand-entered price and ignores the charge.
 */
export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { supabase } = guard.session;

  const body = await readJson(request);
  const serviceId = typeof body.serviceId === "string" ? body.serviceId : "";
  if (!serviceId) return badRequest("Missing service id.");

  const { data: existing, error: fetchError } = await supabase
    .from("services")
    .select("price_per_thousand, min_quantity, max_quantity, provider_rate, charge_percent, charge_flat")
    .eq("id", serviceId)
    .maybeSingle<EditableService>();

  if (fetchError) return writeFailed("service lookup", fetchError.message);
  if (!existing) return badRequest("That service couldn't be found.");

  const min = body.minQuantity !== undefined ? Number(body.minQuantity) : existing.min_quantity;
  const max = body.maxQuantity !== undefined ? Number(body.maxQuantity) : existing.max_quantity;

  // Resolve provider cost and charge overrides from the body, falling back to
  // the stored row when a key isn't present.
  let providerRate = existing.provider_rate;
  if (body.providerRate !== undefined) {
    const rate = body.providerRate;
    if (rate === null || rate === "") {
      providerRate = null;
    } else {
      const value = Number(rate);
      if (!Number.isFinite(value) || value < 0) {
        return badRequest("Enter a provider cost of 0 or more, or leave it blank.");
      }
      providerRate = value;
    }
  }

  const percentRead = readChargeOverride(body.chargePercent);
  if (!percentRead.ok) return badRequest(percentRead.message);
  const flatRead = readChargeOverride(body.chargeFlat);
  if (!flatRead.ok) return badRequest(flatRead.message);

  const chargePercent = percentRead.value === undefined ? existing.charge_percent : percentRead.value;
  const chargeFlat = flatRead.value === undefined ? existing.charge_flat : flatRead.value;

  if (chargePercent != null && chargePercent > MAX_CHARGE_PERCENT) {
    return badRequest(`Enter a markup between 0 and ${MAX_CHARGE_PERCENT}.`);
  }

  const { data: settings } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", ["bestclout_markup_percent", "default_charge_flat"])
    .returns<{ key: string; value: string }[]>();
  const defaults = globalDefaultsFrom(settings);

  // Price: derived from cost + charge when the cost is known, else manual.
  const derived = computeSellPrice({ providerRate, chargePercent, chargeFlat }, defaults);
  let price: number;
  if (derived != null) {
    price = derived;
  } else {
    price =
      body.pricePerThousand !== undefined ? Number(body.pricePerThousand) : existing.price_per_thousand;
  }

  const numbersError = validateNumbers(price, min, max);
  if (numbersError) return badRequest(numbersError);

  const update: Record<string, number | boolean | string | null> = {
    price_per_thousand: price,
    min_quantity: min,
    max_quantity: max,
    provider_rate: providerRate,
    charge_percent: chargePercent,
    charge_flat: chargeFlat,
  };
  if (typeof body.active === "boolean") update.active = body.active;

  const { error } = await supabase.from("services").update(update).eq("id", serviceId);
  if (error) return writeFailed("service update", error.message);

  // Echo back the resolved numbers so the UI can confirm what was stored.
  const charge = derived != null ? resolveCharge({ providerRate, chargePercent, chargeFlat }, defaults) : null;
  return NextResponse.json({
    ok: true,
    price,
    providerCost: providerRate,
    chargePercent: charge?.percent ?? chargePercent,
    chargeFlat: charge?.flat ?? chargeFlat,
    margin: providerRate != null ? Math.round((price - providerRate) * 100) / 100 : null,
  });
}
