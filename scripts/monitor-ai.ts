#!/usr/bin/env npx ts-node

/**
 * AI Mention Monitoring for missing.link
 *
 * Queries AI platforms (Perplexity) about entities and tracks citations.
 *
 * Usage:
 *   npm run monitor-ai -- --entity tandem-theory
 *   npm run monitor-ai -- --all
 *
 * Environment variables required:
 *   OXYLABS_USERNAME
 *   OXYLABS_PASSWORD
 *   UPSTASH_REDIS_REST_URL (optional, for storing results)
 *   UPSTASH_REDIS_REST_TOKEN (optional)
 */

import fs from "fs";
import path from "path";
import https from "https";

const CONTENT_DIR = path.join(process.cwd(), "content");
const RESULTS_DIR = path.join(process.cwd(), "content", "ai-mentions");

interface PerplexityResult {
  url: string;
  model: string;
  prompt: string;
  answer: string;
  related_queries: string[];
  sources: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;
}

interface OxylabsResponse {
  results: Array<{
    content: string;
    status_code: number;
  }>;
}

interface MentionResult {
  entity: string;
  entityName: string;
  prompt: string;
  timestamp: string;
  platform: string;
  cited: boolean;
  citedUrl?: string;
  sources: Array<{ title: string; url: string }>;
  answerExcerpt: string;
}

async function queryPerplexity(prompt: string): Promise<PerplexityResult | null> {
  const username = process.env.OXYLABS_USERNAME;
  const password = process.env.OXYLABS_PASSWORD;

  if (!username || !password) {
    throw new Error("OXYLABS_USERNAME and OXYLABS_PASSWORD required");
  }

  const payload = JSON.stringify({
    source: "universal",
    url: `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`,
    render: "html",
    parse: true,
    parsing_instructions: {
      answer: {
        _fns: [{ _fn: "css_one", _args: [".prose"] }, { _fn: "element_text" }]
      },
      sources: {
        _fns: [{ _fn: "css", _args: ["a[href^='http']"] }],
        _items: {
          title: { _fns: [{ _fn: "element_text" }] },
          url: { _fns: [{ _fn: "attr", _args: ["href"] }] }
        }
      }
    }
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "realtime.oxylabs.io",
        port: 443,
        path: "/v1/queries",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            console.error(`Oxylabs returned status ${res.statusCode}`);
            resolve(null);
            return;
          }
          try {
            const response: OxylabsResponse = JSON.parse(data);
            if (response.results && response.results[0]) {
              const content = response.results[0].content;
              // Try to parse as JSON if it's parsed content
              try {
                const parsed = JSON.parse(content);
                resolve({
                  url: `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`,
                  model: "perplexity",
                  prompt,
                  answer: parsed.answer || content,
                  related_queries: [],
                  sources: parsed.sources || []
                });
              } catch {
                // Raw HTML response
                resolve({
                  url: `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`,
                  model: "perplexity",
                  prompt,
                  answer: content.slice(0, 2000),
                  related_queries: [],
                  sources: extractLinksFromHtml(content)
                });
              }
            } else {
              resolve(null);
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function extractLinksFromHtml(html: string): Array<{ title: string; url: string }> {
  const links: Array<{ title: string; url: string }> = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    if (url.startsWith("http") && !url.includes("perplexity.ai")) {
      links.push({ url, title: title || url });
    }
  }
  return links;
}

function checkForMissingLinkCitation(sources: Array<{ url: string }>): { cited: boolean; citedUrl?: string } {
  for (const source of sources) {
    if (source.url.includes("missing.link")) {
      return { cited: true, citedUrl: source.url };
    }
  }
  return { cited: false };
}

async function monitorEntity(entitySlug: string): Promise<MentionResult | null> {
  const entityPath = path.join(CONTENT_DIR, "entities", `${entitySlug}.json`);

  if (!fs.existsSync(entityPath)) {
    console.error(`Entity not found: ${entitySlug}`);
    return null;
  }

  const entity = JSON.parse(fs.readFileSync(entityPath, "utf-8"));
  const prompt = `What is ${entity.name}?`;

  console.log(`\nQuerying Perplexity: "${prompt}"`);

  const result = await queryPerplexity(prompt);

  if (!result) {
    console.log("  No result from Perplexity");
    return null;
  }

  const citation = checkForMissingLinkCitation(result.sources);

  const mentionResult: MentionResult = {
    entity: entitySlug,
    entityName: entity.name,
    prompt,
    timestamp: new Date().toISOString(),
    platform: "perplexity",
    cited: citation.cited,
    citedUrl: citation.citedUrl,
    sources: result.sources.slice(0, 10),
    answerExcerpt: result.answer.slice(0, 500),
  };

  console.log(`  Sources found: ${result.sources.length}`);
  console.log(`  missing.link cited: ${citation.cited ? "YES!" : "No"}`);

  if (citation.cited) {
    console.log(`  Citation URL: ${citation.citedUrl}`);
  }

  return mentionResult;
}

async function saveResults(results: MentionResult[]): Promise<void> {
  // Ensure directory exists
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  // Save individual results
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultsPath = path.join(RESULTS_DIR, `${timestamp}.json`);
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved: ${resultsPath}`);

  // Update summary file
  const summaryPath = path.join(RESULTS_DIR, "latest.json");
  const summary = {
    lastRun: new Date().toISOString(),
    totalChecks: results.length,
    citations: results.filter(r => r.cited).length,
    results,
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("AI Mention Monitor for missing.link\n");
    console.log("Usage:");
    console.log("  npm run monitor-ai -- --entity tandem-theory");
    console.log("  npm run monitor-ai -- --all");
    console.log("\nRequired environment variables:");
    console.log("  OXYLABS_USERNAME");
    console.log("  OXYLABS_PASSWORD");
    process.exit(1);
  }

  const results: MentionResult[] = [];

  if (args[0] === "--all") {
    const entitiesDir = path.join(CONTENT_DIR, "entities");
    const entityFiles = fs.readdirSync(entitiesDir).filter(f => f.endsWith(".json"));

    console.log(`Monitoring ${entityFiles.length} entities...\n`);

    for (const file of entityFiles) {
      const slug = file.replace(".json", "");
      const result = await monitorEntity(slug);
      if (result) {
        results.push(result);
      }
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } else if (args[0] === "--entity" && args[1]) {
    const result = await monitorEntity(args[1]);
    if (result) {
      results.push(result);
    }
  }

  if (results.length > 0) {
    await saveResults(results);

    console.log("\n--- Summary ---");
    console.log(`Entities checked: ${results.length}`);
    console.log(`Citations found: ${results.filter(r => r.cited).length}`);

    const cited = results.filter(r => r.cited);
    if (cited.length > 0) {
      console.log("\nCited entities:");
      cited.forEach(r => console.log(`  - ${r.entityName}: ${r.citedUrl}`));
    }
  }
}

main().catch(console.error);
