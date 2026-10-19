import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";

export default function SuspendedPage() {
  return (
    <>
      <Navbar />
      <main className="container-page flex flex-col items-center justify-center py-24 text-center">
        <h1 className="font-display text-2xl text-navy-900">Account suspended</h1>
        <p className="mt-3 max-w-sm text-sm text-ink-muted">
          Your MassiveGain.ng account has been suspended. If you believe this is a mistake,
          contact support at support@massivegain.ng.
        </p>
        <Link href="/" className="mt-6">
          <Button>Back to home</Button>
        </Link>
      </main>
      <Footer />
    </>
  );
}
