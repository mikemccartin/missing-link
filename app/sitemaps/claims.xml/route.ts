import { getAllClaims } from "@/lib/content";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://missing.link";

export async function GET() {
  const claims = getAllClaims();

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/claims</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
${claims
  .map(
    (claim) => `  <url>
    <loc>${BASE_URL}/claims/${claim.id}</loc>
    <lastmod>${claim.provenance.updatedAt}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
