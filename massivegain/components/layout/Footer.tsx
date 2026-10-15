import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-surface-border bg-navy-950 text-white/80">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-display text-lg font-semibold text-white">MassiveGain</span>
            <span className="font-display text-lg font-semibold text-brick-500">.ng</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-white/60">
            A Nigerian platform for digital marketing and social-media promotion services,
            built for businesses and creators.
          </p>
        </div>

        <div>
          <p className="text-sm font-medium text-white">Platform</p>
          <ul className="mt-3 space-y-2 text-sm text-white/60">
            <li><Link href="/register" className="hover:text-white">Services</Link></li>
            <li><Link href="/register" className="hover:text-white">Create an account</Link></li>
            <li><Link href="/login" className="hover:text-white">Log in</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-medium text-white">Company</p>
          <ul className="mt-3 space-y-2 text-sm text-white/60">
            <li><span className="cursor-default">About</span></li>
            <li><span className="cursor-default">Contact</span></li>
            <li><span className="cursor-default">Terms</span></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-medium text-white">Contact</p>
          <ul className="mt-3 space-y-2 text-sm text-white/60">
            <li>support@massivegain.ng</li>
            <li>Lagos, Nigeria</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 MassiveGain.ng. All rights reserved.</p>
          <p>Payments secured via Paystack.</p>
        </div>
      </div>
    </footer>
  );
}
