const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://missing.link";

export async function GET() {
  const robotsTxt = `# missing.link robots.txt
# This site is designed for machine consumption

User-agent: *
Allow: /

# Sitemaps
Sitemap: ${BASE_URL}/sitemap.xml

# Machine-readable endpoints
# /llms.txt - Site description for LLMs
# /rss.xml - Claim feed
# All pages include JSON-LD structured data
`;

  return new Response(robotsTxt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
