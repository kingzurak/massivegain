import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import TopBar from "@/components/layout/TopBar";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

const items = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/services", label: "Services" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/wallet", label: "Wallet" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/referrals", label: "Referrals" },
  { href: "/dashboard/profile", label: "Profile" },
  
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth — middleware already redirects unauthenticated
  // requests before they reach this layout.
  if (!user) {
    redirect("/login?redirectTo=/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, status")
    .eq("id", user.id)
    .single<Pick<Profile, "full_name" | "email" | "status">>();

  if (profile?.status === "suspended") {
    redirect("/auth/suspended");
  }

  return (
    <div className="min-h-screen bg-surface-muted/40">
      <TopBar context="Dashboard" userName={profile?.full_name} userEmail={profile?.email ?? user.email ?? ""} />
      <MobileNav items={items} />
      <div className="flex">
        <Sidebar items={items} homeHref="/" homeLabel="Customer Dashboard" />
        <main className="min-h-[calc(100vh-4rem)] min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
