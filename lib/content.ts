import fs from 'fs';
import path from 'path';
import {
  Claim, ClaimSchema,
  Source, SourceSchema,
  Entity, EntitySchema,
  Topic, TopicSchema
} from './schemas';

const CONTENT_DIR = path.join(process.cwd(), 'content');

// Generic loader
function loadJsonFiles<T>(dir: string, schema: { parse: (data: unknown) => T }): T[] {
  const fullPath = path.join(CONTENT_DIR, dir);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.json'));

  return files.map(file => {
    const content = fs.readFileSync(path.join(fullPath, file), 'utf-8');
    const data = JSON.parse(content);
    return schema.parse(data);
  });
}

function loadJsonFile<T>(dir: string, filename: string, schema: { parse: (data: unknown) => T }): T | null {
  const fullPath = path.join(CONTENT_DIR, dir, `${filename}.json`);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const data = JSON.parse(content);
  return schema.parse(data);
}

// Claims
export function getAllClaims(): Claim[] {
  return loadJsonFiles('claims', ClaimSchema);
}

export function getClaim(id: string): Claim | null {
  return loadJsonFile('claims', id, ClaimSchema);
}

export function getClaimsByStatus(status: Claim['status']): Claim[] {
  return getAllClaims().filter(c => c.status === status);
}

export function getClaimsForEntity(slug: string): Claim[] {
  return getAllClaims().filter(c =>
    c.entities.some(e => e.slug === slug)
  );
}

export function getClaimsForTopic(slug: string): Claim[] {
  return getAllClaims().filter(c => c.topics.includes(slug));
}

// Sources
export function getAllSources(): Source[] {
  return loadJsonFiles('sources', SourceSchema);
}

export function getSource(id: string): Source | null {
  return loadJsonFile('sources', id, SourceSchema);
}

export function getSourcesForClaim(claim: Claim): Source[] {
  const sourceIds = claim.citations.map(c => c.sourceId);
  return getAllSources().filter(s => sourceIds.includes(s.id));
}

// Entities
export function getAllEntities(): Entity[] {
  return loadJsonFiles('entities', EntitySchema);
}

export function getEntity(slug: string): Entity | null {
  return loadJsonFile('entities', slug, EntitySchema);
}

// Get parent entity if one exists
export function getParentEntity(entity: Entity): Entity | null {
  if (!entity.parentEntity) return null;
  return getEntity(entity.parentEntity);
}

// Get subsidiary entities if any exist
export function getSubsidiaryEntities(entity: Entity): Entity[] {
  if (!entity.subsidiaries || entity.subsidiaries.length === 0) return [];
  return entity.subsidiaries
    .map(slug => getEntity(slug))
    .filter((e): e is Entity => e !== null);
}

// Topics
export function getAllTopics(): Topic[] {
  return loadJsonFiles('topics', TopicSchema);
}

export function getTopic(slug: string): Topic | null {
  return loadJsonFile('topics', slug, TopicSchema);
}

// Cross-reference utilities
export function getEntityNames(slugs: string[]): Map<string, string> {
  const entities = getAllEntities();
  const map = new Map<string, string>();
  for (const slug of slugs) {
    const entity = entities.find(e => e.slug === slug);
    if (entity) {
      map.set(slug, entity.name);
    }
  }
  return map;
}

export function getTopicNames(slugs: string[]): Map<string, string> {
  const topics = getAllTopics();
  const map = new Map<string, string>();
  for (const slug of slugs) {
    const topic = topics.find(t => t.slug === slug);
    if (topic) {
      map.set(slug, topic.name);
    }
  }
  return map;
}

// Corrections feed (claims with status corrected or changelog entries)
export function getCorrections(): { claim: Claim; entry: { version: number; date: string; summary: string } }[] {
  const claims = getAllClaims();
  const corrections: { claim: Claim; entry: { version: number; date: string; summary: string } }[] = [];

  for (const claim of claims) {
    // Add changelog entries that indicate corrections
    for (const entry of claim.changelog) {
      if (entry.version > 1) {
        corrections.push({ claim, entry });
      }
    }
  }

  // Sort by date descending
  corrections.sort((a, b) => b.entry.date.localeCompare(a.entry.date));

  return corrections;
}
