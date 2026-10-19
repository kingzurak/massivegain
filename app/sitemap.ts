import type { MetadataRoute } from "next";

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: `${baseUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/services`, lastModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/register`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/login`, lastModified, changeFrequency: "monthly", priority: 0.3 },
  ];
}
