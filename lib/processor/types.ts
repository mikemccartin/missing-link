/**
 * missing.link AI Processor - Type Definitions
 *
 * Types for the AI-powered content extraction and draft generation system.
 */

import { Entity, Source, Claim, ClaimStatus, SourceTypeSchema } from '../schemas';
import { PageResult, PageMetadata, CrawlManifest } from '../spider/types';

/**
 * Processing configuration options.
 */
export interface ProcessingConfig {
  /** Path to the crawl directory */
  crawlPath: string;
  /** Primary entity slug (auto-detected from domain if not provided) */
  primaryEntitySlug?: string;
  /** Dry run - show what would be extracted without saving */
  dryRun?: boolean;
  /** Maximum tokens for Claude API responses */
  maxTokens?: number;
  /** Entity types to extract (default: all) */
  extractEntities?: boolean;
  /** Source types to extract (default: all) */
  extractSources?: boolean;
  /** Claims to extract (default: all) */
  extractClaims?: boolean;
}

/**
 * Confidence level for extracted content.
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Draft metadata added to all extracted content.
 */
export interface DraftMetadata {
  /** Extraction confidence level */
  confidence: ConfidenceLevel;
  /** URLs this was extracted from */
  sourcePages: string[];
  /** Optional notes about extraction quality or concerns */
  notes?: string;
  /** Claude model used for extraction */
  model?: string;
  /** Timestamp of extraction */
  extractedAt: string;
}

/**
 * Draft entity extends base entity with draft metadata.
 */
export interface DraftEntity extends Entity {
  _draft: DraftMetadata;
}

/**
 * Draft source extends base source with draft metadata.
 */
export interface DraftSource extends Omit<Source, 'snapshots'> {
  _draft: DraftMetadata;
}

/**
 * Draft claim extends base claim with draft metadata.
 */
export interface DraftClaim extends Claim {
  _draft: DraftMetadata;
}

/**
 * Extracted content from a single page or set of pages.
 */
export interface ExtractedContent {
  entities: DraftEntity[];
  sources: DraftSource[];
  claims: DraftClaim[];
}

/**
 * Draft manifest tracking what was extracted from a crawl.
 */
export interface DraftManifest {
  /** Crawl ID this was processed from */
  crawlId: string;
  /** Domain that was crawled */
  domain: string;
  /** Timestamp when processing completed */
  processedAt: string;
  /** Number of source pages processed */
  sourcePages: number;
  /** Primary entity for this crawl */
  primaryEntity?: string;
  /** Draft counts */
  drafts: {
    /** Entity slugs */
    entities: string[];
    /** Source IDs */
    sources: string[];
    /** Claim IDs */
    claims: string[];
  };
  /** Confidence breakdown */
  confidence: {
    high: number;
    medium: number;
    low: number;
  };
  /** Processing statistics */
  stats: {
    /** Total pages in crawl */
    totalPages: number;
    /** Pages successfully processed */
    processedPages: number;
    /** Pages skipped (errors, non-content, etc.) */
    skippedPages: number;
    /** Total API calls made */
    apiCalls: number;
    /** Total tokens used */
    tokensUsed: number;
  };
  /** Claude model used */
  model: string;
  /** Any errors encountered */
  errors: Array<{
    page: string;
    error: string;
    timestamp: string;
  }>;
}

/**
 * Page data prepared for AI processing.
 */
export interface PageData {
  /** Page URL */
  url: string;
  /** Page type classification */
  type: string;
  /** Page title */
  title: string;
  /** Clean text content */
  text: string;
  /** Page metadata */
  metadata: PageMetadata;
  /** Any existing JSON-LD data */
  jsonLd: object | null;
  /** Depth from seed URL */
  depth: number;
}

/**
 * Result from Claude API extraction.
 */
export interface ExtractionResult {
  success: boolean;
  content?: ExtractedContent;
  error?: string;
  tokensUsed?: number;
}

/**
 * Approval result for a single draft file.
 */
export interface ApprovalResult {
  path: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Batch approval results.
 */
export interface ApprovalBatchResult {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  results: ApprovalResult[];
  approved: boolean;
}

/**
 * Processing progress callback.
 */
export type ProgressCallback = (current: number, total: number, message: string) => void;

/**
 * Default processing configuration.
 */
export const DEFAULT_PROCESSING_CONFIG: Required<Omit<ProcessingConfig, 'crawlPath' | 'primaryEntitySlug'>> = {
  dryRun: false,
  maxTokens: 4096,
  extractEntities: true,
  extractSources: true,
  extractClaims: true,
};
