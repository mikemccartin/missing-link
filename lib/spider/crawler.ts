/**
 * missing.link Content Spider - Core Crawling Engine
 *
 * Manages the crawl queue, fetches pages, and saves results.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as https from "https";
import * as http from "http";

import {
  SpiderConfig,
  CrawlResult,
  CrawlManifest,
  CrawlState,
  CrawlStats,
  PageResult,
  PageManifestEntry,
  ErrorEntry,
  PageType,
  DEFAULT_CONFIG,
} from "./types";
import { RobotsParser } from "./robots";
import { ContentExtractor } from "./extractor";

interface QueueItem {
  url: string;
  depth: number;
}

/**
 * Core web crawler implementation.
 */
export class Crawler {
  private config: Required<SpiderConfig>;
  private queue: QueueItem[] = [];
  private visited: Set<string> = new Set();
  private extractor: ContentExtractor;
  private robotsParser: RobotsParser | null = null;
  private stats: CrawlStats;
  private manifest: CrawlManifest;
  private crawlDir: string = "";
  private pagesDir: string = "";
  private crawlId: string = "";
  private domain: string = "";
  private responseTimes: number[] = [];

  constructor(config: SpiderConfig) {
    // Merge with defaults
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    this.extractor = new ContentExtractor();
    this.stats = this.initStats();
    this.manifest = this.initManifest();
  }

  /**
   * Initialize empty stats object.
   */
  private initStats(): CrawlStats {
    return {
      pagesRequested: 0,
      pagesSuccessful: 0,
      pagesFailed: 0,
      totalBytes: 0,
      avgResponseTimeMs: 0,
      pagesByType: {
        homepage: 0,
        about: 0,
        team: 0,
        product: 0,
        news: 0,
        contact: 0,
        legal: 0,
        other: 0,
      },
    };
  }

  /**
   * Initialize empty manifest object.
   */
  private initManifest(): CrawlManifest {
    return {
      crawlId: "",
      seedUrl: this.config.seedUrl,
      domain: "",
      startedAt: "",
      completedAt: null,
      config: { ...this.config },
      stats: this.stats,
      pages: [],
      errors: [],
    };
  }

