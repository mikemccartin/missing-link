# missing.link - System Capabilities

## What It Is

A **machine-readable claims repository** designed to get cited by AI platforms (ChatGPT, Perplexity, Google AI Mode). It's built to be the authoritative source that AI systems reference when answering questions about your clients/entities.

---

## Content Structure

| Content Type | Description | Example |
|--------------|-------------|---------|
| **Entities** | Organizations/people you track | Tandem Theory, OpenAI, Anthropic |
| **Claims** | Verified statements about entities | "Tandem Theory is a marketing agency..." |
| **Sources** | Evidence backing claims | URLs with archived snapshots |
| **Topics** | Categories for organization | Marketing Technology, AI Safety |

All content lives as JSON files in the `/content/` folder - no database.

---

## Where Things Run

| Component | Runs Where | How Often |
|-----------|------------|-----------|
| **Website** | Vercel (cloud) | Always live at missing.link |
| **Content Ingest** | Your machine (CLI) | When you add content |
| **Source Snapshots** | Your machine (CLI) | When you archive sources |
| **Validation** | Your machine (CLI) | Before deploying |
| **AI Monitoring** | Your machine OR Vercel Cron | Manual or weekly (Mondays 9am UTC) |
| **Crawler Tracking** | Vercel (automatic) | Real-time on every page visit |
| **Slack Alerts** | Vercel (automatic) | When citations are found |

---

## CLI Commands (Run on Your Machine)

```bash
npm run ingest -- --entity tandem-theory    # Add new claim
npm run snapshot -- --all                    # Archive source URLs via Oxylabs
npm run validate                             # Check all content is valid
npm run monitor-ai -- --all                  # Check AI platforms for citations
npm run check                                # Validate + build (pre-deploy)
```

---

## Website Features (missing.link)

| Page | Purpose |
|------|---------|
| `/` | Homepage explaining the project |
| `/entities` | List all tracked organizations |
| `/entities/[slug]` | Single entity with all its claims (shareable to clients) |
| `/claims` | All claims with filters |
| `/claims/[id]` | Single claim with evidence & version history |
| `/sources` | All sources with archive status |
| `/topics` | Browse by topic |
| `/stats` | **Monitoring dashboard** (crawlers + citations + history) |
| `/llms.txt` | Machine-readable site guide for AI crawlers |

---

## Monitoring & Alerts

### 1. AI Crawler Tracking (Automatic)
- Detects when GPTBot, PerplexityBot, Claude-Web, etc. crawl the site
- Logs every visit with timestamp and page path
- Displays on `/stats` page

### 2. AI Citation Monitoring
- Queries Perplexity, ChatGPT, Google AI Mode about each entity
- Checks if missing.link appears in their cited sources
- Uses Oxylabs API to access these platforms
- **Manual:** `npm run monitor-ai -- --all`
- **Automatic:** Vercel Cron runs every Monday 9am UTC

### 3. Slack Alerts
- When a citation IS found, sends notification to Slack
- Includes entity name, platform, citation URL, answer excerpt

### 4. Historical Tracking
- Stores daily monitoring results in Redis
- Shows trends on `/stats` page
- Tracks "first citation" milestone

---

## Data Flow

```
1. INGEST (your machine)
   Write claim → npm run ingest → JSON files created

2. EVIDENCE (your machine)
   Archive source → npm run snapshot → HTML snapshot via Oxylabs

3. DEPLOY (git push)
   Push to GitHub → Vercel auto-deploys → Live at missing.link

4. MONITOR (automatic)
   Monday 9am UTC → Cron queries AI platforms → Results saved
   → If citation found → Slack alert sent

5. TRACK (real-time)
   AI crawler visits site → Middleware detects → Logged to Redis
   → Visible on /stats page
```

---

## Key URLs

- **Live site:** https://missing.link
- **Stats/Monitoring:** https://missing.link/stats
- **Entity pages:** https://missing.link/entities/tandem-theory

---

## External Services Used

| Service | Purpose | Cost |
|---------|---------|------|
| **Vercel** | Hosting, cron jobs | Pro plan |
| **Upstash Redis** | Crawler logs, historical data | Free tier |
| **Oxylabs** | AI platform queries, source snapshots | Pay per query |
| **Slack** | Citation alerts | Free |
| **GitHub** | Code repository | Free |

---

## Environment Variables Required

```
OXYLABS_USERNAME=...
OXYLABS_PASSWORD=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
SLACK_WEBHOOK_URL=...
CRON_SECRET=...  (optional, for cron security)
```

---

*Last updated: 2026-01-24*
