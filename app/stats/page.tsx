import { Metadata } from "next";
import { AI_CRAWLERS, getRecentVisits, getCrawlerCounts, CrawlerVisit } from "@/lib/redis";

export const metadata: Metadata = {
  title: "Stats",
  description: "AI crawler activity and site statistics",
};

// Revalidate every 60 seconds
export const revalidate = 60;

export default async function StatsPage() {
  const [recentVisits, crawlerCounts] = await Promise.all([
    getRecentVisits(50),
    getCrawlerCounts(),
  ]);

  const totalVisits = Object.values(crawlerCounts).reduce((a, b) => a + b, 0);
  const hasData = totalVisits > 0;

  return (
    <main>
      <h1>Stats</h1>
      <p>
        AI crawler activity and site statistics for missing.link.
      </p>

      <h2>Why this matters</h2>
      <p>
        For AI systems to cite your content, they first need to crawl it.
        This page tracks which AI crawlers have visited missing.link,
        demonstrating discoverability by large language models.
      </p>

      <h2>Crawler activity summary</h2>
      {hasData ? (
        <>
          <p>
            <strong>{totalVisits}</strong> total visits from AI crawlers.
          </p>
          <table>
            <thead>
              <tr>
                <th>Crawler</th>
                <th>Organization</th>
                <th>Visits</th>
              </tr>
            </thead>
            <tbody>
              {AI_CRAWLERS.filter((c) => crawlerCounts[c.name]).map((crawler) => (
                <tr key={crawler.name}>
                  <td><code>{crawler.name}</code></td>
                  <td>{crawler.org}</td>
                  <td>{crawlerCounts[crawler.name] || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="meta">
          No AI crawler visits recorded yet. Visits will appear here as AI
          systems discover and crawl missing.link.
        </p>
      )}

      <h2>Recent visits</h2>
      {recentVisits.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Crawler</th>
              <th>Page</th>
            </tr>
          </thead>
          <tbody>
            {recentVisits.slice(0, 20).map((visit: CrawlerVisit, i: number) => (
              <tr key={i}>
                <td className="meta">{formatTime(visit.timestamp)}</td>
                <td><code>{visit.crawler}</code></td>
                <td><a href={visit.path}>{visit.path}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="meta">No recent visits recorded.</p>
      )}

      <h2>AI crawlers we monitor</h2>
      <table>
        <thead>
          <tr>
            <th>Crawler</th>
            <th>Organization</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          {AI_CRAWLERS.map((crawler) => (
            <tr key={crawler.name}>
              <td><code>{crawler.name}</code></td>
              <td>{crawler.org}</td>
              <td>{crawler.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>How we track</h2>
      <p>
        We identify AI crawlers by their user agent strings. When a known
        AI bot visits any page on missing.link, we log the visit with:
      </p>
      <ul>
        <li>Crawler name and organization</li>
        <li>Page visited</li>
        <li>Timestamp</li>
      </ul>
      <p>
        This data demonstrates that AI systems are actively indexing our
        verified claims, making them available for citation in AI-generated
        responses.
      </p>
    </main>
  );
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toISOString().split("T")[0];
}
