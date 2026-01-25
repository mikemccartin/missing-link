/**
 * missing.link Content Spider
 *
 * Web crawler for extracting content for AI processing.
 *
 * @example
 * ```typescript
 * import { Crawler, SpiderConfig } from '@/lib/spider';
 *
 * const config: SpiderConfig = {
 *   seedUrl: 'https://example.com',
 *   maxPages: 50,
 *   maxDepth: 3,
 * };
 *
 * const crawler = new Crawler(config);
 * const result = await crawler.crawl();
 * ```
 */

export * from "./types";
export { Crawler, listCrawls } from "./crawler";
export { ContentExtractor } from "./extractor";
export { RobotsParser } from "./robots";
