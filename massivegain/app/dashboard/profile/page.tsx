import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single<Pick<Profile, "full_name" | "email">>()
    : { data: null };

  return (
    <>
      <PageHeader title="Profile" description="Manage your account details." />

      <Card className="max-w-lg">
        <div className="flex flex-col gap-4">
          <FormField label="Full name" defaultValue={profile?.full_name ?? ""} disabled />
          <FormField label="Email address" defaultValue={profile?.email ?? user?.email ?? ""} disabled />
          <FormField label="Phone number" placeholder="Not collected yet" disabled />
          <Button disabled className="mt-1 self-start">
            Save changes
          </Button>
          <p className="text-xs text-ink-soft">
            Editing isn&apos;t connected yet. Name and email above are your real account details;
            phone number isn&apos;t collected yet.
          </p>
        </div>
      </Card>
    </>
  );
}
