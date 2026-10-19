import { NextResponse } from "next/server";
import { requireAdmin, badRequest, readJson, writeFailed } from "@/lib/admin/api";

export const runtime = "nodejs";

/** POST /api/admin/categories — create a category. Body: { name: string } */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { supabase } = guard.session;

  const body = await readJson(request);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return badRequest("Enter a category name.");
  if (name.length > 80) return badRequest("That category name is too long.");

  const { error } = await supabase.from("categories").insert({ name });

  if (error) {
    // 23505 = unique_violation: the name is already taken.
    if (error.code === "23505") {
      return NextResponse.json({ error: "That category already exists." }, { status: 409 });
    }
    return writeFailed("category create", error.message);
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/categories — delete a category.
 * Body: { id: string }
 *
 * The database refuses this while services still reference the category
 * (ON DELETE RESTRICT), which is the intended safety net rather than
 * something to work around here.
 */
export async function DELETE(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { supabase } = guard.session;

  const body = await readJson(request);
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return badRequest("Missing category id.");

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json(
        { error: "Move or remove this category's services first." },
        { status: 409 }
      );
    }
    return writeFailed("category delete", error.message);
  }

  return NextResponse.json({ ok: true });
}
