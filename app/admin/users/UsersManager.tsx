"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/client";
import { formatNaira } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

export interface AdminUserRow extends Profile {
  walletBalance: number;
}

export default function UsersManager({
  users,
  currentUserId,
}: {
  users: AdminUserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggleStatus(u: AdminUserRow) {
    setError(null);
    setBusyId(u.id);
    const supabase = createClient();
    const nextStatus = u.status === "active" ? "suspended" : "active";
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ status: nextStatus })
      .eq("id", u.id);
    setBusyId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  if (users.length === 0) {
    return <EmptyState title="No users yet" description="Registered customers will appear here." />;
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-brick-100 px-3.5 py-2.5 text-sm text-brick-700">
          {error}
        </div>
      )}

      <Table>
        <THead>
          <TRow>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Role</TH>
            <TH>Wallet balance</TH>
            <TH>Joined</TH>
            <TH>Status</TH>
            <TH>Action</TH>
          </TRow>
        </THead>
        <tbody>
          {users.map((u) => (
            <TRow key={u.id}>
              <TD className="font-medium">{u.full_name || "—"}</TD>
              <TD>{u.email}</TD>
              <TD className="capitalize">{u.role}</TD>
              <TD>{formatNaira(u.walletBalance)}</TD>
              <TD>{u.created_at.slice(0, 10)}</TD>
              <TD>
                <Badge status={u.status} />
              </TD>
              <TD>
                {u.id === currentUserId ? (
                  <span className="text-xs text-ink-soft">This is you</span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === u.id}
                    onClick={() => handleToggleStatus(u)}
                  >
                    {busyId === u.id ? "…" : u.status === "active" ? "Suspend" : "Activate"}
                  </Button>
                )}
              </TD>
            </TRow>
          ))}
        </tbody>
      </Table>
    </>
  );
}
