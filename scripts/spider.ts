#!/usr/bin/env npx ts-node
/**
 * missing.link Content Spider
 *
 * Crawls websites and extracts content for AI processing.
 *
 * Usage:
 *   npm run spider -- --url https://example.com [options]
 *
 * Options:
 *   --url <url>          Starting URL to crawl (required unless --resume or --list)
 *   --max-pages <n>      Maximum pages to crawl (default: 50)
 *   --max-depth <n>      Maximum depth from seed URL (default: 3)
 *   --delay <ms>         Delay between requests in ms (default: 1000)
 *   --include <patterns> Comma-separated glob patterns to include
 *   --exclude <patterns> Comma-separated glob patterns to exclude
 *   --output <dir>       Output directory (default: ./crawls)
 *   --oxylabs            Use Oxylabs for JavaScript rendering
 *   --no-robots          Ignore robots.txt
 *   --resume <path>      Resume an interrupted crawl from state file
 *   --list               List recent crawls
 *   --help               Show this help message
 *
 * Examples:
 *   npm run spider -- --url https://upbound.com
 *   npm run spider -- --url https://upbound.com --max-pages 100 --max-depth 5
 *   npm run spider -- --url https://example.com --include "/about/*,/team/*"
 *   npm run spider -- --resume ./crawls/upbound.com/2026-01-24_143000/state.json
 *   npm run spider -- --list
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Crawler, listCrawls } from "../lib/spider/crawler";
import { SpiderConfig } from "../lib/spider/types";

interface CliArgs {
  url?: string;
  maxPages?: number;
  maxDepth?: number;
  delay?: number;
  include?: string;
  exclude?: string;
  output?: string;
  oxylabs?: boolean;
  noRobots?: boolean;
  resume?: string;
  list?: boolean;
  help?: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case "--url":
      case "-u":
        args.url = next;
        i++;
        break;
      case "--max-pages":
        args.maxPages = parseInt(next, 10);
        i++;
        break;
      case "--max-depth":
        args.maxDepth = parseInt(next, 10);
        i++;
        break;
      case "--delay":
        args.delay = parseInt(next, 10);
        i++;
        break;
      case "--include":
        args.include = next;
        i++;
        break;
      case "--exclude":
        args.exclude = next;
        i++;
        break;
      case "--output":
      case "-o":
        args.output = next;
        i++;
        break;
      case "--oxylabs":
        args.oxylabs = true;
        break;
      case "--no-robots":
        args.noRobots = true;
        break;
      case "--resume":
      case "-r":
        args.resume = next;
        i++;
        break;
      case "--list":
      case "-l":
        args.list = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
    }
  }

  return args;
}

function showHelp(): void {
  console.log(`
missing.link Content Spider
Crawls websites and extracts content for AI processing.

USAGE:
  npm run spider -- --url <url> [options]
  npm run spider -- --resume <state-file>
  npm run spider -- --list

OPTIONS:
  --url, -u <url>        Starting URL to crawl (required unless --resume or --list)
  --max-pages <n>        Maximum pages to crawl (default: 50)
  --max-depth <n>        Maximum depth from seed URL (default: 3)
  --delay <ms>           Delay between requests in ms (default: 1000)
  --include <patterns>   Comma-separated glob patterns to include
  --exclude <patterns>   Comma-separated glob patterns to exclude
  --output, -o <dir>     Output directory (default: ./crawls)
  --oxylabs              Use Oxylabs for JavaScript rendering
  --no-robots            Ignore robots.txt
  --resume, -r <path>    Resume an interrupted crawl from state.json
  --list, -l             List recent crawls
  --help, -h             Show this help message

EXAMPLES:
  # Basic crawl
  npm run spider -- --url https://upbound.com

  # With limits
  npm run spider -- --url https://upbound.com --max-pages 100 --max-depth 5

  # With filtering
  npm run spider -- --url https://upbound.com --include "/about/*,/team/*" --exclude "/blog/*"

  # Resume interrupted crawl
  npm run spider -- --resume ./crawls/upbound.com/2026-01-24_143000/state.json

  # Use Oxylabs for JS-heavy sites
  npm run spider -- --url https://example.com --oxylabs

  # List recent crawls
  npm run spider -- --list

OUTPUT STRUCTURE:
  crawls/
  └── [domain]/
      └── [YYYY-MM-DD_HHmmss]/
          ├── manifest.json        # Crawl metadata + page list
          ├── pages/
          │   ├── [url-hash].html  # Raw HTML
          │   ├── [url-hash].txt   # Clean text
          │   └── [url-hash].json  # Page metadata
          └── state.json           # For resume capability
`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  // Show help
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // List crawls
  if (args.list) {
    listCrawls(args.output || "./crawls");
    process.exit(0);
  }

  // Resume crawl
  if (args.resume) {
    const config: SpiderConfig = {
      seedUrl: "", // Will be loaded from state
      maxPages: args.maxPages,
      maxDepth: args.maxDepth,
      delayMs: args.delay,
      outputDir: args.output,
      useOxylabs: args.oxylabs,
      respectRobotsTxt: !args.noRobots,
    };

    // Remove undefined values
    const cleanConfig: Record<string, unknown> = { ...config };
    Object.keys(cleanConfig).forEach((key) => {
      if (cleanConfig[key] === undefined) {
        delete cleanConfig[key];
      }
    });

    const crawler = new Crawler(cleanConfig as unknown as SpiderConfig);
    const result = await crawler.resume(args.resume);

    process.exit(result.success ? 0 : 1);
  }

  // New crawl - URL required
  if (!args.url) {
    console.error("Error: --url is required for new crawls");
    console.error("Use --help for usage information");
    process.exit(1);
  }

  // Validate URL
  try {
    new URL(args.url);
  } catch {
    console.error(`Error: Invalid URL: ${args.url}`);
    process.exit(1);
  }

  // Build config
  const config: SpiderConfig = {
    seedUrl: args.url,
  };

  if (args.maxPages !== undefined) config.maxPages = args.maxPages;
  if (args.maxDepth !== undefined) config.maxDepth = args.maxDepth;
  if (args.delay !== undefined) config.delayMs = args.delay;
  if (args.output !== undefined) config.outputDir = args.output;
  if (args.oxylabs !== undefined) config.useOxylabs = args.oxylabs;
  if (args.noRobots !== undefined) config.respectRobotsTxt = !args.noRobots;

  if (args.include) {
    config.includePatterns = args.include.split(",").map((p) => p.trim());
  }

  if (args.exclude) {
    config.excludePatterns = args.exclude.split(",").map((p) => p.trim());
  }

  // Run crawler
  const crawler = new Crawler(config);
  const result = await crawler.crawl();

  process.exit(result.success ? 0 : 1);
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log("\n\nCrawl interrupted. State saved. Use --resume to continue.");
  process.exit(130);
});

// Run
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
