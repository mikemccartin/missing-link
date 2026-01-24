import { getAllClaims } from "@/lib/content";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://missing.link";

export async function GET() {
  const claims = getAllClaims();

  // Sort by updated date, most recent first
  const sortedClaims = [...claims].sort((a, b) =>
    b.provenance.updatedAt.localeCompare(a.provenance.updatedAt)
  );

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>missing.link Claims</title>
    <link>${BASE_URL}</link>
    <description>Verified claims with transparent provenance from missing.link</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${sortedClaims
  .map(
    (claim) => `    <item>
      <title>${escapeXml(claim.title)}</title>
      <link>${BASE_URL}/claims/${claim.id}</link>
      <guid isPermaLink="true">${BASE_URL}/claims/${claim.id}</guid>
      <description>${escapeXml(claim.statement)}</description>
      <pubDate>${new Date(claim.provenance.updatedAt).toUTCString()}</pubDate>
      <category>${claim.status}</category>
    </item>`
  )
  .join("\n")}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
