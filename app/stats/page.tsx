import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stats",
  description: "AI crawler activity and site statistics",
};

// Known AI crawler user agents we track
const AI_CRAWLERS = [
  { name: "GPTBot", org: "OpenAI", description: "ChatGPT and OpenAI services" },
  { name: "ChatGPT-User", org: "OpenAI", description: "ChatGPT browsing feature" },
  { name: "Claude-Web", org: "Anthropic", description: "Claude AI assistant" },
  { name: "Anthropic-AI", org: "Anthropic", description: "Anthropic services" },
  { name: "PerplexityBot", org: "Perplexity", description: "Perplexity AI search" },
  { name: "Cohere-AI", org: "Cohere", description: "Cohere language models" },
  { name: "Google-Extended", org: "Google", description: "Gemini and Bard training" },
  { name: "Bytespider", org: "ByteDance", description: "TikTok AI services" },
  { name: "CCBot", org: "Common Crawl", description: "Open dataset used by many LLMs" },
];

export default function StatsPage() {
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

      <h2>Recent activity</h2>
      <p className="meta">
        Crawler activity tracking coming soon. This will show real-time
        visits from AI systems once analytics integration is complete.
      </p>

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

      <h2>For site owners</h2>
      <p>
        Entity pages on missing.link can show the same crawler activity
        data, demonstrating to clients that their information is being
        discovered by AI platforms.
      </p>
    </main>
  );
}
