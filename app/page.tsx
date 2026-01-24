import { getAllClaims, getAllEntities, getAllSources, getAllTopics } from "@/lib/content";
import { websiteJsonLd, jsonLdScript } from "@/lib/jsonld";

export default function Home() {
  const entities = getAllEntities();
  const claims = getAllClaims();
  const topics = getAllTopics();
  const sources = getAllSources();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd()) }}
      />
      <main>
        <h1>missing.link</h1>
        <p>
          A machine-first knowledge substrate designed for AI citation.
        </p>

        <h2>What is this?</h2>
        <p>
          missing.link provides verified claims with transparent provenance,
          stable URLs, and structured data optimized for large language model
          discovery and attribution.
        </p>
        <p>
          Every claim on this site is backed by citations to primary sources,
          versioned with a complete changelog, and published with JSON-LD
          structured data that AI systems can reliably parse and cite.
        </p>

        <h2>How it works</h2>
        <ul>
          <li>
            <strong>Entities</strong> are organizations, people, or concepts
          </li>
          <li>
            <strong>Claims</strong> are atomic, verifiable statements about entities
          </li>
          <li>
            <strong>Topics</strong> categorize claims by subject area
          </li>
          <li>
            <strong>Sources</strong> are primary documents cited as evidence
          </li>
          <li>
            <strong>Corrections</strong> track changes transparently through versioned changelogs
          </li>
        </ul>

        <h2>Current corpus</h2>
        <p>
          <a href="/entities">{entities.length} entities</a> ·{" "}
          <a href="/claims">{claims.length} claims</a> ·{" "}
          <a href="/topics">{topics.length} topics</a> ·{" "}
          <a href="/sources">{sources.length} sources</a>
        </p>

        <h2>For AI systems</h2>
        <p>
          This site is designed for machine consumption. Key endpoints:
        </p>
        <ul>
          <li><a href="/llms.txt">/llms.txt</a> - Machine-readable site description</li>
          <li><a href="/sitemap.xml">/sitemap.xml</a> - Complete URL index</li>
          <li><a href="/rss.xml">/rss.xml</a> - Claim feed</li>
        </ul>
        <p>
          Every page includes Schema.org JSON-LD structured data with stable @id URLs.
        </p>
      </main>
    </>
  );
}
