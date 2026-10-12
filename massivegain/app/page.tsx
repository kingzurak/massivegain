import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { mockServices } from "@/lib/mock-data";

const steps = [
  {
    n: "1",
    title: "Create an account and fund your wallet",
    body: "Sign up in minutes and fund your MassiveGain wallet with a bank transfer or card, powered by Paystack.",
  },
  {
    n: "2",
    title: "Choose a marketing service",
    body: "Browse services by platform, set your quantity, and place an order directly from your dashboard.",
  },
  {
    n: "3",
    title: "Track progress from your dashboard",
    body: "Follow order status in real time, and reorder or top up your wallet whenever you need to.",
  },
];

const categories = Array.from(new Set(mockServices.map((s) => s.category)));

const reasons = [
  {
    title: "Built for the Nigerian market",
    body: "Naira wallet, local payment rails via Paystack, and support built around how Nigerian businesses actually operate.",
  },
  {
    title: "One dashboard, every order",
    body: "Place orders, fund your wallet, and track status from a single, simple dashboard — no spreadsheets, no back and forth.",
  },
  {
    title: "Built to grow with new services",
    body: "The platform is architected so new marketing services can be added over time without disrupting your existing orders.",
  },
];

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="container-page grid gap-10 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <h1 className="font-display text-[34px] leading-[1.15] text-navy-900 sm:text-[42px] md:text-[46px]">
              Digital marketing and social-media promotion,{" "}
              <span className="text-brick-600">run from one dashboard.</span>
            </h1>
            <p className="mt-5 max-w-md text-base text-ink-muted">
              MassiveGain.ng gives Nigerian businesses and creators a simple way to order
              marketing services, fund a wallet in naira, and track every order in real time.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto">Create free account</Button>
              </Link>
              <Link href="/services">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  View services
                </Button>
              </Link>
            </div>
            <p className="mt-5 text-xs text-ink-soft">
              Payments secured by Paystack. No card details stored on MassiveGain.ng.
            </p>
          </div>

          <div className="rounded-xl border border-surface-border bg-surface p-5 shadow-raised">
            <p className="text-xs font-medium text-ink-soft">Order preview</p>
            <div className="mt-3 flex items-center justify-between rounded-md bg-surface-muted p-3">
              <div>
                <p className="text-sm font-medium text-ink">Instagram Page Growth</p>
                <p className="text-xs text-ink-soft">Order MG-10245 · 2,000 units</p>
              </div>
              <Badge status="processing" />
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full w-2/3 rounded-full bg-brick-600" />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-surface-border pt-4">
              <span className="text-xs text-ink-soft">Wallet balance</span>
              <span className="font-display text-lg text-navy-900">₦15,400</span>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-surface-border bg-surface-muted/50 py-16 md:py-20">
          <div className="container-page">
            <h2 className="font-display text-2xl text-navy-900 md:text-[28px]">How it works</h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.n}>
                  <span className="font-display text-3xl text-brick-600">{step.n}</span>
                  <h3 className="mt-3 text-base font-medium text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm text-ink-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Services overview */}
        <section className="py-16 md:py-20">
          <div className="container-page">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-2xl text-navy-900 md:text-[28px]">
                  Services by platform
                </h2>
                <p className="mt-2 max-w-lg text-sm text-ink-muted">
                  A growing catalogue of marketing services, organised by the platform they support.
                </p>
              </div>
              <Link href="/services" className="text-sm font-medium text-brick-600 hover:text-brick-700">
                See all services
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => {
                const count = mockServices.filter((s) => s.category === category).length;
                return (
                  <Link
                    key={category}
                    href="/services"
                    className="rounded-lg border border-surface-border bg-surface p-5 transition-colors hover:border-navy-600"
                  >
                    <p className="text-base font-medium text-ink">{category}</p>
                    <p className="mt-1 text-sm text-ink-soft">
                      {count} {count === 1 ? "service" : "services"}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Why MassiveGain */}
        <section className="border-t border-surface-border bg-navy-950 py-16 text-white md:py-20">
          <div className="container-page">
            <h2 className="font-display text-2xl md:text-[28px]">Why businesses choose MassiveGain</h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {reasons.map((reason) => (
                <div key={reason.title}>
                  <h3 className="text-base font-medium text-white">{reason.title}</h3>
                  <p className="mt-2 text-sm text-white/65">{reason.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-20">
          <div className="container-page flex flex-col items-start gap-5 rounded-xl bg-surface-muted p-8 md:flex-row md:items-center md:justify-between md:p-12">
            <div>
              <h2 className="font-display text-xl text-navy-900 md:text-2xl">
                Ready to get started?
              </h2>
              <p className="mt-2 max-w-md text-sm text-ink-muted">
                Create your MassiveGain.ng account and place your first order in a few minutes.
              </p>
            </div>
            <Link href="/register">
              <Button size="lg">Create free account</Button>
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
