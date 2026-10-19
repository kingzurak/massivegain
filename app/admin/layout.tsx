import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import TopBar from "@/components/layout/TopBar";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

const items = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/services", label: "Services" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/providers", label: "Providers" },
  { href: "/admin/transactions", label: "Transactions" },
  { href: "/admin/statistics", label: "Statistics" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth — middleware already redirects unauthenticated
  // requests before they reach this layout.
  if (!user) {
    redirect("/login?redirectTo=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, status")
    .eq("id", user.id)
    .single<Pick<Profile, "full_name" | "email" | "role" | "status">>();

  if (profile?.status !== "active") {
    redirect("/auth/suspended");
  }

  // Server-side authorization: a logged-in customer must not reach /admin,
  // regardless of what links the UI shows them.
  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-surface-muted/40">
      <TopBar context="Admin" userName={profile?.full_name} userEmail={profile?.email ?? user.email ?? ""} />
      <MobileNav items={items} />
      <div className="flex">
        <Sidebar items={items} homeHref="/" homeLabel="Admin Panel" />
        <main className="min-h-[calc(100vh-4rem)] min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto max-w-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
