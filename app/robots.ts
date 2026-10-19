import type { MetadataRoute } from "next";

// Absolute URLs are required by the robots convention. NEXT_PUBLIC_SITE_URL is
// the same variable the app uses for referral links and Paystack callbacks
// (see DEPLOYMENT.md); it must be set in production for this to point anywhere
// useful. The localhost fallback keeps local development honest rather than
// guessing at a production domain.
const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private/authenticated areas and API endpoints have nothing to index.
        disallow: ["/dashboard", "/admin", "/api", "/auth"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
