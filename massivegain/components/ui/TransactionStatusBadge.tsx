import Badge from "@/components/ui/Badge";
import type { TransactionStatus } from "@/lib/supabase/types";

export default function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  if (status === "success") return <Badge status="completed" label="Successful" />;
  if (status === "failed") return <Badge status="suspended" label="Failed" />;
  return <Badge status="pending" label="Pending" />;
}
