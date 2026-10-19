import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ServicesBrowser from "@/components/services/ServicesBrowser";
import { getServicesPageData } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const { services, isLoggedIn, walletBalance } = await getServicesPageData();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      <main className="container-page flex-1 py-12 md:py-16">
        <PageHeader
          title="Services"
          description="Marketing services available to order, organised by platform. Log in to place an order."
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
      </main>

      <Footer />
    </div>
  );
}
