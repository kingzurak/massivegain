/**
 * DEMO / PLACEHOLDER DATA ONLY.
 * Nothing in this file is real. It exists purely so the UI has realistic
 * content to render during Milestone 1 (design + layout).
 * This will be fully replaced by live Supabase queries in a later milestone.
 */

export type MockService = {
  id: string;
  name: string;
  category: string;
  description: string;
  pricePerThousand: number;
  min: number;
  max: number;
  active: boolean;
};

export const mockServices: MockService[] = [
  {
    id: "svc-1",
    name: "Instagram Page Growth",
    category: "Instagram",
    description: "Steady, organic-style growth for an Instagram business page.",
    pricePerThousand: 4500,
    min: 100,
    max: 10000,
    active: true,
  },
  {
    id: "svc-2",
    name: "Facebook Page Engagement",
    category: "Facebook",
    description: "Engagement support for Facebook business pages.",
    pricePerThousand: 3200,
    min: 50,
    max: 5000,
    active: true,
  },
  {
    id: "svc-3",
    name: "TikTok Video Reach",
    category: "TikTok",
    description: "Reach support for TikTok video content.",
    pricePerThousand: 5000,
    min: 200,
    max: 20000,
    active: true,
  },
  {
    id: "svc-4",
    name: "YouTube Channel Promotion",
    category: "YouTube",
    description: "Promotion support for YouTube channels and uploads.",
    pricePerThousand: 8000,
    min: 100,
    max: 5000,
    active: false,
  },
  {
    id: "svc-5",
    name: "WhatsApp Business Marketing Setup",
    category: "WhatsApp",
    description: "Guided setup and marketing assets for WhatsApp Business.",
    pricePerThousand: 12000,
    min: 1,
    max: 10,
    active: true,
  },
  {
    id: "svc-6",
    name: "Twitter/X Profile Growth",
    category: "Twitter/X",
    description: "Growth support for Twitter/X profiles.",
    pricePerThousand: 4000,
    min: 100,
    max: 8000,
    active: true,
  },
];

export type MockOrder = {
  id: string;
  service: string;
  quantity: number;
  amount: number;
  status: "pending" | "processing" | "completed" | "cancelled";
  date: string;
};

export const mockOrders: MockOrder[] = [
  { id: "MG-10231", service: "Instagram Page Growth", quantity: 1000, amount: 4500, status: "completed", date: "2026-09-18" },
  { id: "MG-10245", service: "TikTok Video Reach", quantity: 2000, amount: 10000, status: "processing", date: "2026-09-21" },
  { id: "MG-10252", service: "Facebook Page Engagement", quantity: 500, amount: 1600, status: "pending", date: "2026-09-23" },
  { id: "MG-10260", service: "Twitter/X Profile Growth", quantity: 800, amount: 3200, status: "cancelled", date: "2026-09-24" },
];

export type MockTransaction = {
  id: string;
  type: "funding" | "order" | "refund";
  description: string;
  amount: number;
  date: string;
};

export const mockTransactions: MockTransaction[] = [
  { id: "TXN-5001", type: "funding", description: "Wallet funding via Paystack", amount: 20000, date: "2026-09-17" },
  { id: "TXN-5002", type: "order", description: "Order MG-10231", amount: -4500, date: "2026-09-18" },
  { id: "TXN-5003", type: "order", description: "Order MG-10245", amount: -10000, date: "2026-09-21" },
  { id: "TXN-5004", type: "refund", description: "Refund for MG-10260", amount: 3200, date: "2026-09-24" },
];

export const mockUsers = [
  { id: "usr-1", name: "Adaeze Okoye", email: "adaeze@example.com", wallet: 15400, joined: "2026-06-02", status: "active" },
  { id: "usr-2", name: "Tunde Bakare", email: "tunde@example.com", wallet: 0, joined: "2026-07-14", status: "active" },
  { id: "usr-3", name: "Chinedu Eze", email: "chinedu@example.com", wallet: 3200, joined: "2026-08-01", status: "suspended" },
];

export const mockProviders = [
  { id: "prov-1", name: "Provider Slot A", status: "not connected", services: 0 },
  { id: "prov-2", name: "Provider Slot B", status: "not connected", services: 0 },
];

export const mockStatistics = {
  totalUsers: 0,
  totalOrders: 0,
  totalRevenue: 0,
  activeServices: mockServices.filter((s) => s.active).length,
};
