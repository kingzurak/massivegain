/**
 * Runs on every request to /dashboard/* and /admin/*.
 *  1. Refreshes the Supabase session cookie (required for SSR auth).
 *  2. Redirects unauthenticated users to /login.
 *  3. Redirects suspended (non-active) accounts to /auth/suspended, which
 *     signs them out. This runs before any page/layout, so a route that
 *     forgets to inherit a guarded layout is still covered.
 * Role-based admin gating happens separately in app/admin/layout.tsx,
 * since it needs a database read that's simplest done there.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: this call refreshes the session and must not be removed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/dashboard") || path.startsWith("/admin");

  if (isProtected && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Suspended accounts stay signed in at the auth layer until this check
  // (or a deliberate sign-out) runs. Signing out is what /auth/suspended
  // does, so redirect there rather than just showing an error page.
  if (isProtected && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .single<{ status: string }>();

    if (!profile || profile.status !== "active") {
      return NextResponse.redirect(new URL("/auth/suspended", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
