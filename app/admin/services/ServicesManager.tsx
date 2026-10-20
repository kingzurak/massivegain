"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { formatNaira } from "@/lib/utils";
import type { Category, ServiceWithCategory } from "@/lib/supabase/types";
import type { GlobalChargeDefaults } from "@/lib/pricing";
import CategoryManager from "./CategoryManager";

const textareaClass =
  "rounded-md border border-surface-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/20";

interface CreateForm {
  name: string;
  categoryId: string;
  description: string;
  price: string;
  min: string;
  max: string;
}

const emptyCreateForm: CreateForm = {
  name: "",
  categoryId: "",
  description: "",
  price: "",
  min: "",
  max: "",
};

export default function ServicesManager({
  services,
  categories,
  defaults,
}: {
  services: ServiceWithCategory[];
  categories: Category[];
  defaults: GlobalChargeDefaults;
}) {
  const router = useRouter();

  const [addOpen, setAddOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [editingService, setEditingService] = useState<ServiceWithCategory | null>(null);
  const [editForm, setEditForm] = useState({
    price: "",
    min: "",
    max: "",
    active: true,
    providerRate: "",
    chargePercent: "",
    chargeFlat: "",
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const serviceCountByCategory = new Map<string, number>();
  for (const s of services) {
    serviceCountByCategory.set(s.category_id, (serviceCountByCategory.get(s.category_id) ?? 0) + 1);
  }

  function openEdit(service: ServiceWithCategory) {
    setEditError(null);
    setEditingService(service);
    setEditForm({
      price: String(service.price_per_thousand),
      min: String(service.min_quantity),
      max: String(service.max_quantity),
      active: service.active,
      providerRate: service.provider_rate != null ? String(service.provider_rate) : "",
      chargePercent: service.charge_percent != null ? String(service.charge_percent) : "",
      chargeFlat: service.charge_flat != null ? String(service.charge_flat) : "",
    });
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);

    const { name, categoryId, description, price, min, max } = createForm;
    if (!name.trim() || !categoryId) {
      setCreateError("Name and category are required.");
      return;
    }
    const priceNum = Number(price);
    const minNum = Number(min);
    const maxNum = Number(max);
    if (!priceNum || priceNum <= 0) {
      setCreateError("Enter a price greater than 0.");
      return;
    }
    if (!minNum || minNum <= 0) {
      setCreateError("Enter a minimum quantity greater than 0.");
      return;
    }
    if (!maxNum || maxNum < minNum) {
      setCreateError("Maximum quantity must be greater than or equal to the minimum.");
      return;
    }

    setCreating(true);
    const res = await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        categoryId,
        description: description.trim(),
        pricePerThousand: priceNum,
        minQuantity: minNum,
        maxQuantity: maxNum,
      }),
    });
    const json = await res.json().catch(() => null);
    setCreating(false);

    if (!res.ok) {
      setCreateError(json?.error ?? "Couldn't create that service.");
      return;
    }

    setAddOpen(false);
    setCreateForm(emptyCreateForm);
    router.refresh();
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingService) return;
    setEditError(null);

    const minNum = Number(editForm.min);
    const maxNum = Number(editForm.max);
    if (!minNum || minNum <= 0) {
      setEditError("Enter a minimum quantity greater than 0.");
      return;
    }
    if (!maxNum || maxNum < minNum) {
      setEditError("Maximum quantity must be greater than or equal to the minimum.");
      return;
    }

    // Blank means "no known provider cost"; otherwise a real amount >= 0.
    const costRaw = editForm.providerRate.trim();
    const providerRate = costRaw === "" ? null : Number(costRaw);
    if (providerRate !== null && (!Number.isFinite(providerRate) || providerRate < 0)) {
      setEditError("Enter a provider cost of 0 or more, or leave it blank.");
      return;
    }

    // Charge overrides: blank = use the global default.
    const percentRaw = editForm.chargePercent.trim();
    const chargePercent = percentRaw === "" ? null : Number(percentRaw);
    if (chargePercent !== null && (!Number.isFinite(chargePercent) || chargePercent < 0)) {
      setEditError("Enter a markup of 0 or more, or leave it blank to use the default.");
      return;
    }
    const flatRaw = editForm.chargeFlat.trim();
    const chargeFlat = flatRaw === "" ? null : Number(flatRaw);
    if (chargeFlat !== null && (!Number.isFinite(chargeFlat) || chargeFlat < 0)) {
      setEditError("Enter a flat fee of 0 or more, or leave it blank to use the default.");
      return;
    }

    // Price is only sent for services with no provider cost (manual pricing);
    // otherwise the server derives it from cost + charge.
    const manualPrice = providerRate == null ? Number(editForm.price) : undefined;
    if (providerRate == null && (!manualPrice || manualPrice <= 0)) {
      setEditError("Enter a price greater than 0.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/admin/services", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId: editingService.id,
        minQuantity: minNum,
        maxQuantity: maxNum,
        active: editForm.active,
        providerRate,
        chargePercent,
        chargeFlat,
        ...(manualPrice !== undefined ? { pricePerThousand: manualPrice } : {}),
      }),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      setEditError(json?.error ?? "Couldn't save those changes.");
      return;
    }

    setEditingService(null);
    router.refresh();
  }

  async function handleToggleActive(service: ServiceWithCategory) {
    setPageError(null);
    setTogglingId(service.id);
    const res = await fetch("/api/admin/services", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId: service.id, active: !service.active }),
    });
    setTogglingId(null);

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setPageError(json?.error ?? "Couldn't change that service's status.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
          Manage categories
        </Button>
        <Button
          onClick={() => {
            setCreateError(null);
            setCreateForm(emptyCreateForm);
            setAddOpen(true);
          }}
          disabled={categories.length === 0}
        >
          Add service
        </Button>
      </div>

      {pageError && (
        <div className="mb-4 rounded-md border border-red-200 bg-brick-100 px-3.5 py-2.5 text-sm text-brick-700">
          {pageError}
        </div>
      )}

      {categories.length === 0 && (
        <p className="mb-4 text-xs text-ink-soft">
          No categories exist yet — click &ldquo;Manage categories&rdquo; to add one before
          creating services.
        </p>
      )}

      {services.length === 0 ? (
        <EmptyState
          title="No services yet"
          description="Add your first service to start building the catalogue."
        />
      ) : (
        <Table>
          <THead>
            <TRow>
              <TH>Service</TH>
              <TH>Category</TH>
              <TH>Provider</TH>
              <TH>Price / 1,000</TH>
              <TH>Cost / 1,000</TH>
              <TH>Margin</TH>
              <TH>Our charge</TH>
              <TH>Min / Max</TH>
              <TH>Status</TH>
              <TH>Action</TH>
            </TRow>
          </THead>
          <tbody>
            {services.map((service) => {
              const margin =
                service.provider_rate != null
                  ? service.price_per_thousand - service.provider_rate
                  : null;
              const chargePercent = service.charge_percent ?? defaults.percent;
              const chargeFlat = service.charge_flat ?? defaults.flat;
              return (
              <TRow key={service.id}>
                <TD className="font-medium">{service.name}</TD>
                <TD>{service.category?.name ?? "Uncategorized"}</TD>
                <TD className="capitalize">{service.provider}</TD>
                <TD>{formatNaira(service.price_per_thousand)}</TD>
                <TD>
                  {service.provider_rate != null ? formatNaira(service.provider_rate) : "—"}
                </TD>
                <TD className={margin != null && margin < 0 ? "font-medium text-brick-700" : ""}>
                  {margin != null ? formatNaira(margin) : "—"}
                </TD>
                <TD className="text-xs text-ink-soft">
                  {service.provider_rate != null ? `${chargePercent}% + ${formatNaira(chargeFlat)}` : "—"}
                </TD>
                <TD>
                  {service.min_quantity.toLocaleString()} / {service.max_quantity.toLocaleString()}
                </TD>
                <TD>
                  <Badge status={service.active ? "active" : "inactive"} />
                </TD>
                <TD>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(service)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={togglingId === service.id}
                      onClick={() => handleToggleActive(service)}
                    >
                      {togglingId === service.id
                        ? "…"
                        : service.active
                        ? "Deactivate"
                        : "Activate"}
                    </Button>
                  </div>
                </TD>
              </TRow>
              );
            })}
          </tbody>
        </Table>
      )}

      {/* Add service */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add service"
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)} type="button">
              Cancel
            </Button>
            <Button type="submit" form="create-service-form" disabled={creating}>
              {creating ? "Adding…" : "Add service"}
            </Button>
          </>
        }
      >
        {createError && (
          <div className="mb-4 rounded-md border border-red-200 bg-brick-100 px-3.5 py-2.5 text-sm text-brick-700">
            {createError}
          </div>
        )}
        <form className="flex flex-col gap-4" onSubmit={handleCreate} id="create-service-form">
          <FormField
            label="Service name"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="category" className="text-sm font-medium text-ink">
              Category
            </label>
            <select
              id="category"
              className={textareaClass}
              value={createForm.categoryId}
              onChange={(e) => setCreateForm((f) => ({ ...f, categoryId: e.target.value }))}
              required
            >
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-sm font-medium text-ink">
              Description
            </label>
            <textarea
              id="description"
              rows={2}
              className={textareaClass}
              value={createForm.description}
              onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <FormField
            label="Price per 1,000 (₦)"
            type="number"
            min={1}
            value={createForm.price}
            onChange={(e) => setCreateForm((f) => ({ ...f, price: e.target.value }))}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Min quantity"
              type="number"
              min={1}
              value={createForm.min}
              onChange={(e) => setCreateForm((f) => ({ ...f, min: e.target.value }))}
              required
            />
            <FormField
              label="Max quantity"
              type="number"
              min={1}
              value={createForm.max}
              onChange={(e) => setCreateForm((f) => ({ ...f, max: e.target.value }))}
              required
            />
          </div>
        </form>
      </Modal>

      {/* Edit service */}
      <Modal
        open={!!editingService}
        onClose={() => setEditingService(null)}
        title={editingService ? `Edit — ${editingService.name}` : "Edit service"}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingService(null)} type="button">
              Cancel
            </Button>
            <Button type="submit" form="edit-service-form" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      >
        {editError && (
          <div className="mb-4 rounded-md border border-red-200 bg-brick-100 px-3.5 py-2.5 text-sm text-brick-700">
            {editError}
          </div>
        )}
        <form className="flex flex-col gap-4" onSubmit={handleSaveEdit} id="edit-service-form">
          <FormField
            label="Provider cost per 1,000 (₦)"
            type="number"
            min={0}
            placeholder="Leave blank if unknown"
            value={editForm.providerRate}
            onChange={(e) => setEditForm((f) => ({ ...f, providerRate: e.target.value }))}
            hint="What the provider charges you. Blank means we don't know it — then you price by hand below."
          />
          {(() => {
            const costRaw = editForm.providerRate.trim();
            const costNum = costRaw === "" ? null : Number(costRaw);
            const hasCost = costNum !== null && Number.isFinite(costNum) && costNum >= 0;
            const pctRaw = editForm.chargePercent.trim();
            const pct = pctRaw === "" ? defaults.percent : Number(pctRaw);
            const flatRaw = editForm.chargeFlat.trim();
            const flat = flatRaw === "" ? defaults.flat : Number(flatRaw);
            const pctOk = Number.isFinite(pct) && pct >= 0;
            const flatOk = Number.isFinite(flat) && flat >= 0;

            const derived =
              hasCost && pctOk && flatOk
                ? Math.round((costNum * (1 + pct / 100) + flat) * 100) / 100
                : null;
            const margin = derived != null && hasCost ? Math.round((derived - costNum) * 100) / 100 : null;

            return (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    label="Our markup (%)"
                    type="number"
                    min={0}
                    placeholder={`${defaults.percent}`}
                    value={editForm.chargePercent}
                    onChange={(e) => setEditForm((f) => ({ ...f, chargePercent: e.target.value }))}
                    hint="Blank uses the global default."
                  />
                  <FormField
                    label="Our flat fee (₦/1,000)"
                    type="number"
                    min={0}
                    placeholder={`${defaults.flat}`}
                    value={editForm.chargeFlat}
                    onChange={(e) => setEditForm((f) => ({ ...f, chargeFlat: e.target.value }))}
                    hint="Blank uses the global default."
                  />
                </div>

                {hasCost ? (
                  <>
                    <div className="flex items-center justify-between rounded-md bg-surface-muted px-3.5 py-3 text-sm">
                      <span className="text-ink-soft">Price per 1,000 (cost + our charge)</span>
                      <span className="font-display text-base text-navy-900">
                        {derived != null ? formatNaira(derived) : "—"}
                      </span>
                    </div>
                    {margin != null && (
                      <div className="flex items-center justify-between text-xs text-ink-soft">
                        <span>Our charge — this is what we keep</span>
                        <span className={margin < 0 ? "font-medium text-brick-700" : "font-medium text-navy-900"}>
                          {formatNaira(margin)}
                          {margin < 0 && <span className="ml-2 font-normal text-brick-700">selling at a loss</span>}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <FormField
                    label="Price per 1,000 (₦)"
                    type="number"
                    min={1}
                    value={editForm.price}
                    onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                    hint="No provider cost known, so you set the price by hand."
                    required
                  />
                )}
              </>
            );
          })()}
          {editingService && (
            <div className="rounded-md border border-surface-border px-3.5 py-3 text-xs text-ink-soft">
              <p className="font-medium text-ink-muted">Provider mapping</p>
              <p className="mt-1 capitalize">Provider: {editingService.provider}</p>
              <p>Service id: {editingService.provider_service_id ?? "—"}</p>
              <p>Type: {editingService.provider_service_type ?? "—"}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Min quantity"
              type="number"
              min={1}
              value={editForm.min}
              onChange={(e) => setEditForm((f) => ({ ...f, min: e.target.value }))}
              required
            />
            <FormField
              label="Max quantity"
              type="number"
              min={1}
              value={editForm.max}
              onChange={(e) => setEditForm((f) => ({ ...f, max: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="status" className="text-sm font-medium text-ink">
              Status
            </label>
            <select
              id="status"
              className={textareaClass}
              value={editForm.active ? "active" : "inactive"}
              onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.value === "active" }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </form>
      </Modal>

      <CategoryManager
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        categories={categories}
        serviceCountByCategory={serviceCountByCategory}
      />
    </>
  );
}
