#!/usr/bin/env npx ts-node
/**
 * missing.link Crawl Processor
 *
 * Processes spider crawl output and generates draft content for human review.
 *
 * Usage:
 *   npm run process-crawl -- --crawl <path> [options]
 *
 * Options:
 *   --crawl <path>      Path to crawl directory (required)
 *   --entity <slug>     Primary entity slug (auto-detected from domain if not provided)
 *   --dry-run           Show what would be extracted without saving
 *   --help              Show this help message
 *
 * Examples:
 *   npm run process-crawl -- --crawl ./crawls/upbound.com/20260125_034546
 *   npm run process-crawl -- --crawl ./crawls/upbound.com/20260125_034546 --entity upbound
 *   npm run process-crawl -- --crawl ./crawls/upbound.com/20260125_034546 --dry-run
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { CrawlManifest, PageResult } from '../lib/spider/types';
import {
  ContentProcessor,
  createProcessor,
  DraftManifest,
  ExtractedContent,
  PageData,
  DraftEntity,
  DraftSource,
  DraftClaim,
} from '../lib/processor';

interface CliArgs {
  crawl?: string;
  entity?: string;
  dryRun?: boolean;
  help?: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--crawl':
      case '-c':
        args.crawl = next;
        i++;
        break;
      case '--entity':
      case '-e':
        args.entity = next;
        i++;
        break;
      case '--dry-run':
      case '-n':
        args.dryRun = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  return args;
}

function showHelp(): void {
  console.log(`
missing.link Crawl Processor
Processes spider output and generates draft content for human review.

USAGE:
  npm run process-crawl -- --crawl <path> [options]

OPTIONS:
  --crawl, -c <path>   Path to crawl directory (required)
  --entity, -e <slug>  Primary entity slug (auto-detected from domain if not provided)
  --dry-run, -n        Show what would be extracted without saving
  --help, -h           Show this help message

EXAMPLES:
  # Process a crawl
  npm run process-crawl -- --crawl ./crawls/upbound.com/20260125_034546

  # With explicit entity
  npm run process-crawl -- --crawl ./crawls/upbound.com/20260125_034546 --entity upbound

  # Dry run (no files created)
  npm run process-crawl -- --crawl ./crawls/upbound.com/20260125_034546 --dry-run

OUTPUT:
  drafts/
  └── [crawl-id]/
      ├── manifest.json
      ├── entities/
      │   └── [slug].json
      ├── sources/
      │   └── [id].json
      └── claims/
          └── [id].json
`);
}

/**
 * Load crawl manifest from directory.
 */
