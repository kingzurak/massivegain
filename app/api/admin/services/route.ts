import { NextResponse } from "next/server";
import { requireAdmin, badRequest, readJson, writeFailed } from "@/lib/admin/api";

export const runtime = "nodejs";

const MAX_DESCRIPTION_LENGTH = 1000;

interface ServiceNumbers {
  price_per_thousand: number;
  min_quantity: number;
  max_quantity: number;
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
 * PATCH /api/admin/services — update price/min/max/active.
 *
 * Body: { serviceId, pricePerThousand?, minQuantity?, maxQuantity?, active? }
 *
 * Partial updates are validated against the stored row, so sending only
 * `active` (the activate/deactivate button) can't accidentally widen a
 * min/max range that was never submitted.
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
    .select("price_per_thousand, min_quantity, max_quantity")
    .eq("id", serviceId)
    .maybeSingle<ServiceNumbers>();

  if (fetchError) return writeFailed("service lookup", fetchError.message);
  if (!existing) return badRequest("That service couldn't be found.");

  const price =
    body.pricePerThousand !== undefined ? Number(body.pricePerThousand) : existing.price_per_thousand;
  const min = body.minQuantity !== undefined ? Number(body.minQuantity) : existing.min_quantity;
  const max = body.maxQuantity !== undefined ? Number(body.maxQuantity) : existing.max_quantity;

  const numbersError = validateNumbers(price, min, max);
  if (numbersError) return badRequest(numbersError);

  const update: Record<string, number | boolean> = {
    price_per_thousand: price,
    min_quantity: min,
    max_quantity: max,
  };
  if (typeof body.active === "boolean") update.active = body.active;

  const { error } = await supabase.from("services").update(update).eq("id", serviceId);
  if (error) return writeFailed("service update", error.message);

  return NextResponse.json({ ok: true });
}
