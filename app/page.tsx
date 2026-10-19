import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function HomePage() {
  const categories = [
    "Instagram",
    "Facebook",
    "TikTok",
    "YouTube",
    "WhatsApp",
    "Twitter/X",
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="px-6 py-16 md:py-24 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="max-w-xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-6">
              Digital marketing and social-media promotion, run from one dashboard.
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              MassiveGain.ng gives Nigerian businesses and creators a simple way to order marketing services, fund a wallet in naira, and track every order in real time.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/register"
                className="bg-red-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-red-700 transition-colors shadow-sm inline-block"
              >
                Create free account
              </Link>
              <Link
                href="/register"
                className="border border-gray-300 text-gray-800 font-medium px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors inline-block"
              >
                View services
              </Link>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              Payments secured by Paystack. No card details stored on MassiveGain.ng.
            </p>
          </div>
        </section>

        {/* Services by Platform Section */}
        <section className="px-6 py-12 max-w-7xl mx-auto border-t border-gray-200">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Services by platform</h2>
              <p className="text-sm text-gray-600 mt-1">
                A growing catalogue of marketing services, organised by the platform they support.
              </p>
            </div>
            <Link href="/register" className="text-sm font-medium text-red-600 hover:underline">
              See all services
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category}
                href="/register"
                className="rounded-lg border border-gray-200 bg-white p-5 hover:border-red-600 transition-colors block shadow-sm"
              >
                <p className="text-base font-medium text-gray-900">{category}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}