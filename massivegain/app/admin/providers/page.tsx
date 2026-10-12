import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { mockProviders } from "@/lib/mock-data";

export default function AdminProvidersPage() {
  return (
    <>
      <PageHeader
        title="Providers"
        description="Fulfilment providers connect here once the provider abstraction layer is built. None are connected yet."
        action={<Button disabled>Add provider</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {mockProviders.map((provider) => (
          <Card key={provider.id}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">{provider.name}</p>
              <Badge status="inactive" label={provider.status} />
            </div>
            <p className="mt-2 text-xs text-ink-soft">{provider.services} services mapped</p>
            <Button size="sm" variant="outline" disabled className="mt-4">
              Configure
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
