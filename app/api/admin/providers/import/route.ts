import { NextResponse } from "next/server";
import { requireAdmin, badRequest, readJson, writeFailed } from "@/lib/admin/api";
import { getCatalogue } from "@/lib/providers/bestclout";
import { globalDefaultsFrom } from "@/lib/pricing";
import type { Category, Service } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MARKUP_PERCENT = 1000;

/** Collapses control characters and runs of whitespace in provider labels. */
function cleanLabel(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Provider categories carry emoji and stray codes. We keep the readable ASCII
 * and fall back to a single catch-all when nothing legible remains, rather
 * than creating a category whose name is just symbols.
 */
function categoryLabel(raw: string): string {
  const cleaned = cleanLabel(raw)
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Bestclout";
}

function priceWithMarkup(rate: number, markupPercent: number): number {
  return Math.round(rate * (1 + markupPercent / 100) * 100) / 100;
}

/**
 * POST /api/admin/providers/import — import the bestclout catalogue.
 *
 * Only Default-type services are imported: Custom Comments / Comment Likes /
 * Comment Replies need customer-supplied text we don't collect, and Package
 * services aren't per-1,000 work. Everything lands ACTIVE at the provider rate
 * plus the configured charge, so the catalogue is orderable immediately.
 * Services already mapped to a provider service id are skipped, so re-running
 * only adds what's new.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { supabase } = guard.session;

  const body = await readJson(request);

  let markup = Number(body.markupPercent);
  if (!Number.isFinite(markup)) {
    const { data: setting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "bestclout_markup_percent")
      .maybeSingle<{ value: string }>();
    markup = Number(setting?.value ?? 30);
  }
  if (!Number.isFinite(markup) || markup < 0 || markup > MAX_MARKUP_PERCENT) {
    return badRequest(`Enter a markup between 0 and ${MAX_MARKUP_PERCENT}.`);
  }

  // The flat fee (if any) applies on top of the markup, same as at checkout.
  const { data: settingRows } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", ["bestclout_markup_percent", "default_charge_flat"])
    .returns<{ key: string; value: string }[]>();
  const flat = globalDefaultsFrom(settingRows).flat;

  let catalogue;
  try {
    catalogue = await getCatalogue();
  } catch (err) {
    return writeFailed("provider import", err instanceof Error ? err.message : "Couldn't reach bestclout.");
  }

  const importable = catalogue.filter((s) => s.type === "Default" && s.rate > 0);

  const { data: existing, error: existingError } = await supabase
    .from("services")
    .select("provider_service_id")
    .not("provider_service_id", "is", null)
    .returns<Pick<Service, "provider_service_id">[]>();
  if (existingError) return writeFailed("provider import lookup", existingError.message);

  const alreadyMapped = new Set((existing ?? []).map((s) => s.provider_service_id));
  const toImport = importable.filter((s) => !alreadyMapped.has(s.service));
  const skipped = importable.length - toImport.length;

  const { data: categories, error: categoryError } = await supabase
    .from("categories")
    .select("id, name")
    .returns<Pick<Category, "id" | "name">[]>();
  if (categoryError) return writeFailed("provider import categories", categoryError.message);

  const categoryIdByName = new Map((categories ?? []).map((c) => [c.name, c.id]));
  const wanted = Array.from(new Set(toImport.map((s) => categoryLabel(s.category))));
  const missing = wanted.filter((name) => !categoryIdByName.has(name));

  if (missing.length > 0) {
    const { data: created, error: createError } = await supabase
      .from("categories")
      .insert(missing.map((name) => ({ name })))
      .select("id, name")
      .returns<Pick<Category, "id" | "name">[]>();
    if (createError) return writeFailed("provider import category create", createError.message);
    for (const category of created ?? []) categoryIdByName.set(category.name, category.id);
  }

  const rows = toImport.map((s) => ({
    name: cleanLabel(s.name),
    category_id: categoryIdByName.get(categoryLabel(s.category)) as string,
    description: "",
    price_per_thousand: Math.round((priceWithMarkup(s.rate, markup) + flat) * 100) / 100,
    min_quantity: s.min,
    max_quantity: s.max,
    active: true,
    provider: "bestclout",
    provider_service_id: s.service,
    provider_rate: s.rate,
    provider_service_type: s.type,
  }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("services").insert(rows);
    if (insertError) return writeFailed("provider import insert", insertError.message);
  }

  return NextResponse.json({
    ok: true,
    imported: rows.length,
    skipped,
    categoriesCreated: missing.length,
    markup,
  });
}
