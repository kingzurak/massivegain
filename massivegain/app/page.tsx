import Link from "next/link"; import Navbar from "@/components/layout/Navbar"; import Footer from "@/components/layout/Footer";
export default function HomePage() { const categories = [ "Instagram", "Facebook", "TikTok", "YouTube", "WhatsApp", "Twitter/X", ];
return ( <div className="min-h-screen bg-surface flex flex-col"> <Navbar />
  <main className="flex-1">
    {/* Hero Section */}
    <section className="px-6 py-16 md:py-24 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
      <div className="max-w-xl">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-ink mb-6">
          Digital marketing and social-media promotion, run from one dashboard.
        </h1>
        <p className="text-lg text-ink-soft mb-8">
          MassiveGain.ng gives Nigerian businesses and creators a simple way to order marketing services, fund a wallet in naira, and track every order in real time.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/register"
            className="bg-primary text-white font-medium px-6 py-3 rounded-lg hover:opacity-95 transition-opacity"
          >
            Create free account
          </Link>
          <Link
            href="/register"
            className="border border-surface-border text-ink font-medium px-6 py-3 rounded-lg hover:bg-surface-hover transition-colors"
          >
            View services
          </Link>
        </div>
        <p className="text-xs text-ink-soft mt-4">
          Payments secured by Paystack. No card details stored on MassiveGain.ng.
        </p>
      </div>
    </section>

    {/* Services by Platform Section */}
    <section className="px-6 py-12 max-w-7xl mx-auto border-t border-surface-border">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-2xl font-bold text-ink">Services by platform</h2>
          <p className="text-sm text-ink-soft mt-1">
            A growing catalogue of marketing services, organised by the platform they support.
          </p>
        </div>
        <Link href="/register" className="text-sm font-medium text-primary hover:underline">
          See all services
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category}
            href="/register"
            className="rounded-lg border border-surface-border bg-surface p-5 hover:border-primary transition-colors block shadow-sm"
          >
            <p className="text-base font-medium text-ink">{category}</p>
          </Link>
        ))}
      </div>
    </section>
  </main>

  <Footer />
</div>
); }