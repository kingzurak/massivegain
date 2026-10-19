/**
 * Minimal hand-written types for the `profiles` table.
 * Not generated from the live schema yet — if you later run
 * `supabase gen types typescript`, you can replace this file with the
 * generated Database type and update the client helpers to use it.
 */

export type ProfileRole = "customer" | "admin";
export type ProfileStatus = "active" | "suspended";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: ProfileRole;
  status: ProfileStatus;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Service {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price_per_thousand: number;
  min_quantity: number;
  max_quantity: number;
  active: boolean;
  provider: string;
  created_at: string;
  updated_at: string;
}

/** Service row joined with its category name — what the UI actually renders. */
export interface ServiceWithCategory extends Service {
  category: { name: string } | null;
}

export interface Wallet {
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export type TransactionType = "funding" | "order" | "refund" | "commission";
export type TransactionStatus = "pending" | "success" | "failed";

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  balance_after: number | null;
  reference: string;
  provider: string | null;
  description: string;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = "pending" | "processing" | "completed" | "cancelled";

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  service_id: string;
  quantity: number;
  amount: number;
  status: OrderStatus;
  provider: string;
  external_order_id: string | null;
  start_count: number | null;
  link: string | null;
  admin_notes: string;
  created_at: string;
  updated_at: string;
}

/** Order row joined with its service name — what the UI actually renders. */
export interface OrderWithService extends Order {
  service: { name: string } | null;
}

/** Shape returned by the place_order() database function. */
export interface PlaceOrderResult {
  outcome:
    | "success"
    | "already_processed"
    | "insufficient_balance"
    | "invalid_quantity"
    | "service_unavailable"
    | "invalid_reference"
    | "invalid_link"
    | "not_authenticated";
  order_id: string | null;
  order_number: string | null;
  amount: number | null;
  balance: number | null;
}

/** Shape returned by the cancel_order_with_refund() database function. */
export interface CancelOrderResult {
  outcome: "cancelled" | "already_cancelled" | "invalid_status" | "not_found" | "not_authorized";
  order_id: string | null;
  refund_amount: number | null;
  balance: number | null;
}

export interface SystemSetting {
  key: string;
  value: string;
  updated_at: string;
}

export type ReferralCommissionStatus = "paid" | "reversed" | "skipped_suspended";

export interface ReferralCommission {
  id: string;
  order_id: string;
  referrer_id: string;
  referred_user_id: string;
  rate: number;
  amount: number;
  status: ReferralCommissionStatus;
  created_at: string;
  updated_at: string;
}
