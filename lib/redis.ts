import { Redis } from "@upstash/redis";

// Initialize Redis client - will use UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// Known AI crawler patterns
export const AI_CRAWLERS = [
  { pattern: "GPTBot", name: "GPTBot", org: "OpenAI", description: "ChatGPT and OpenAI services" },
  { pattern: "ChatGPT-User", name: "ChatGPT-User", org: "OpenAI", description: "ChatGPT browsing feature" },
  { pattern: "Claude-Web", name: "Claude-Web", org: "Anthropic", description: "Claude AI assistant" },
  { pattern: "Anthropic", name: "Anthropic-AI", org: "Anthropic", description: "Anthropic services" },
  { pattern: "PerplexityBot", name: "PerplexityBot", org: "Perplexity", description: "Perplexity AI search" },
  { pattern: "Cohere", name: "Cohere-AI", org: "Cohere", description: "Cohere language models" },
  { pattern: "Google-Extended", name: "Google-Extended", org: "Google", description: "Gemini and Bard training" },
  { pattern: "Bytespider", name: "Bytespider", org: "ByteDance", description: "TikTok AI services" },
  { pattern: "CCBot", name: "CCBot", org: "Common Crawl", description: "Open dataset used by many LLMs" },
];

export interface CrawlerVisit {
  crawler: string;
  org: string;
  path: string;
  timestamp: string;
}

// Check if user agent matches any AI crawler
export function detectAICrawler(userAgent: string): { name: string; org: string } | null {
  for (const crawler of AI_CRAWLERS) {
    if (userAgent.includes(crawler.pattern)) {
      return { name: crawler.name, org: crawler.org };
    }
  }
  return null;
}

// Log a crawler visit
export async function logCrawlerVisit(crawler: string, org: string, path: string): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return;

  const visit: CrawlerVisit = {
    crawler,
    org,
    path,
    timestamp: new Date().toISOString(),
  };

  // Store in a list, keep last 1000 visits
  await redis.lpush("crawler_visits", JSON.stringify(visit));
  await redis.ltrim("crawler_visits", 0, 999);

  // Increment counter for this crawler
  await redis.hincrby("crawler_counts", crawler, 1);

  // Increment daily counter
  const today = new Date().toISOString().split("T")[0];
  await redis.hincrby(`daily_visits:${today}`, crawler, 1);
}

// Get recent crawler visits
export async function getRecentVisits(limit: number = 50): Promise<CrawlerVisit[]> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return [];

  const visits = await redis.lrange("crawler_visits", 0, limit - 1);
  return visits.map((v) => (typeof v === "string" ? JSON.parse(v) : v) as CrawlerVisit);
}

// Get crawler counts
export async function getCrawlerCounts(): Promise<Record<string, number>> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return {};

  const counts = await redis.hgetall("crawler_counts");
  if (!counts) return {};

  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(counts)) {
    result[key] = typeof value === "number" ? value : parseInt(value as string, 10);
  }
  return result;
}

// Daily aggregate for AI mention monitoring
export interface DailyAggregate {
  date: string;
  totalChecks: number;
  citations: number;
  platforms: Record<string, { checked: number; cited: number }>;
  citedEntities: string[];
}

// Store daily aggregate after a monitoring run
export async function storeDailyAggregate(runResult: {
  timestamp: string;
  totalChecks: number;
  citations: number;
  platformBreakdown: Record<string, { checked: number; cited: number }>;
  results: Array<{ entity: string; cited: boolean }>;
}): Promise<void> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return;

  const date = runResult.timestamp.split("T")[0]; // YYYY-MM-DD

  const aggregate: DailyAggregate = {
    date,
    totalChecks: runResult.totalChecks,
    citations: runResult.citations,
    platforms: runResult.platformBreakdown,
    citedEntities: runResult.results
      .filter((r) => r.cited)
      .map((r) => r.entity),
  };

  // Store the daily aggregate
  await redis.set(`mentions:daily:${date}`, JSON.stringify(aggregate));

  // Add to sorted set for easy date range queries (score is timestamp)
  const timestamp = new Date(runResult.timestamp).getTime();
  await redis.zadd("mentions:daily:index", { score: timestamp, member: date });

  // Keep only last 90 days in the index
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  await redis.zremrangebyscore("mentions:daily:index", 0, cutoff);
}

// Get historical aggregates for the last N days
export async function getDailyHistory(days: number = 30): Promise<DailyAggregate[]> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return [];

  // Get dates from the sorted set (most recent first)
  const dates = await redis.zrange("mentions:daily:index", 0, days - 1, {
    rev: true,
  });

  if (!dates || dates.length === 0) return [];

  // Fetch all aggregates in parallel
  const aggregates: DailyAggregate[] = [];
  for (const date of dates) {
    const data = await redis.get(`mentions:daily:${date}`);
    if (data) {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      aggregates.push(parsed as DailyAggregate);
    }
  }

  return aggregates;
}

// Get the first citation milestone (if any)
export async function getFirstCitation(): Promise<DailyAggregate | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;

  // Get all dates (oldest first)
  const dates = await redis.zrange("mentions:daily:index", 0, -1);

  if (!dates || dates.length === 0) return null;

  // Find the first day with a citation
  for (const date of dates) {
    const data = await redis.get(`mentions:daily:${date}`);
    if (data) {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      const aggregate = parsed as DailyAggregate;
      if (aggregate.citations > 0) {
        return aggregate;
      }
    }
  }

  return null;
}
