import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="container-page flex flex-col items-center justify-center py-28 text-center">
        <p className="font-display text-6xl text-navy-900">404</p>
        <h1 className="mt-4 text-xl font-medium text-ink">This page doesn&apos;t exist</h1>
        <p className="mt-2 max-w-sm text-sm text-ink-muted">
          The page you&apos;re looking for isn&apos;t here. Check the link or head back home.
        </p>
        <Link href="/" className="mt-6">
          <Button>Back to home</Button>
        </Link>
      </main>
      <Footer />
    </>
  );
}
