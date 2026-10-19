"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import type { Category } from "@/lib/supabase/types";

export default function CategoryManager({
  open,
  onClose,
  categories,
  serviceCountByCategory,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  serviceCountByCategory: Map<string, number>;
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a category name.");
      return;
    }

    setAdding(true);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    const json = await res.json().catch(() => null);
    setAdding(false);

    if (!res.ok) {
      setError(json?.error ?? "Couldn't add that category.");
      return;
    }

    setName("");
    router.refresh();
  }

  async function handleDelete(category: Category) {
    setError(null);
    setDeletingId(category.id);
    const res = await fetch("/api/admin/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: category.id }),
    });
    const json = await res.json().catch(() => null);
    setDeletingId(null);

    if (!res.ok) {
      setError(json?.error ?? "Couldn't delete that category.");
      return;
    }
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage categories"
      footer={
        <Button variant="outline" type="button" onClick={onClose}>
          Done
        </Button>
      }
    >
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-brick-100 px-3.5 py-2.5 text-sm text-brick-700">
          {error}
        </div>
      )}

      <form className="flex items-end gap-2" onSubmit={handleAdd}>
        <FormField
          label="New category"
          placeholder="e.g. LinkedIn"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={adding} className="mb-[1px]">
          {adding ? "Adding…" : "Add"}
        </Button>
      </form>

      <ul className="mt-5 flex flex-col divide-y divide-surface-border border-t border-surface-border">
        {categories.length === 0 && (
          <li className="py-3 text-sm text-ink-soft">No categories yet.</li>
        )}
        {categories.map((c) => {
          const count = serviceCountByCategory.get(c.id) ?? 0;
          return (
            <li key={c.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="text-ink">{c.name}</p>
                <p className="text-xs text-ink-soft">
                  {count} {count === 1 ? "service" : "services"}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={count > 0 || deletingId === c.id}
                title={count > 0 ? "Move or remove its services first" : undefined}
                onClick={() => handleDelete(c)}
              >
                {deletingId === c.id ? "…" : "Delete"}
              </Button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
