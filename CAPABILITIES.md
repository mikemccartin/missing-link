# missing.link - System Capabilities

## What It Is

A **machine-readable claims repository** designed to get cited by AI platforms (ChatGPT, Perplexity, Google AI Mode). It's built to be the authoritative source that AI systems reference when answering questions about your clients/entities.

---

## The Feedback Loop

missing.link operates as a continuous cycle:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   1. FIND CONTENT                                           │
│      Identify claims to make about an entity                │
│      (manual today, can be automated)                       │
│                         ↓                                   │
│   2. UPLOAD CONTENT                                         │
│      Deconstruct into claims, sources, entities             │
│      Deploy to missing.link                                 │
│      (manual today, can be automated)                       │
│                         ↓                                   │
│   3. MONITOR BOT VISITS                                     │
│      Track when AI crawlers discover the content            │
│      (automatic - real-time)                                │
│                         ↓                                   │
│   4. MONITOR AI CITATIONS                                   │
│      Check if AI platforms cite missing.link                │
│      when answering questions about entities                │
│      (automatic - weekly + Slack alerts)                    │
│                         ↓                                   │
│   5. REPEAT                                                 │
│      Add more content, improve coverage                     │
│      ↑                                                      │
└──────────────────────────────────────────────────────────────┘
```

**Steps 1-2 are manual today.** Steps 3-4 are fully automated.

---

## How Content Gets Added (Current Process)

Content is added through **Claude Code sessions**. There is no web UI or form.

### The Manual Workflow

1. **You start a Claude Code session** and say:
   > "I want to add content about Tandem Theory's services"

2. **Claude visits the source** (e.g., tandemtheory.com/services)

3. **Claude deconstructs the content** into atomic claims:
   - "Tandem Theory offers brand strategy services"
   - "Tandem Theory offers media planning and buying"
   - "Tandem Theory offers CRM and loyalty programs"

4. **Claude creates the JSON files:**
   ```
   content/sources/src_tt000002.json   ← source URL + metadata
   content/claims/clm_tt000010.json    ← claim #1
   content/claims/clm_tt000011.json    ← claim #2
   content/claims/clm_tt000012.json    ← claim #3
   ```

5. **Claude validates and deploys:**
   ```bash
   npm run validate   # check everything is valid
   git push           # deploy to Vercel
   ```

6. **Content is live** at missing.link within minutes

### Adding a New Entity (Initial Load)

When a new entity is added for the first time:

1. **You provide the entity** (name, website, basic info)
2. **Claude visits their website** and reviews key pages (about, services, team, etc.)
3. **Claude creates an initial content load:**
   - Entity record with description and links
   - Multiple claims covering key facts
   - Source records for each page referenced
4. **Everything deploys together** as a complete entity profile

This "initial load" gives the entity immediate presence on missing.link with multiple citable claims.

---

## Future Automation Possibilities

The manual content process could be automated:

| Feature | Description | Status |
|---------|-------------|--------|
| **Web scraper** | Auto-extract claims from client websites | Not built |
| **AI-assisted ingest** | Feed a URL, get draft claims | Not built |
| **Google Sheets import** | Bulk import from spreadsheet | Not built |
| **CMS/Admin UI** | Web interface instead of CLI | Not built |
| **Scheduled re-scrape** | Periodically check for new content | Not built |

For now, the Claude Code session approach works and ensures quality control.

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
| **Content Ingest** | Claude Code session | When you add content |
| **Source Snapshots** | Claude Code session | When you archive sources |
| **Validation** | Claude Code session | Before deploying |
| **AI Monitoring** | Vercel Cron (automatic) | Weekly (Mondays 9am UTC) |
| **Crawler Tracking** | Vercel (automatic) | Real-time on every page visit |
| **Slack Alerts** | Vercel (automatic) | When citations are found |

---

## CLI Commands (Available in Claude Code Sessions)

```bash
npm run ingest -- --entity tandem-theory    # Add new claim (interactive)
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

### 2. AI Citation Monitoring (Automatic)
- Queries Perplexity, ChatGPT, Google AI Mode about each entity
- Checks if missing.link appears in their cited sources
- Uses Oxylabs API to access these platforms
- Runs automatically every Monday 9am UTC via Vercel Cron
- Can also run manually: `npm run monitor-ai -- --all`

### 3. Slack Alerts (Automatic)
- When a citation IS found, sends notification to Slack
- Includes entity name, platform, citation URL, answer excerpt

### 4. Historical Tracking (Automatic)
- Stores daily monitoring results in Redis
- Shows trends on `/stats` page
- Tracks "first citation" milestone

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
