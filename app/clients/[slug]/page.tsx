import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAllEntities,
  getEntity,
  getClaimsForEntity,
  getAllSources,
} from "@/lib/content";
import { entityToJsonLd, jsonLdScript } from "@/lib/jsonld";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const entities = getAllEntities();
  return entities.map((entity) => ({ slug: entity.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entity = getEntity(slug);
  if (!entity) {
    return { title: "Not Found" };
  }
  return {
    title: entity.name,
    description: `Claims and sources for ${entity.name}`,
  };
}

export default async function ClientPage({ params }: Props) {
  const { slug } = await params;
  const entity = getEntity(slug);

  if (!entity) {
    notFound();
  }

  const claims = getClaimsForEntity(slug);
  const sources = getAllSources();
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  // Sort claims by status (asserted first) then by date
  const sortedClaims = [...claims].sort((a, b) => {
    if (a.status !== b.status) {
      const statusOrder = { asserted: 0, disputed: 1, corrected: 2, deprecated: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return b.provenance.updatedAt.localeCompare(a.provenance.updatedAt);
  });

  // Get unique sources used across all claims
  const usedSourceIds = new Set<string>();
  for (const claim of claims) {
    for (const citation of claim.citations) {
      usedSourceIds.add(citation.sourceId);
    }
  }
  const usedSources = Array.from(usedSourceIds)
    .map((id) => sourceMap.get(id))
    .filter(Boolean);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(entityToJsonLd(entity)),
        }}
      />
      <main>
        <header className="client-header">
          <div className="meta">{entity.type}</div>
          <h1>{entity.name}</h1>
          <p>{entity.description}</p>

          {entity.links?.officialSite && (
            <p>
              <a href={entity.links.officialSite} target="_blank" rel="noopener noreferrer">
                {entity.links.officialSite.replace(/^https?:\/\//, '')}
              </a>
            </p>
          )}
        </header>

        <section>
          <h2>Published Claims ({claims.length})</h2>
          <p className="meta">
            Verified statements with sources and version history
          </p>

          {sortedClaims.length === 0 ? (
            <p>No claims published yet.</p>
          ) : (
            sortedClaims.map((claim) => (
              <article key={claim.id} className="claim-item">
                <div className="meta">
                  <span className={`status status-${claim.status}`}>
                    {claim.status}
                  </span>
                  {" · "}
                  <span>Version {claim.version}</span>
                  {" · "}
                  <span>Updated {claim.provenance.updatedAt}</span>
                </div>
                <h3>{claim.title}</h3>
                <p>{claim.statement}</p>

                {/* Show citations */}
                <div className="meta">
                  Evidence:{" "}
                  {claim.citations.map((citation, i) => {
                    const source = sourceMap.get(citation.sourceId);
                    return (
                      <span key={citation.sourceId}>
                        {i > 0 && ", "}
                        {source?.url ? (
                          <a href={source.url} target="_blank" rel="noopener noreferrer">
                            {source.title || source.publisher}
                          </a>
                        ) : (
                          source?.title || citation.sourceId
                        )}
                      </span>
                    );
                  })}
                </div>

                {/* Show quotes if available */}
                {claim.citations.some((c) => c.quote) && (
                  <blockquote className="meta">
                    {claim.citations
                      .filter((c) => c.quote)
                      .map((c, i) => (
                        <p key={i}>"{c.quote}"</p>
                      ))}
                  </blockquote>
                )}
              </article>
            ))
          )}
        </section>

        <section>
          <h2>Sources ({usedSources.length})</h2>
          <p className="meta">Primary documents cited as evidence</p>
          <ul>
            {usedSources.map((source) => (
              <li key={source!.id}>
                <a href={source!.url} target="_blank" rel="noopener noreferrer">
                  {source!.title}
                </a>
                <span className="meta"> — {source!.publisher}, accessed {source!.accessDate}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="meta">
          <h2>About this page</h2>
          <p>
            This page is generated by <a href="https://missing.link">missing.link</a>,
            a knowledge substrate designed to make verified claims discoverable and
            citable by AI platforms.
          </p>
          <p>
            All claims include version history, explicit provenance, and links to
            primary sources. Claims can be corrected or updated without erasing history.
          </p>
          <p>
            <a href={`https://missing.link/entities/${slug}`}>
              View full entity page →
            </a>
          </p>
        </section>
      </main>
    </>
  );
}
