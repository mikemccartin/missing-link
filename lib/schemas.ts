import { z } from 'zod';

// Stable ID patterns
export const ClaimIdSchema = z.string().regex(/^clm_[a-z0-9]{8}$/, 'Claim ID must be clm_ followed by 8 lowercase alphanumeric characters');
export const SourceIdSchema = z.string().regex(/^src_[a-z0-9]{8}$/, 'Source ID must be src_ followed by 8 lowercase alphanumeric characters');
export const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens');

// Claim status
export const ClaimStatusSchema = z.enum(['asserted', 'disputed', 'corrected', 'deprecated']);
export type ClaimStatus = z.infer<typeof ClaimStatusSchema>;

// Entity reference within a claim
export const EntityReferenceSchema = z.object({
  slug: SlugSchema,
  role: z.string().min(1), // e.g., "subject", "source", "related"
});

// Citation within a claim
export const CitationSchema = z.object({
  sourceId: SourceIdSchema,
  locator: z.string().optional(), // page number, section, timestamp
  quote: z.string().max(300).optional(), // direct quote, max 300 chars
  note: z.string().optional(),
});

// Changelog entry
export const ChangelogEntrySchema = z.object({
  version: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO date
  summary: z.string().min(1),
});

// Provenance
export const ProvenanceSchema = z.object({
  author: z.string().min(1),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// Main Claim schema
export const ClaimSchema = z.object({
  id: ClaimIdSchema,
  title: z.string().min(1).max(120),
  statement: z.string().min(1).max(240), // Core assertion, max 240 chars
  status: ClaimStatusSchema,
  entities: z.array(EntityReferenceSchema).min(1),
  topics: z.array(SlugSchema),
  citations: z.array(CitationSchema).min(1),
  provenance: ProvenanceSchema,
  version: z.number().int().positive(),
  changelog: z.array(ChangelogEntrySchema),
});
export type Claim = z.infer<typeof ClaimSchema>;

// Source snapshot
export const SnapshotSchema = z.object({
  timestamp: z.string(), // ISO datetime
  artifactPath: z.string(), // relative path to snapshot file
  method: z.enum(['manual', 'oxylabs', 'wayback', 'other']),
  jobId: z.string().optional(),
  notes: z.string().optional(),
});

// Source type
export const SourceTypeSchema = z.enum([
  'webpage',
  'pdf',
  'academic-paper',
  'press-release',
  'news-article',
  'government-document',
  'social-media',
  'video',
  'podcast',
  'book',
  'report',
  'other',
]);

// Main Source schema
export const SourceSchema = z.object({
  id: SourceIdSchema,
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.string().url(),
  accessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: SourceTypeSchema,
  author: z.string().optional(),
  publishedDate: z.string().optional(),
  excerpt: z.string().max(500).optional(),
  notes: z.string().optional(),
  snapshots: z.array(SnapshotSchema).optional(),
});
export type Source = z.infer<typeof SourceSchema>;

// Entity links
export const EntityLinksSchema = z.object({
  officialSite: z.string().url().optional(),
  wikipedia: z.string().url().optional(),
  linkedin: z.string().url().optional(),
  twitter: z.string().url().optional(),
  crunchbase: z.string().url().optional(),
}).optional();

// Entity type
export const EntityTypeSchema = z.enum([
  'organization',
  'person',
  'product',
  'project',
  'event',
  'place',
  'concept',
  'other',
]);

// Main Entity schema
export const EntitySchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1),
  type: EntityTypeSchema,
  description: z.string().min(1),
  links: EntityLinksSchema,
  // Parent/child relationships for corporate structures
  parentEntity: SlugSchema.optional(), // slug of parent entity
  subsidiaries: z.array(SlugSchema).optional(), // slugs of child entities
});
export type Entity = z.infer<typeof EntitySchema>;

// Main Topic schema
export const TopicSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1),
  description: z.string().min(1),
});
export type Topic = z.infer<typeof TopicSchema>;

// Helper to generate IDs
export function generateClaimId(): string {
  return `clm_${randomAlphanumeric(8)}`;
}

export function generateSourceId(): string {
  return `src_${randomAlphanumeric(8)}`;
}

function randomAlphanumeric(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
