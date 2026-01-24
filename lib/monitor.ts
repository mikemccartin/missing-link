/**
 * AI Mention Monitoring Library for missing.link
 *
 * Core monitoring logic extracted for reuse by CLI and cron endpoints.
 */

import fs from "fs";
import path from "path";
import https from "https";

const CONTENT_DIR = path.join(process.cwd(), "content");
const RESULTS_DIR = path.join(process.cwd(), "content", "ai-mentions");

// Platform configurations
export const PLATFORMS = {
  perplexity: {
    source: "perplexity",
    name: "Perplexity",
    timeout: 180000,
    maxPromptLength: 10000,
  },
  chatgpt: {
    source: "chatgpt",
    name: "ChatGPT",
    timeout: 180000,
    maxPromptLength: 4000,
  },
  google: {
    source: "google_ai_mode",
    name: "Google AI Mode",
    timeout: 180000,
    maxPromptLength: 400,
  },
} as const;

export type PlatformKey = keyof typeof PLATFORMS;

export interface AIQueryResult {
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

export interface MentionResult {
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

export interface MonitoringRunResult {
  timestamp: string;
  totalChecks: number;
  citations: number;
  platformBreakdown: Record<string, { checked: number; cited: number }>;
  results: MentionResult[];
}

export async function queryAIPlatform(
  prompt: string,
  platformKey: PlatformKey
): Promise<AIQueryResult | null> {
  const username = process.env.OXYLABS_USERNAME;
  const password = process.env.OXYLABS_PASSWORD;

  if (!username || !password) {
    throw new Error("OXYLABS_USERNAME and OXYLABS_PASSWORD required");
  }

  const platform = PLATFORMS[platformKey];

  // Truncate prompt if needed for platform limits
  const truncatedPrompt = prompt.slice(0, platform.maxPromptLength);

  // Google AI Mode uses "query" parameter and requires "render", others use "prompt"
  const payload = JSON.stringify(
    platformKey === "google"
      ? {
          source: platform.source,
          query: truncatedPrompt,
          geo_location: "United States",
          render: "html",
          parse: true,
        }
      : {
          source: platform.source,
          prompt: truncatedPrompt,
          geo_location: "United States",
          parse: true,
        }
  );

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
        timeout: platform.timeout,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            console.error(
              `  ${platform.name}: Oxylabs returned status ${res.statusCode}: ${data.slice(0, 300)}`
            );
            resolve(null);
            return;
          }
          try {
            const response = JSON.parse(data);
            if (response.results && response.results[0]) {
              const result = response.results[0];
              const content = result.content;

              // Parse based on platform
              if (platformKey === "perplexity") {
                resolve(parsePerplexityResponse(content, prompt));
              } else if (platformKey === "chatgpt") {
                resolve(parseChatGPTResponse(content, prompt));
              } else if (platformKey === "google") {
                resolve(parseGoogleAIResponse(content, prompt));
              } else {
                resolve(null);
              }
            } else {
              console.error(`  ${platform.name}: No results in response`);
              resolve(null);
            }
          } catch (e) {
            console.error(`  ${platform.name} parse error:`, e);
            reject(e);
          }
        });
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`${platform.name} request timed out`));
    });
    req.write(payload);
    req.end();
  });
}

function parsePerplexityResponse(
  content: any,
  prompt: string
): AIQueryResult | null {
  if (typeof content === "object") {
    const answerResults = content.answer_results || [];
    const sources: Array<{ title: string; url: string }> = [];

    for (const result of answerResults) {
      if (result.citations) {
        for (const citation of result.citations) {
          sources.push({
            title: citation.title || citation.name || "",
            url: citation.url || "",
          });
        }
      }
      if (result.sources) {
        for (const src of result.sources) {
          sources.push({
            title: src.title || src.name || "",
            url: src.url || "",
          });
        }
      }
    }

    const additionalResults = content.additional_results;
    if (Array.isArray(additionalResults)) {
      for (const result of additionalResults) {
        if (result.url) {
          sources.push({
            title: result.title || result.name || "",
            url: result.url,
          });
        }
      }
    } else if (additionalResults && typeof additionalResults === "object") {
      for (const key of Object.keys(additionalResults)) {
        const arr = additionalResults[key];
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item.url) {
              sources.push({
                title: item.title || item.name || "",
                url: item.url,
              });
            }
          }
        }
      }
    }

    const answerText =
      content.answer_results_md ||
      answerResults[0]?.answer ||
      answerResults[0]?.text ||
      "";

    return {
      url: content.url || "",
      model: content.model || "perplexity",
      prompt,
      answer: typeof answerText === "string" ? answerText : JSON.stringify(answerText),
      related_queries: content.related_queries || [],
      sources,
    };
  } else if (typeof content === "string") {
    return {
      url: `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`,
      model: "perplexity",
      prompt,
      answer: content.slice(0, 2000),
      related_queries: [],
      sources: extractLinksFromHtml(content),
    };
  }
  return null;
}