function loadManifest(crawlPath: string): CrawlManifest | null {
  const manifestPath = path.join(crawlPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`Error: Manifest not found at ${manifestPath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    return JSON.parse(content) as CrawlManifest;
  } catch (error) {
    console.error(`Error: Failed to parse manifest: ${error}`);
    return null;
  }
}

/**
 * Load a single page result from the crawl.
 */
function loadPageResult(crawlPath: string, urlHash: string): PageResult | null {
  const jsonPath = path.join(crawlPath, 'pages', `${urlHash}.json`);
  if (!fs.existsSync(jsonPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(content) as PageResult;
  } catch {
    return null;
  }
}

/**
 * Convert PageResult to PageData for processing.
 */
function pageResultToData(page: PageResult): PageData {
  return {
    url: page.url,
    type: page.type,
    title: page.metadata.title,
    text: page.text,
    metadata: page.metadata,
    jsonLd: page.jsonLd,
    depth: page.depth,
  };
}

/**
 * Generate entity slug from domain.
 */
function domainToSlug(domain: string): string {
  return domain
    .replace(/^www\./, '')
    .replace(/\.(com|org|net|io|co|ai)$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Save draft files to disk.
 */
function saveDrafts(
  outputDir: string,
  content: ExtractedContent,
  manifest: DraftManifest
): void {
  // Create directories
  const dirs = ['entities', 'sources', 'claims'];
  for (const dir of dirs) {
    const dirPath = path.join(outputDir, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  // Save entities
  for (const entity of content.entities) {
    const filePath = path.join(outputDir, 'entities', `${entity.slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify(entity, null, 2));
  }

  // Save sources
  for (const source of content.sources) {
    const filePath = path.join(outputDir, 'sources', `${source.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(source, null, 2));
  }

  // Save claims
  for (const claim of content.claims) {
    const filePath = path.join(outputDir, 'claims', `${claim.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(claim, null, 2));
  }

  // Save manifest
  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Main processing function.
 */
async function main(): Promise<void> {
  const args = parseArgs();

  // Show help
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Validate crawl path
  if (!args.crawl) {
    console.error('Error: --crawl is required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  // Resolve crawl path
  const crawlPath = path.resolve(args.crawl);
  if (!fs.existsSync(crawlPath)) {
    console.error(`Error: Crawl directory not found: ${crawlPath}`);
    process.exit(1);
  }

  // Load manifest
  console.log(`Loading crawl from ${crawlPath}...`);
  const crawlManifest = loadManifest(crawlPath);
  if (!crawlManifest) {
    process.exit(1);
  }

  console.log(`\nCrawl info:`);
  console.log(`  Domain: ${crawlManifest.domain}`);
  console.log(`  Crawled: ${crawlManifest.startedAt}`);
  console.log(`  Pages: ${crawlManifest.pages.length}`);

  // Determine primary entity
  const primaryEntity = args.entity || domainToSlug(crawlManifest.domain);
  console.log(`  Primary entity: ${primaryEntity}`);

  if (args.dryRun) {
    console.log(`\n[DRY RUN] Would process ${crawlManifest.pages.length} pages`);
  }

  // Filter pages to process (skip errors, empty content)
  const pagesToProcess = crawlManifest.pages.filter((p) => {
    // Skip failed pages
    if (p.status !== 200) return false;
    // Skip very small pages
    if (p.contentLength < 500) return false;
    // Skip legal pages
    if (p.type === 'legal') return false;
    return true;
  });

  console.log(`\nProcessing ${pagesToProcess.length} pages (${crawlManifest.pages.length - pagesToProcess.length} skipped)...`);

  // Initialize processor
  const processor = createProcessor();
  const results: ExtractedContent[] = [];
  const errors: Array<{ page: string; error: string; timestamp: string }> = [];
  let processedCount = 0;

  // Process each page
  for (const pageEntry of pagesToProcess) {
    const pageResult = loadPageResult(crawlPath, pageEntry.urlHash);
    if (!pageResult) {
      console.log(`  [SKIP] ${pageEntry.url} - Could not load page data`);
      continue;
    }

    // Skip pages with minimal text
    if (!pageResult.text || pageResult.text.trim().length < 100) {
      console.log(`  [SKIP] ${pageEntry.url} - Insufficient content`);
      continue;
    }

    processedCount++;
    const progress = `[${processedCount}/${pagesToProcess.length}]`;

    if (args.dryRun) {
      console.log(`  ${progress} Would process: ${pageEntry.url}`);
      continue;
    }

    console.log(`  ${progress} Processing: ${pageEntry.url}`);

    try {
      const pageData = pageResultToData(pageResult);
      const result = await processor.processPage(pageData, primaryEntity);

      if (result.success && result.content) {
        results.push(result.content);
        console.log(
          `    → Extracted: ${result.content.entities.length} entities, ` +
            `${result.content.claims.length} claims`
        );
      } else {
        console.log(`    → Skipped: ${result.error || 'No content extracted'}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`    → Error: ${errorMsg}`);
      errors.push({
        page: pageEntry.url,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      });
    }

    // Small delay between API calls
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (args.dryRun) {
    console.log(`\n[DRY RUN] Would have processed ${processedCount} pages`);
    console.log('No files were created.');
    process.exit(0);
  }

  // Merge all results
  console.log('\nMerging extracted content...');
  const merged = processor.mergeResults(results);

  console.log(`\nExtraction complete:`);
  console.log(`  Entities: ${merged.entities.length}`);
  console.log(`  Sources: ${merged.sources.length}`);
  console.log(`  Claims: ${merged.claims.length}`);
  console.log(`  Tokens used: ${processor.getTokensUsed()}`);

  // Count confidence levels
  const confidence = { high: 0, medium: 0, low: 0 };
  for (const entity of merged.entities) {
    confidence[entity._draft.confidence]++;
  }
  for (const claim of merged.claims) {
    confidence[claim._draft.confidence]++;
  }

  console.log(`\nConfidence breakdown:`);
  console.log(`  High: ${confidence.high}`);
  console.log(`  Medium: ${confidence.medium}`);
  console.log(`  Low: ${confidence.low}`);

  // Create output directory
  const crawlId = `${crawlManifest.domain}_${crawlManifest.crawlId}`;
  const outputDir = path.join(process.cwd(), 'drafts', crawlId);

  console.log(`\nSaving drafts to ${outputDir}...`);

  // Create draft manifest
  const draftManifest: DraftManifest = {
    crawlId: crawlManifest.crawlId,
    domain: crawlManifest.domain,
    processedAt: new Date().toISOString(),
    sourcePages: processedCount,
    primaryEntity,
    drafts: {
      entities: merged.entities.map((e) => e.slug),
      sources: merged.sources.map((s) => s.id),
      claims: merged.claims.map((c) => c.id),
    },
    confidence,
    stats: {
      totalPages: crawlManifest.pages.length,
      processedPages: processedCount,
      skippedPages: crawlManifest.pages.length - processedCount,
      apiCalls: processedCount,
      tokensUsed: processor.getTokensUsed(),
    },
    model: 'claude-sonnet-4-20250514',
    errors,
  };

  // Save everything
  saveDrafts(outputDir, merged, draftManifest);

  console.log('\nDone!');
  console.log(`\nNext steps:`);
  console.log(`  1. Review drafts in: ${outputDir}`);
  console.log(`  2. Edit JSON files as needed`);
  console.log(`  3. Delete unwanted drafts`);
  console.log(`  4. Run: npm run approve-drafts -- --crawl ${crawlId}`);
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
