/**
 * missing.link Content Spider - Type Definitions
 *
 * Core types for the web crawler and content extraction system.
 */

/**
 * Page type classification based on URL patterns and content.
 */
export type PageType =
  | "homepage"
  | "about"
  | "team"
  | "product"
  | "news"
  | "contact"
  | "legal"
  | "other";

/**
 * Spider configuration options.
 */
export interface SpiderConfig {
  // Required
  /** Starting URL for the crawl (e.g., "https://upbound.com") */
  seedUrl: string;

  // Crawl limits
  /** Maximum number of pages to crawl. Default: 50 */
  maxPages?: number;
  /** Maximum depth from seed URL. Default: 3 */
  maxDepth?: number;

  // Rate limiting
  /** Delay between requests in milliseconds. Default: 1000 */
  delayMs?: number;

  // URL filtering
  /** Glob patterns to include (e.g., ["/about/*", "/team/*"]) */
  includePatterns?: string[];
  /** Glob patterns to exclude (e.g., ["*.pdf", "*.jpg"]). Defaults include common binary files. */
  excludePatterns?: string[];

  // Behavior
  /** Whether to respect robots.txt. Default: true */
  respectRobotsTxt?: boolean;
  /** Whether to follow HTTP redirects. Default: true */
  followRedirects?: boolean;

  // Output
  /** Output directory for crawl data. Default: "./crawls" */
  outputDir?: string;

  // Advanced
  /** User agent string. Default: "missing.link-spider/1.0" */
  userAgent?: string;
  /** Request timeout in milliseconds. Default: 30000 */
  timeout?: number;
  /** Use Oxylabs for JavaScript-rendered pages. Default: false */
  useOxylabs?: boolean;
}

/**
 * Metadata extracted from a page.
 */
export interface PageMetadata {
  /** Page title from <title> or og:title */
  title: string;
  /** Meta description or og:description */
  description: string;
  /** Canonical URL if specified */
  canonicalUrl: string | null;
  /** Open Graph image URL */
  ogImage: string | null;
  /** Open Graph type (website, article, etc.) */
  ogType: string | null;
  /** Language from html lang attribute */
  language: string | null;
  /** Author if specified in meta tags */
  author: string | null;
  /** Published date if available */
  publishedDate: string | null;
  /** Modified date if available */
  modifiedDate: string | null;
}

/**
 * Result of fetching and processing a single page.
 */
export interface PageResult {
  /** Normalized URL of the page */
  url: string;
  /** Hash of the URL for filename */
  urlHash: string;
  /** HTTP status code */
  status: number;
  /** Classified page type */
  type: PageType;
  /** Extracted metadata */
  metadata: PageMetadata;
  /** Raw HTML content */
  html: string;
  /** Clean text content (main body only) */
  text: string;
  /** Internal links found on the page */
  internalLinks: string[];
  /** External links found on the page */
  externalLinks: string[];
  /** Existing JSON-LD structured data if present */
  jsonLd: object | null;
  /** Timestamp when page was fetched */
  fetchedAt: string;
  /** Depth from seed URL */
  depth: number;
  /** Response time in milliseconds */
  responseTimeMs: number;
  /** Content length in bytes */
  contentLength: number;
  /** Error message if fetch failed */
  error?: string;
}

/**
 * Page entry in the manifest (summary without full content).
 */
export interface PageManifestEntry {
  /** Normalized URL */
  url: string;
  /** URL hash for filename lookup */
  urlHash: string;
  /** HTTP status code */
  status: number;
  /** Classified page type */
  type: PageType;
  /** Page title */
  title: string;
  /** Timestamp when fetched */
  fetchedAt: string;
  /** Depth from seed URL */
  depth: number;
  /** Content length in bytes */
  contentLength: number;
}

/**
 * Error entry in the manifest.
 */
export interface ErrorEntry {
  /** URL that failed */
  url: string;
  /** Error message */
  error: string;
  /** Timestamp of the error */
  timestamp: string;
  /** HTTP status code if applicable */
  status?: number;
}

/**
 * Crawl statistics.
 */
export interface CrawlStats {
  /** Total pages requested */
  pagesRequested: number;
  /** Pages successfully fetched */
  pagesSuccessful: number;
  /** Pages that failed */
  pagesFailed: number;
  /** Total bytes downloaded */
  totalBytes: number;
  /** Average response time in ms */
  avgResponseTimeMs: number;
  /** Pages by type */
  pagesByType: Record<PageType, number>;
}

/**
 * Crawl manifest file structure.
 */
export interface CrawlManifest {
  /** Unique crawl identifier */
  crawlId: string;
  /** Initial seed URL */
  seedUrl: string;
  /** Domain being crawled */
  domain: string;
  /** ISO timestamp when crawl started */
  startedAt: string;
  /** ISO timestamp when crawl completed (null if in progress) */
  completedAt: string | null;
  /** Configuration used for this crawl */
  config: Required<Omit<SpiderConfig, "seedUrl">>;
  /** Crawl statistics */
  stats: CrawlStats;
  /** List of crawled pages */
  pages: PageManifestEntry[];
  /** List of errors encountered */
  errors: ErrorEntry[];
}

/**
 * State file for resume capability.
 */
export interface CrawlState {
  /** Crawl identifier */
  crawlId: string;
  /** URLs in the queue to crawl */
  queue: Array<{ url: string; depth: number }>;
  /** URLs already visited (normalized) */
  visited: string[];
  /** Current crawl stats */
  stats: CrawlStats;
  /** Timestamp of last state save */
  savedAt: string;
}

/**
 * Result returned when crawl completes.
 */
export interface CrawlResult {
  /** Whether crawl completed successfully */
  success: boolean;
  /** Path to the crawl output directory */
  outputPath: string;
  /** Path to the manifest file */
  manifestPath: string;
  /** Final crawl manifest */
  manifest: CrawlManifest;
  /** Error message if crawl failed */
  error?: string;
}

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: Required<Omit<SpiderConfig, "seedUrl">> = {
  maxPages: 50,
  maxDepth: 3,
  delayMs: 1000,
  includePatterns: [],
  excludePatterns: [
    "*.pdf",
    "*.jpg",
    "*.jpeg",
    "*.png",
    "*.gif",
    "*.svg",
    "*.webp",
    "*.ico",
    "*.mp3",
    "*.mp4",
    "*.webm",
    "*.avi",
    "*.mov",
    "*.zip",
    "*.tar",
    "*.gz",
    "*.rar",
    "*.exe",
    "*.dmg",
    "*.css",
    "*.js",
    "*.woff",
    "*.woff2",
    "*.ttf",
    "*.eot",
  ],
  respectRobotsTxt: true,
  followRedirects: true,
  outputDir: "./crawls",
  userAgent: "missing.link-spider/1.0 (+https://missing.link/spider)",
  timeout: 30000,
  useOxylabs: false,
};
