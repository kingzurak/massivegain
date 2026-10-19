import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ServicesBrowser from "@/components/services/ServicesBrowser";
import { getServicesPageData } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function DashboardServicesPage() {
  const { services, isLoggedIn, walletBalance } = await getServicesPageData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Marketing services available to order, organised by platform."
      />

      {services.length === 0 ? (
        <EmptyState
          title="No services yet"
          description="Services will appear here once they're added from the admin panel."
        />
      ) : (
        <ServicesBrowser
          services={services}
          isLoggedIn={isLoggedIn}
          walletBalance={walletBalance}
        />
      )}
    </div>
  );
}