function parseChatGPTResponse(
  content: any,
  prompt: string
): AIQueryResult | null {
  if (typeof content === "object") {
    const sources: Array<{ title: string; url: string }> = [];
    let answerText = "";

    // ChatGPT has response_text at top level
    if (content.response_text) {
      answerText = content.response_text;
    }

    // Fallback: parse SSE stream in raw_response array
    if (!answerText && content.raw_response && Array.isArray(content.raw_response)) {
      const parts: string[] = [];

      for (const line of content.raw_response) {
        if (typeof line === "string" && line.startsWith("data: ")) {
          try {
            const jsonStr = line.slice(6);
            if (jsonStr && jsonStr !== "[DONE]") {
              const data = JSON.parse(jsonStr);

              // Look for text deltas
              if (data.v && typeof data.v === "string") {
                parts.push(data.v);
              }

              // Look for assistant message content
              if (
                data.v?.message?.author?.role === "assistant" &&
                data.v?.message?.content?.parts
              ) {
                for (const part of data.v.message.content.parts) {
                  if (typeof part === "string" && part.length > 0) {
                    parts.push(part);
                  }
                }
              }
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      if (parts.length > 0) {
        answerText = parts.join("");
      }
    }

    // Final fallback
    if (!answerText) {
      answerText = content.answer || content.response || "";
    }

    return {
      url: content.url || "https://chat.openai.com",
      model: content.llm_model || content.model || "chatgpt",
      prompt,
      answer: typeof answerText === "string" ? answerText : JSON.stringify(answerText),
      related_queries: [],
      sources,
    };
  } else if (typeof content === "string") {
    return {
      url: "https://chat.openai.com",
      model: "chatgpt",
      prompt,
      answer: content.slice(0, 2000),
      related_queries: [],
      sources: extractLinksFromHtml(content),
    };
  }
  return null;
}

function parseGoogleAIResponse(
  content: any,
  prompt: string
): AIQueryResult | null {
  if (typeof content === "object") {
    const sources: Array<{ title: string; url: string }> = [];
    const answerParts: string[] = [];

    // Google AI Mode returns citations array with text and urls
    if (content.citations && Array.isArray(content.citations)) {
      for (const citation of content.citations) {
        // Each citation has text (the answer portion) and urls (sources)
        if (citation.text) {
          answerParts.push(citation.text);
        }

        // Extract URLs from the urls array
        if (citation.urls && Array.isArray(citation.urls)) {
          for (const url of citation.urls) {
            if (typeof url === "string" && url.startsWith("http")) {
              // Extract domain as title from URL
              const domain = url.match(/https?:\/\/([^\/:#?]+)/)?.[1] || "";
              sources.push({
                title: domain,
                url: url.split("#")[0], // Remove fragment
              });
            }
          }
        }
      }
    }

    // Fallback to other fields
    if (content.sources) {
      for (const src of content.sources) {
        sources.push({
          title: src.title || src.name || "",
          url: src.url || src.link || "",
        });
      }
    }

    // Deduplicate sources by URL
    const uniqueSources = sources.reduce(
      (acc, source) => {
        if (source.url && !acc.find((s) => s.url === source.url)) {
          acc.push(source);
        }
        return acc;
      },
      [] as Array<{ title: string; url: string }>
    );

    const answerText =
      answerParts.join("\n\n") ||
      content.ai_overview ||
      content.answer ||
      content.response ||
      "";

    return {
      url:
        content.url ||
        `https://www.google.com/search?q=${encodeURIComponent(prompt)}`,
      model: "google_ai_mode",
      prompt,
      answer: typeof answerText === "string" ? answerText : JSON.stringify(answerText),
      related_queries: content.related_searches || [],
      sources: uniqueSources,
    };
  } else if (typeof content === "string") {
    return {
      url: `https://www.google.com/search?q=${encodeURIComponent(prompt)}`,
      model: "google_ai_mode",
      prompt,
      answer: content.slice(0, 2000),
      related_queries: [],
      sources: extractLinksFromHtml(content),
    };
  }
  return null;
}

function extractLinksFromHtml(
  html: string
): Array<{ title: string; url: string }> {
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

export function checkForMissingLinkCitation(
  sources: Array<{ url: string }>
): { cited: boolean; citedUrl?: string } {
  for (const source of sources) {
    if (source.url.includes("missing.link")) {
      return { cited: true, citedUrl: source.url };
    }
  }
  return { cited: false };
}

export async function monitorEntity(
  entitySlug: string,
  platforms: PlatformKey[] = ["perplexity", "chatgpt", "google"],
  verbose: boolean = false
): Promise<MentionResult[]> {
  const entityPath = path.join(CONTENT_DIR, "entities", `${entitySlug}.json`);

  if (!fs.existsSync(entityPath)) {
    if (verbose) console.error(`Entity not found: ${entitySlug}`);
    return [];
  }

  const entity = JSON.parse(fs.readFileSync(entityPath, "utf-8"));
  const prompt = `What is ${entity.name}?`;

  if (verbose) {
    console.log(`\nMonitoring: ${entity.name}`);
    console.log(`Prompt: "${prompt}"`);
  }

  const results: MentionResult[] = [];

  for (const platformKey of platforms) {
    const platform = PLATFORMS[platformKey];
    if (verbose) console.log(`\n  Querying ${platform.name}...`);

    try {
      const result = await queryAIPlatform(prompt, platformKey);

      if (!result) {
        if (verbose) console.log(`    No result from ${platform.name}`);
        continue;
      }

      const citation = checkForMissingLinkCitation(result.sources);

      const mentionResult: MentionResult = {
        entity: entitySlug,
        entityName: entity.name,
        prompt,
        timestamp: new Date().toISOString(),
        platform: platformKey,
        cited: citation.cited,
        citedUrl: citation.citedUrl,
        sources: result.sources.slice(0, 10),
        answerExcerpt: result.answer.slice(0, 500),
      };

      results.push(mentionResult);

      if (verbose) {
        console.log(`    Sources found: ${result.sources.length}`);
        console.log(`    missing.link cited: ${citation.cited ? "YES!" : "No"}`);
        if (citation.cited) {
          console.log(`    Citation URL: ${citation.citedUrl}`);
        }
      }

      // Rate limit between platforms
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      if (verbose) console.error(`    Error querying ${platform.name}:`, error);
    }
  }

  return results;
}

export async function monitorAllEntities(
  platforms: PlatformKey[] = ["perplexity", "chatgpt", "google"],
  verbose: boolean = false
): Promise<MentionResult[]> {
  const entitiesDir = path.join(CONTENT_DIR, "entities");
  const entityFiles = fs
    .readdirSync(entitiesDir)
    .filter((f) => f.endsWith(".json"));

  if (verbose) {
    console.log(
      `\nMonitoring ${entityFiles.length} entities across ${platforms.length} platform(s)...`
    );
  }

  const results: MentionResult[] = [];

  for (const file of entityFiles) {
    const slug = file.replace(".json", "");
    const entityResults = await monitorEntity(slug, platforms, verbose);
    results.push(...entityResults);
    // Rate limit between entities
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return results;
}

export function saveResults(results: MentionResult[]): MonitoringRunResult {
  // Ensure directory exists
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  // Save individual results
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultsPath = path.join(RESULTS_DIR, `${timestamp}.json`);
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

  // Calculate platform breakdown
  const platformBreakdown: Record<string, { checked: number; cited: number }> = {};
  for (const r of results) {
    if (!platformBreakdown[r.platform]) {
      platformBreakdown[r.platform] = { checked: 0, cited: 0 };
    }
    platformBreakdown[r.platform].checked++;
    if (r.cited) {
      platformBreakdown[r.platform].cited++;
    }
  }

  const runResult: MonitoringRunResult = {
    timestamp: new Date().toISOString(),
    totalChecks: results.length,
    citations: results.filter((r) => r.cited).length,
    platformBreakdown,
    results,
  };

  // Update summary file
  const summaryPath = path.join(RESULTS_DIR, "latest.json");
  const summary = {
    lastRun: runResult.timestamp,
    totalChecks: runResult.totalChecks,
    citations: runResult.citations,
    platformBreakdown: runResult.platformBreakdown,
    results,
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  return runResult;
}

export function getAllEntitySlugs(): string[] {
  const entitiesDir = path.join(CONTENT_DIR, "entities");
  if (!fs.existsSync(entitiesDir)) return [];
  return fs
    .readdirSync(entitiesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""));
}
