# missing.link

A machine-first knowledge substrate for AI citation.

**Live site:** https://missing.link

## What is this?

missing.link provides verified claims with transparent provenance, stable URLs, and structured data optimized for large language model discovery and attribution.

Every claim is:
- Backed by citations to primary sources
- Versioned with a complete changelog
- Published with JSON-LD structured data

## Quick Start

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Validate content
npm run validate

# Build for production
npm run build
```

## Adding Content

### Add an Entity

Create a JSON file in `content/entities/`:

```json
{
  "slug": "company-name",
  "name": "Company Name",
  "type": "organization",
  "description": "Brief description of the entity.",
  "links": {
    "officialSite": "https://example.com",
    "linkedin": "https://linkedin.com/company/..."
  }
}
```

**Entity types:** `organization`, `person`, `product`, `project`, `event`, `place`, `concept`, `other`

### Add a Source

Create a JSON file in `content/sources/`:

```json
{
  "id": "src_xxxxxxxx",
  "title": "Page Title",
  "publisher": "Publisher Name",
  "url": "https://example.com/page",
  "accessDate": "2026-01-24",
  "type": "webpage"
}
```

**Source types:** `webpage`, `pdf`, `academic-paper`, `press-release`, `news-article`, `government-document`, `social-media`, `video`, `podcast`, `book`, `report`, `other`

### Add a Claim

Create a JSON file in `content/claims/`:

```json
{
  "id": "clm_xxxxxxxx",
  "title": "Claim Title",
  "statement": "The verifiable statement (max 240 characters).",
  "status": "asserted",
  "entities": [
    { "slug": "entity-slug", "role": "subject" }
  ],
  "topics": ["topic-slug"],
  "citations": [
    {
      "sourceId": "src_xxxxxxxx",
      "locator": "Section or page",
      "quote": "Direct quote from source (max 300 chars)"
    }
  ],
  "provenance": {
    "author": "missing.link",
    "createdAt": "2026-01-24",
    "updatedAt": "2026-01-24"
  },
  "version": 1,
  "changelog": [
    {
      "version": 1,
      "date": "2026-01-24",
      "summary": "Initial claim"
    }
  ]
}
```

**Claim statuses:** `asserted`, `disputed`, `corrected`, `deprecated`

### Add a Topic

Create a JSON file in `content/topics/`:

```json
{
  "slug": "topic-name",
  "name": "Topic Name",
  "description": "Description of what this topic covers."
}
```

## CLI Scripts

### Validate Content

```bash
npm run validate
```

Checks all JSON files against Zod schemas and validates cross-references.

### Ingest New Claim

```bash
npm run ingest -- --entity tandem-theory --topic marketing-technology
```

Interactive script to create claim + source from simple markdown input.

### Snapshot Sources (Oxylabs)

```bash
# Snapshot specific source
npm run snapshot -- src_abc12345

# Snapshot all sources
npm run snapshot -- --all
```

Requires `OXYLABS_USERNAME` and `OXYLABS_PASSWORD` environment variables.

## ID Formats

- **Claim ID:** `clm_` + 8 lowercase alphanumeric characters
- **Source ID:** `src_` + 8 lowercase alphanumeric characters
- **Entity/Topic slugs:** lowercase with hyphens (e.g., `tandem-theory`)

## URL Structure

| Route | Purpose |
|-------|---------|
| `/` | Home page |
| `/entities` | Entity index |
| `/entities/[slug]` | Individual entity |
| `/claims` | Claim index |
| `/claims/[id]` | Individual claim |
| `/topics` | Topic index |
| `/topics/[slug]` | Individual topic |
| `/sources` | Source index |
| `/sources/[id]` | Individual source |
| `/corrections` | Correction log |
| `/stats` | AI crawler activity |

## Machine Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/llms.txt` | Machine-readable site description |
| `/robots.txt` | Crawler directives |
| `/sitemap.xml` | Sitemap index |
| `/rss.xml` | Claim RSS feed |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_BASE_URL` | Site URL (default: https://missing.link) |
| `UPSTASH_REDIS_REST_URL` | Redis for crawler tracking |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token |
| `OXYLABS_USERNAME` | Oxylabs API username |
| `OXYLABS_PASSWORD` | Oxylabs API password |

## Deployment

The site auto-deploys to Vercel on push to `main`.

1. Push changes to GitHub
2. Vercel builds and deploys automatically
3. Site updates at https://missing.link

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Validation:** Zod
- **Storage:** JSON files in `/content`
- **Crawler tracking:** Upstash Redis
- **Hosting:** Vercel

## License

Proprietary - Tandem Theory
