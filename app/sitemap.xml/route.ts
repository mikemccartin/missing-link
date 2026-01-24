const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://missing.link";

export async function GET() {
  const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE_URL}/sitemaps/claims.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemaps/entities.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemaps/sources.xml</loc>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemaps/topics.xml</loc>
  </sitemap>
</sitemapindex>`;

  return new Response(sitemapIndex, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
