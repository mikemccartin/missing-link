import { getAllSources } from "@/lib/content";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://missing.link";

export async function GET() {
  const sources = getAllSources();

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/sources</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
${sources
  .map(
    (source) => `  <url>
    <loc>${BASE_URL}/sources/${source.id}</loc>
    <lastmod>${source.accessDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
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
