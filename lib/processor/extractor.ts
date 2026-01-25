/**
 * missing.link AI Processor - Content Extractor
 *
 * Uses Claude API to extract entities, sources, and claims from crawled content.
 */

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  generateClaimId,
  generateSourceId,
  SlugSchema,
  EntityTypeSchema,
  SourceTypeSchema,
  ClaimStatusSchema,
} from '../schemas';
import {
  DraftEntity,
  DraftSource,
  DraftClaim,
  DraftMetadata,
  ExtractedContent,
  ExtractionResult,
  PageData,
  ConfidenceLevel,
} from './types';

// Claude API model to use
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

/**
 * Schema for entity extraction response.
 */
const ExtractedEntitySchema = z.object({
  name: z.string(),
  type: z.enum(['organization', 'person', 'product', 'project', 'event', 'place', 'concept', 'other']),
  description: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  officialSite: z.string().optional(),
  parentEntity: z.string().optional(),
});

/**
 * Schema for source extraction response.
 */
const ExtractedSourceSchema = z.object({
  title: z.string(),
  publisher: z.string(),
  type: z.enum(['webpage', 'pdf', 'academic-paper', 'press-release', 'news-article', 'government-document', 'social-media', 'video', 'podcast', 'book', 'report', 'other']),
  author: z.string().optional(),
  publishedDate: z.string().optional(),
  excerpt: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
});

/**
 * Schema for claim extraction response.
 */
const ExtractedClaimSchema = z.object({
  title: z.string().max(120),
  statement: z.string().max(240),
  quote: z.string().max(300).optional(),
  entityRole: z.string(),
  relatedEntities: z.array(z.string()).optional(),
  confidence: z.enum(['high', 'medium', 'low']),
});

/**
 * Full extraction response schema.
 */
const ExtractionResponseSchema = z.object({
  entities: z.array(ExtractedEntitySchema),
  claims: z.array(ExtractedClaimSchema),
  sourceInfo: ExtractedSourceSchema,
});

type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;

/**
 * Generate a URL-safe slug from a name.
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * Get current date in YYYY-MM-DD format.
 */
