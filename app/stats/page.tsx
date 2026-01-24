import { Metadata } from "next";
import { AI_CRAWLERS, getRecentVisits, getCrawlerCounts, CrawlerVisit } from "@/lib/redis";
import { getLatestMentions, MentionResult } from "@/lib/ai-mentions";

export const metadata: Metadata = {
  title: "Stats",
  description: "AI crawler activity and citation monitoring",
};

// Revalidate every 60 seconds
export const revalidate = 60;

export default async function StatsPage() {
  const [recentVisits, crawlerCounts, mentionData] = await Promise.all([
    getRecentVisits(50),
    getCrawlerCounts(),
    Promise.resolve(getLatestMentions()),
  ]);

  const totalVisits = Object.values(crawlerCounts).reduce((a, b) => a + b, 0);
  const hasCrawlerData = totalVisits > 0;

  return (
    <main>
      <h1>Stats</h1>
      <p>
        AI crawler activity and citation monitoring for missing.link.
      </p>

      <h2>Why this matters</h2>
      <p>
        For AI systems to cite your content, they need to: (1) crawl it, and
        (2) include it in their responses. This page tracks both.
      </p>

      {/* AI Citation Monitoring Section */}
      <h2>AI citation monitoring</h2>
      {mentionData ? (
        <>
          <p className="meta">
            Last checked: {formatTime(mentionData.lastRun)}
          </p>

          {/* Platform breakdown */}
          {mentionData.platformBreakdown && (
            <>
              <h3>By platform</h3>
              <table>
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Checks</th>
                    <th>Citations</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(mentionData.platformBreakdown).map(([platform, stats]) => (
                    <tr key={platform}>
                      <td>{formatPlatformName(platform)}</td>
                      <td>{(stats as any).checked}</td>
                      <td>
                        {(stats as any).cited > 0 ? (
                          <strong>{(stats as any).cited}</strong>
                        ) : (
                          <span className="meta">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <h3>Detailed results</h3>
          <table>
            <thead>
              <tr>
                <th>Entity</th>
                <th>Platform</th>
                <th>Cited?</th>
                <th>Sources</th>
              </tr>
            </thead>
            <tbody>
              {mentionData.results.map((result: MentionResult, i: number) => (
                <tr key={i}>
                  <td>
                    <a href={`/entities/${result.entity}`}>{result.entityName}</a>
                  </td>
                  <td>{formatPlatformName(result.platform)}</td>
                  <td>
                    {result.cited ? (
                      <strong style={{ color: "#000" }}>Yes</strong>
                    ) : (
                      <span className="meta">No</span>
                    )}
                  </td>
                  <td>{result.sources.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {mentionData.citations > 0 ? (
            <p>
              <strong>{mentionData.citations}</strong> of {mentionData.totalChecks} checks
              resulted in missing.link citations.
            </p>
          ) : (
            <p className="meta">
              No citations yet. This is expected for new sites—keep building content!
            </p>
          )}
        </>
      ) : (
        <p className="meta">
          No AI citation data yet. Run <code>npm run monitor-ai -- --all</code> to check.
        </p>
      )}

      {/* Crawler Activity Section */}
      <h2>Crawler activity summary</h2>
      {hasCrawlerData ? (
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

      <h2>Recent crawler visits</h2>
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

      <h2>How it works</h2>
      <p>
        <strong>Crawler tracking:</strong> We identify AI crawlers by their user agent
        strings and log every visit with timestamp and page path.
      </p>
      <p>
        <strong>Citation monitoring:</strong> We query AI platforms (Perplexity, ChatGPT, Google AI Mode)
        about our entities and check if missing.link appears in their cited sources.
      </p>
    </main>
  );
}

function formatPlatformName(platform: string): string {
  const names: Record<string, string> = {
    perplexity: "Perplexity",
    chatgpt: "ChatGPT",
    google: "Google AI Mode",
    google_ai_mode: "Google AI Mode",
  };
  return names[platform] || platform;
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
