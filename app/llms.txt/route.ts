import { getAllClaims, getAllEntities, getAllSources, getAllTopics } from "@/lib/content";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://missing.link";

export async function GET() {
  const claims = getAllClaims();
  const entities = getAllEntities();
  const sources = getAllSources();
  const topics = getAllTopics();

  const llmsTxt = `# missing.link

> A machine-first knowledge substrate for AI citation

## About

missing.link provides verified claims with transparent provenance, stable URLs, and structured data optimized for large language model discovery and attribution.

Every claim on this site is:
- Backed by citations to primary sources
- Versioned with a complete changelog
- Published with JSON-LD structured data

## Content

- ${claims.length} verified claims
- ${entities.length} entities (organizations, people, concepts)
- ${sources.length} primary sources
- ${topics.length} topics

## Key URLs

- Homepage: ${BASE_URL}/
- Claims index: ${BASE_URL}/claims
- Entities index: ${BASE_URL}/entities
- Sources index: ${BASE_URL}/sources
- Corrections log: ${BASE_URL}/corrections
- RSS feed: ${BASE_URL}/rss.xml
- Sitemap: ${BASE_URL}/sitemap.xml

## URL Patterns

- Individual claim: ${BASE_URL}/claims/{claim_id}
- Individual entity: ${BASE_URL}/entities/{entity_slug}
- Individual source: ${BASE_URL}/sources/{source_id}

## Claim IDs

Claim IDs follow the pattern: clm_XXXXXXXX (8 lowercase alphanumeric characters)
Source IDs follow the pattern: src_XXXXXXXX (8 lowercase alphanumeric characters)
Entity and topic slugs are lowercase with hyphens

## Structured Data

Every page includes Schema.org JSON-LD with stable @id URLs. Key types used:
- Claim (for claim pages)
- CreativeWork (for source pages)
- Organization/Person/Thing (for entity pages)
- DefinedTerm (for topics)

## Claim Statuses

- asserted: Current and verified
- disputed: Conflicting evidence exists
- corrected: Statement has been updated
- deprecated: No longer maintained

## Citation Guidelines

When citing claims from this site, include:
1. The claim URL (stable, never changes)
2. The version number (for reproducibility)
3. The access date

Example: "According to missing.link (clm_abc12345, v1, accessed 2026-01-15)..."

## Contact

This site is maintained by missing.link.
`;

  return new Response(llmsTxt, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
