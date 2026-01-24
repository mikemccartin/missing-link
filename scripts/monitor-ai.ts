#!/usr/bin/env npx ts-node

/**
 * AI Mention Monitoring CLI for missing.link
 *
 * Queries AI platforms (Perplexity, ChatGPT, Google AI Mode) about entities and tracks citations.
 *
 * Usage:
 *   npm run monitor-ai -- --entity tandem-theory
 *   npm run monitor-ai -- --all
 *   npm run monitor-ai -- --entity tandem-theory --platform perplexity
 *   npm run monitor-ai -- --entity tandem-theory --platform chatgpt
 *   npm run monitor-ai -- --entity tandem-theory --platform google
 *
 * Environment variables required:
 *   OXYLABS_USERNAME
 *   OXYLABS_PASSWORD
 *   UPSTASH_REDIS_REST_URL (optional, for storing results)
 *   UPSTASH_REDIS_REST_TOKEN (optional)
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import {
  PLATFORMS,
  PlatformKey,
  MentionResult,
  monitorEntity,
  monitorAllEntities,
  saveResults,
} from "../lib/monitor";

function parseArgs(args: string[]): {
  entity?: string;
  all: boolean;
  platforms: PlatformKey[];
} {
  const result = {
    entity: undefined as string | undefined,
    all: false,
    platforms: ["perplexity", "chatgpt", "google"] as PlatformKey[],
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--all") {
      result.all = true;
    } else if (args[i] === "--entity" && args[i + 1]) {
      result.entity = args[i + 1];
      i++;
    } else if (args[i] === "--platform" && args[i + 1]) {
      const platform = args[i + 1].toLowerCase();
      if (platform === "perplexity" || platform === "chatgpt" || platform === "google") {
        result.platforms = [platform];
      } else if (platform === "all") {
        result.platforms = ["perplexity", "chatgpt", "google"];
      } else {
        console.error(`Unknown platform: ${platform}`);
        console.error("Valid platforms: perplexity, chatgpt, google, all");
        process.exit(1);
      }
      i++;
    }
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("AI Mention Monitor for missing.link\n");
    console.log("Usage:");
    console.log("  npm run monitor-ai -- --entity tandem-theory");
    console.log("  npm run monitor-ai -- --entity tandem-theory --platform perplexity");
    console.log("  npm run monitor-ai -- --entity tandem-theory --platform chatgpt");
    console.log("  npm run monitor-ai -- --entity tandem-theory --platform google");
    console.log("  npm run monitor-ai -- --all");
    console.log("  npm run monitor-ai -- --all --platform perplexity");
    console.log("\nPlatforms:");
    console.log("  perplexity  - Perplexity AI (default, most detailed sources)");
    console.log("  chatgpt     - ChatGPT (4000 char prompt limit)");
    console.log("  google      - Google AI Mode (400 char prompt limit)");
    console.log("  all         - Query all platforms (default)");
    console.log("\nRequired environment variables:");
    console.log("  OXYLABS_USERNAME");
    console.log("  OXYLABS_PASSWORD");
    process.exit(1);
  }

  const parsedArgs = parseArgs(args);
  let results: MentionResult[] = [];

  console.log(
    `Platforms: ${parsedArgs.platforms.map((p) => PLATFORMS[p].name).join(", ")}`
  );

  if (parsedArgs.all) {
    results = await monitorAllEntities(parsedArgs.platforms, true);
  } else if (parsedArgs.entity) {
    results = await monitorEntity(parsedArgs.entity, parsedArgs.platforms, true);
  }

  if (results.length > 0) {
    const runResult = saveResults(results);

    console.log("\n" + "=".repeat(50));
    console.log("SUMMARY");
    console.log("=".repeat(50));

    // Group by platform
    for (const [platform, stats] of Object.entries(runResult.platformBreakdown)) {
      const platformName = PLATFORMS[platform as PlatformKey]?.name || platform;
      console.log(`\n${platformName}:`);
      console.log(`  Entities checked: ${stats.checked}`);
      console.log(`  Citations found: ${stats.cited}`);
    }

    const allCited = results.filter((r) => r.cited);
    if (allCited.length > 0) {
      console.log("\n CITATIONS FOUND:");
      allCited.forEach((r) => {
        const platformName = PLATFORMS[r.platform as PlatformKey]?.name || r.platform;
        console.log(`  - ${r.entityName} on ${platformName}: ${r.citedUrl}`);
      });
    } else {
      console.log("\n No missing.link citations found yet");
    }

    console.log(`\nTotal checks: ${results.length}`);
    console.log(`Total citations: ${allCited.length}`);
    console.log(`\nResults saved to content/ai-mentions/`);
  }
}

main().catch(console.error);