  /**
   * Start a new crawl from the seed URL.
   */
  async crawl(): Promise<CrawlResult> {
    const startTime = new Date();

    try {
      // Parse seed URL to get domain
      const seedUrl = new URL(this.config.seedUrl);
      this.domain = seedUrl.hostname;

      // Generate crawl ID
      const timestamp = startTime
        .toISOString()
        .replace(/[-:]/g, "")
        .replace("T", "_")
        .slice(0, 15);
      this.crawlId = `${this.domain}_${timestamp}`;

      // Setup output directories
      this.crawlDir = path.join(this.config.outputDir, this.domain, timestamp);
      this.pagesDir = path.join(this.crawlDir, "pages");
      fs.mkdirSync(this.pagesDir, { recursive: true });

      // Initialize manifest
      this.manifest.crawlId = this.crawlId;
      this.manifest.domain = this.domain;
      this.manifest.startedAt = startTime.toISOString();

      console.log(`\nStarting crawl: ${this.crawlId}`);
      console.log(`Seed URL: ${this.config.seedUrl}`);
      console.log(`Output: ${this.crawlDir}`);
      console.log(
        `Limits: max ${this.config.maxPages} pages, depth ${this.config.maxDepth}`
      );
      console.log("");

      // Fetch and parse robots.txt if enabled
      if (this.config.respectRobotsTxt) {
        console.log("Fetching robots.txt...");
        this.robotsParser = await RobotsParser.fetch(this.config.seedUrl);

        // Check for crawl delay
        const robotsDelay = this.robotsParser.getCrawlDelay(
          this.config.userAgent
        );
        if (robotsDelay && robotsDelay * 1000 > this.config.delayMs) {
          console.log(
            `  robots.txt specifies crawl-delay: ${robotsDelay}s (using this instead of ${this.config.delayMs}ms)`
          );
          this.config.delayMs = robotsDelay * 1000;
        }
      }

      // Add seed URL to queue
      const normalizedSeed = this.extractor.normalizeUrl(this.config.seedUrl);
      this.queue.push({ url: normalizedSeed, depth: 0 });

      // Process queue
      await this.processQueue();

      // Finalize
      this.manifest.completedAt = new Date().toISOString();
      this.manifest.stats = this.stats;
      this.saveManifest();

      console.log("\nCrawl complete!");
      console.log(`  Pages crawled: ${this.stats.pagesSuccessful}`);
      console.log(`  Pages failed: ${this.stats.pagesFailed}`);
      console.log(
        `  Total bytes: ${(this.stats.totalBytes / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(`  Output: ${this.crawlDir}`);

      return {
        success: true,
        outputPath: this.crawlDir,
        manifestPath: path.join(this.crawlDir, "manifest.json"),
        manifest: this.manifest,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error(`\nCrawl failed: ${errorMsg}`);

      return {
        success: false,
        outputPath: this.crawlDir,
        manifestPath: path.join(this.crawlDir, "manifest.json"),
        manifest: this.manifest,
        error: errorMsg,
      };
    }
  }

  /**
   * Resume an interrupted crawl from a state file.
   */
  async resume(stateFile: string): Promise<CrawlResult> {
    try {
      // Load state
      const stateContent = fs.readFileSync(stateFile, "utf-8");
      const state: CrawlState = JSON.parse(stateContent);

      console.log(`\nResuming crawl: ${state.crawlId}`);
      console.log(`  State saved at: ${state.savedAt}`);
      console.log(`  Queue remaining: ${state.queue.length} URLs`);
      console.log(`  Already visited: ${state.visited.length} URLs`);

      // Restore state
      this.crawlId = state.crawlId;
      this.queue = state.queue;
      this.visited = new Set(state.visited);
      this.stats = state.stats;

      // Restore paths
      const stateDir = path.dirname(stateFile);
      this.crawlDir = stateDir;
      this.pagesDir = path.join(this.crawlDir, "pages");

      // Load existing manifest
      const manifestPath = path.join(this.crawlDir, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        const manifestContent = fs.readFileSync(manifestPath, "utf-8");
        this.manifest = JSON.parse(manifestContent);
        this.domain = this.manifest.domain;
      }

      // Fetch robots.txt again
      if (this.config.respectRobotsTxt) {
        this.robotsParser = await RobotsParser.fetch(this.config.seedUrl);
      }

      // Continue processing
      await this.processQueue();

      // Finalize
      this.manifest.completedAt = new Date().toISOString();
      this.manifest.stats = this.stats;
      this.saveManifest();

      // Remove state file on successful completion
      fs.unlinkSync(stateFile);

      console.log("\nCrawl resumed and completed!");
      console.log(`  Total pages: ${this.stats.pagesSuccessful}`);
      console.log(`  Output: ${this.crawlDir}`);

      return {
        success: true,
        outputPath: this.crawlDir,
        manifestPath: path.join(this.crawlDir, "manifest.json"),
        manifest: this.manifest,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error(`\nResume failed: ${errorMsg}`);

      return {
        success: false,
        outputPath: this.crawlDir,
        manifestPath: path.join(this.crawlDir, "manifest.json"),
        manifest: this.manifest,
        error: errorMsg,
      };
    }
  }

  /**
   * Process the crawl queue.
   */
  private async processQueue(): Promise<void> {
    while (
      this.queue.length > 0 &&
      this.stats.pagesSuccessful < this.config.maxPages
    ) {
      const item = this.queue.shift()!;
      const normalizedUrl = this.extractor.normalizeUrl(item.url);

      // Skip if already visited
      if (this.visited.has(normalizedUrl)) {
        continue;
      }

      // Skip if depth exceeded
      if (item.depth > this.config.maxDepth) {
        continue;
      }

      // Check robots.txt
      if (
        this.robotsParser &&
        !this.robotsParser.isAllowed(normalizedUrl, this.config.userAgent)
      ) {
        console.log(`  [ROBOTS] Skipping: ${normalizedUrl}`);
        continue;
      }

      // Check URL filters
      if (!this.shouldCrawl(normalizedUrl)) {
        continue;
      }

      // Mark as visited
      this.visited.add(normalizedUrl);

      // Fetch page
      console.log(
        `[${this.stats.pagesSuccessful + 1}/${this.config.maxPages}] Fetching: ${normalizedUrl}`
      );

      const result = await this.fetchPage(normalizedUrl, item.depth);

      if (result.error) {
        // Failed
        this.stats.pagesFailed++;
        this.stats.pagesRequested++;
        this.manifest.errors.push({
          url: normalizedUrl,
          error: result.error,
          timestamp: new Date().toISOString(),
          status: result.status,
        });
        console.log(`  [FAILED] ${result.error}`);
      } else {
        // Success
        this.stats.pagesSuccessful++;
        this.stats.pagesRequested++;
        this.stats.totalBytes += result.contentLength;
        this.stats.pagesByType[result.type]++;

        // Track response time for average
        this.responseTimes.push(result.responseTimeMs);
        this.stats.avgResponseTimeMs = Math.round(
          this.responseTimes.reduce((a, b) => a + b, 0) /
            this.responseTimes.length
        );

        // Save page files
        this.savePage(result);

        // Add to manifest
        const entry: PageManifestEntry = {
          url: result.url,
          urlHash: result.urlHash,
          status: result.status,
          type: result.type,
          title: result.metadata.title,
          fetchedAt: result.fetchedAt,
          depth: result.depth,
          contentLength: result.contentLength,
        };
        this.manifest.pages.push(entry);

        // Add internal links to queue
        for (const link of result.internalLinks) {
          const normalizedLink = this.extractor.normalizeUrl(link);
          if (!this.visited.has(normalizedLink)) {
            this.queue.push({ url: normalizedLink, depth: item.depth + 1 });
          }
        }

        console.log(
          `  [OK] ${result.type} | ${result.metadata.title.slice(0, 50)}${result.metadata.title.length > 50 ? "..." : ""}`
        );
      }

      // Save state periodically (every 10 pages)
      if (this.stats.pagesRequested % 10 === 0) {
        this.saveState();
        this.saveManifest();
      }

      // Rate limiting
      if (this.queue.length > 0) {
        await this.delay(this.config.delayMs);
      }
    }
  }

  /**
   * Fetch a single page.
   */
  private async fetchPage(url: string, depth: number): Promise<PageResult> {
    const startTime = Date.now();
    const urlHash = this.hashUrl(url);

    try {
      let html: string;

      if (this.config.useOxylabs) {
        html = await this.fetchWithOxylabs(url);
      } else {
        html = await this.fetchDirect(url);
      }

      const responseTimeMs = Date.now() - startTime;

      // Extract content
      const metadata = this.extractor.extractMetadata(html, url);
      const text = this.extractor.extractText(html);
      const pageType = this.extractor.classifyPage(url, html, metadata);
      const links = this.extractor.extractLinks(html, url);
      const jsonLd = this.extractor.extractJsonLd(html);

      return {
        url,
        urlHash,
        status: 200,
        type: pageType,
        metadata,
        html,
        text,
        internalLinks: links.internal,
        externalLinks: links.external,
        jsonLd,
        fetchedAt: new Date().toISOString(),
        depth,
        responseTimeMs,
        contentLength: Buffer.byteLength(html, "utf-8"),
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      const errorMsg =
        error instanceof Error ? error.message : "Unknown error";

      // Try to extract status code from error
      let status = 0;
      if (errorMsg.includes("404")) status = 404;
      else if (errorMsg.includes("403")) status = 403;
      else if (errorMsg.includes("500")) status = 500;
      else if (errorMsg.includes("timeout")) status = 408;

      return {
        url,
        urlHash,
        status,
        type: "other" as PageType,
        metadata: {
          title: "",
          description: "",
          canonicalUrl: null,
          ogImage: null,
          ogType: null,
          language: null,
          author: null,
          publishedDate: null,
          modifiedDate: null,
        },
        html: "",
        text: "",
        internalLinks: [],
        externalLinks: [],
        jsonLd: null,
        fetchedAt: new Date().toISOString(),
        depth,
        responseTimeMs,
        contentLength: 0,
        error: errorMsg,
      };
    }
  }

  /**
   * Fetch a URL directly using native https/http modules.
   */
  private fetchDirect(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === "https:" ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers: {
          "User-Agent": this.config.userAgent,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "identity",
          Connection: "keep-alive",
        },
        timeout: this.config.timeout,
      };

      const req = client.request(options, (res) => {
        // Handle redirects
        if (
          this.config.followRedirects &&
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          // Resolve relative redirect
          const redirectUrl = new URL(res.headers.location, url).toString();
          resolve(this.fetchDirect(redirectUrl));
          return;
        }

        // Check for error status
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let data = "";
        res.setEncoding("utf-8");

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          resolve(data);
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.end();
    });
  }

  /**
   * Fetch a URL using Oxylabs for JavaScript rendering.
   */
  private async fetchWithOxylabs(url: string): Promise<string> {
    const username = process.env.OXYLABS_USERNAME;
    const password = process.env.OXYLABS_PASSWORD;

    if (!username || !password) {
      throw new Error(
        "OXYLABS_USERNAME and OXYLABS_PASSWORD environment variables required for --oxylabs mode"
      );
    }

    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        source: "universal",
        url: url,
        render: "html",
        parse: false,
      });

      const auth = Buffer.from(`${username}:${password}`).toString("base64");

      const options = {
        hostname: "realtime.oxylabs.io",
        port: 443,
        path: "/v1/queries",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: this.config.timeout,
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.setEncoding("utf-8");

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            const response = JSON.parse(data);
            if (response.results && response.results[0]) {
              resolve(response.results[0].content);
            } else {
              reject(new Error("No content in Oxylabs response"));
            }
          } catch (e) {
            reject(new Error(`Failed to parse Oxylabs response: ${e}`));
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Oxylabs request timeout"));
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Check if a URL should be crawled based on include/exclude patterns.
   */
  private shouldCrawl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const pathAndQuery = parsed.pathname + parsed.search;

      // Check exclude patterns first
      for (const pattern of this.config.excludePatterns) {
        if (this.matchGlob(pattern, pathAndQuery) || this.matchGlob(pattern, url)) {
          return false;
        }
      }

      // If include patterns are specified, URL must match at least one
      if (this.config.includePatterns.length > 0) {
        for (const pattern of this.config.includePatterns) {
          if (this.matchGlob(pattern, pathAndQuery) || this.matchGlob(pattern, url)) {
            return true;
          }
        }
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Simple glob pattern matching.
   */
  private matchGlob(pattern: string, text: string): boolean {
    // Convert glob to regex
    let regexStr = "^";
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      if (char === "*") {
        if (pattern[i + 1] === "*") {
          // ** matches anything including /
          regexStr += ".*";
          i++;
        } else {
          // * matches anything except /
          regexStr += "[^/]*";
        }
      } else if (char === "?") {
        regexStr += "[^/]";
      } else if ("[](){}+.\\^$|".includes(char)) {
        regexStr += "\\" + char;
      } else {
        regexStr += char;
      }
    }
    regexStr += "$";

    try {
      return new RegExp(regexStr, "i").test(text);
    } catch {
      return false;
    }
  }

  /**
   * Generate a hash for a URL to use as filename.
   */
  private hashUrl(url: string): string {
    return crypto.createHash("md5").update(url).digest("hex").slice(0, 12);
  }

  /**
   * Save page files (HTML, TXT, JSON).
   */
  private savePage(result: PageResult): void {
    const basePath = path.join(this.pagesDir, result.urlHash);

    // Save raw HTML
    fs.writeFileSync(`${basePath}.html`, result.html, "utf-8");

    // Save clean text
    fs.writeFileSync(`${basePath}.txt`, result.text, "utf-8");

    // Save metadata JSON
    const metadataJson = {
      url: result.url,
      urlHash: result.urlHash,
      status: result.status,
      type: result.type,
      metadata: result.metadata,
      internalLinks: result.internalLinks,
      externalLinks: result.externalLinks,
      jsonLd: result.jsonLd,
      fetchedAt: result.fetchedAt,
      depth: result.depth,
      responseTimeMs: result.responseTimeMs,
      contentLength: result.contentLength,
    };
    fs.writeFileSync(
      `${basePath}.json`,
      JSON.stringify(metadataJson, null, 2),
      "utf-8"
    );
  }

  /**
   * Save current crawl state for resume capability.
   */
  private saveState(): void {
    const state: CrawlState = {
      crawlId: this.crawlId,
      queue: this.queue,
      visited: Array.from(this.visited),
      stats: this.stats,
      savedAt: new Date().toISOString(),
    };

    const statePath = path.join(this.crawlDir, "state.json");
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
  }

  /**
   * Save the crawl manifest.
   */
  private saveManifest(): void {
    const manifestPath = path.join(this.crawlDir, "manifest.json");
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(this.manifest, null, 2),
      "utf-8"
    );
  }

  /**
   * Delay helper for rate limiting.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * List recent crawls in the output directory.
 */
export function listCrawls(outputDir: string = "./crawls"): void {
  if (!fs.existsSync(outputDir)) {
    console.log("No crawls found.");
    return;
  }

  const domains = fs.readdirSync(outputDir).filter((f) => {
    const stat = fs.statSync(path.join(outputDir, f));
    return stat.isDirectory();
  });

  if (domains.length === 0) {
    console.log("No crawls found.");
    return;
  }

  console.log("\nRecent crawls:\n");

  for (const domain of domains) {
    const domainPath = path.join(outputDir, domain);
    const crawls = fs
      .readdirSync(domainPath)
      .filter((f) => {
        const stat = fs.statSync(path.join(domainPath, f));
        return stat.isDirectory();
      })
      .sort()
      .reverse()
      .slice(0, 5);

    for (const crawl of crawls) {
      const manifestPath = path.join(domainPath, crawl, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest: CrawlManifest = JSON.parse(
            fs.readFileSync(manifestPath, "utf-8")
          );
          const status = manifest.completedAt ? "complete" : "in-progress";
          console.log(
            `  ${domain}/${crawl} - ${manifest.stats.pagesSuccessful} pages [${status}]`
          );
        } catch {
          console.log(`  ${domain}/${crawl} - [error reading manifest]`);
        }
      }
    }
  }
}