function getCurrentDate(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * ContentProcessor class for extracting content using Claude API.
 */
export class ContentProcessor {
  private client: Anthropic;
  private tokensUsed: number = 0;

  constructor() {
    this.client = new Anthropic();
  }

  /**
   * Get total tokens used across all API calls.
   */
  getTokensUsed(): number {
    return this.tokensUsed;
  }

  /**
   * Reset token counter.
   */
  resetTokens(): void {
    this.tokensUsed = 0;
  }

  /**
   * Process a single page and extract content.
   */
  async processPage(page: PageData, primaryEntity?: string): Promise<ExtractionResult> {
    // Skip pages with minimal content
    if (!page.text || page.text.trim().length < 100) {
      return {
        success: false,
        error: 'Page has insufficient text content',
      };
    }

    try {
      const response = await this.callClaude(page, primaryEntity);

      if (!response) {
        return {
          success: false,
          error: 'No response from Claude API',
        };
      }

      const content = this.transformResponse(response, page, primaryEntity);

      return {
        success: true,
        content,
        tokensUsed: this.tokensUsed,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Call Claude API for content extraction.
   */
  private async callClaude(page: PageData, primaryEntity?: string): Promise<ExtractionResponse | null> {
    const prompt = this.buildExtractionPrompt(page, primaryEntity);

    try {
      const response = await this.client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Track token usage
      if (response.usage) {
        this.tokensUsed += response.usage.input_tokens + response.usage.output_tokens;
      }

      // Extract text content from response
      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        return null;
      }

      // Parse JSON from response
      const jsonMatch = textContent.text.match(/```json\n?([\s\S]*?)\n?```/);
      if (!jsonMatch) {
        // Try parsing the entire response as JSON
        try {
          const parsed = JSON.parse(textContent.text);
          return ExtractionResponseSchema.parse(parsed);
        } catch {
          console.error('Failed to parse JSON from response:', textContent.text.substring(0, 200));
          return null;
        }
      }

      const parsed = JSON.parse(jsonMatch[1]);
      return ExtractionResponseSchema.parse(parsed);
    } catch (error) {
      console.error('Claude API error:', error);
      throw error;
    }
  }

  /**
   * Build the extraction prompt for Claude.
   */
  private buildExtractionPrompt(page: PageData, primaryEntity?: string): string {
    const entityContext = primaryEntity
      ? `The primary entity being researched is "${primaryEntity}". Focus on extracting claims related to this entity.`
      : 'Extract information about all entities mentioned on this page.';

    return `You are a fact extraction system for missing.link, a knowledge substrate for AI citation.

Your task is to extract factual, verifiable claims from the following webpage content.

${entityContext}

PAGE INFORMATION:
- URL: ${page.url}
- Title: ${page.title}
- Page Type: ${page.type}
- Description: ${page.metadata.description || 'Not provided'}

PAGE CONTENT:
${page.text.substring(0, 8000)}

EXTRACTION INSTRUCTIONS:

1. ENTITIES: Extract organizations, people, products mentioned. Include:
   - name: Official name
   - type: organization, person, product, project, event, place, concept, or other
   - description: 1-2 sentence neutral description
   - confidence: high (explicitly stated), medium (implied/inferred), low (uncertain)
   - officialSite: URL if this is their official website
   - parentEntity: slug of parent company if mentioned (e.g., "upbound" for Rent-A-Center)

2. CLAIMS: Extract verifiable factual statements. Each claim should:
   - title: Brief title (max 120 chars)
   - statement: The factual assertion (max 240 chars)
   - quote: Supporting quote from the text (max 300 chars) if available
   - entityRole: "subject" if about the primary entity, "related" otherwise
   - relatedEntities: Array of other entity names involved
   - confidence: high (direct quote/explicit), medium (clearly implied), low (requires inference)

3. SOURCE INFO: Information about this webpage as a source:
   - title: Page title
   - publisher: Organization that published this
   - type: webpage, press-release, news-article, etc.
   - author: If identifiable
   - publishedDate: If available (YYYY-MM-DD format)
   - excerpt: Brief description of what this page covers
   - confidence: high (official/authoritative), medium (secondary), low (user-generated)

IMPORTANT:
- Only extract FACTUAL claims that can be verified
- Do NOT include opinions, predictions, or marketing fluff
- Each claim should stand alone as a verifiable statement
- Prefer specific facts over general descriptions
- If the page is navigation-only, legal boilerplate, or has no substantive content, return empty arrays

Return your response as JSON in this exact format:

\`\`\`json
{
  "entities": [...],
  "claims": [...],
  "sourceInfo": {...}
}
\`\`\``;
  }

  /**
   * Transform Claude's response into draft content.
   */
  private transformResponse(
    response: ExtractionResponse,
    page: PageData,
    primaryEntity?: string
  ): ExtractedContent {
    const now = new Date().toISOString();
    const today = getCurrentDate();

    // Create draft metadata
    const createMetadata = (confidence: ConfidenceLevel): DraftMetadata => ({
      confidence,
      sourcePages: [page.url],
      extractedAt: now,
      model: CLAUDE_MODEL,
    });

    // Transform entities
    const entities: DraftEntity[] = response.entities.map((e) => ({
      slug: generateSlug(e.name),
      name: e.name,
      type: e.type,
      description: e.description,
      links: e.officialSite ? { officialSite: e.officialSite } : undefined,
      parentEntity: e.parentEntity ? generateSlug(e.parentEntity) : undefined,
      _draft: createMetadata(e.confidence),
    }));

    // Create source from page
    const sourceId = generateSourceId();
    const source: DraftSource = {
      id: sourceId,
      title: response.sourceInfo.title || page.title,
      publisher: response.sourceInfo.publisher || new URL(page.url).hostname,
      url: page.url,
      accessDate: today,
      type: response.sourceInfo.type,
      author: response.sourceInfo.author,
      publishedDate: response.sourceInfo.publishedDate,
      excerpt: response.sourceInfo.excerpt,
      _draft: createMetadata(response.sourceInfo.confidence),
    };

    // Transform claims
    const claims: DraftClaim[] = response.claims.map((c) => {
      // Find the primary entity slug
      const primarySlug = primaryEntity
        ? generateSlug(primaryEntity)
        : entities[0]?.slug || 'unknown';

      // Build entity references
      const entityRefs = [
        { slug: primarySlug, role: c.entityRole || 'subject' },
      ];

      // Add related entities
      if (c.relatedEntities) {
        c.relatedEntities.forEach((name) => {
          const slug = generateSlug(name);
          if (slug !== primarySlug) {
            entityRefs.push({ slug, role: 'related' });
          }
        });
      }

      return {
        id: generateClaimId(),
        title: c.title,
        statement: c.statement,
        status: 'asserted' as const,
        entities: entityRefs,
        topics: [], // Will be added during review
        citations: [
          {
            sourceId,
            quote: c.quote,
          },
        ],
        provenance: {
          author: 'missing.link-spider',
          createdAt: today,
          updatedAt: today,
        },
        version: 1,
        changelog: [
          {
            version: 1,
            date: today,
            summary: `Auto-extracted from ${new URL(page.url).hostname} crawl`,
          },
        ],
        _draft: createMetadata(c.confidence),
      };
    });

    return {
      entities,
      sources: [source],
      claims,
    };
  }

  /**
   * Merge multiple extraction results, deduplicating entities.
   */
  mergeResults(results: ExtractedContent[]): ExtractedContent {
    const entityMap = new Map<string, DraftEntity>();
    const sourceMap = new Map<string, DraftSource>();
    const allClaims: DraftClaim[] = [];

    for (const result of results) {
      // Merge entities (dedupe by slug)
      for (const entity of result.entities) {
        const existing = entityMap.get(entity.slug);
        if (!existing) {
          entityMap.set(entity.slug, entity);
        } else {
          // Merge source pages and keep higher confidence
          const confidence = this.higherConfidence(existing._draft.confidence, entity._draft.confidence);
          entityMap.set(entity.slug, {
            ...existing,
            _draft: {
              ...existing._draft,
              confidence,
              sourcePages: [...new Set([...existing._draft.sourcePages, ...entity._draft.sourcePages])],
            },
          });
        }
      }

      // Merge sources (dedupe by URL)
      for (const source of result.sources) {
        if (!sourceMap.has(source.url)) {
          sourceMap.set(source.url, source);
        }
      }

      // Add all claims (no deduplication - human will review)
      allClaims.push(...result.claims);
    }

    return {
      entities: Array.from(entityMap.values()),
      sources: Array.from(sourceMap.values()),
      claims: allClaims,
    };
  }

  /**
   * Compare confidence levels and return the higher one.
   */
  private higherConfidence(a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel {
    const order: ConfidenceLevel[] = ['low', 'medium', 'high'];
    return order.indexOf(a) >= order.indexOf(b) ? a : b;
  }
}

/**
 * Create a new ContentProcessor instance.
 */
export function createProcessor(): ContentProcessor {
  return new ContentProcessor();
}
