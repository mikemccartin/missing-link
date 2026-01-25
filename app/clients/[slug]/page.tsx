import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAllEntities,
  getEntity,
  getClaimsForEntity,
  getAllSources,
  getAllTopics,
  getParentEntity,
  getSubsidiaryEntities,
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
    title: `${entity.name} Dashboard`,
    description: `Claims, sources, and coverage for ${entity.name}`,
  };
}

export default async function ClientDashboard({ params }: Props) {
  const { slug } = await params;
  const entity = getEntity(slug);

  if (!entity) {
    notFound();
  }

  const claims = getClaimsForEntity(slug);
  const sources = getAllSources();
  const allTopics = getAllTopics();
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  // Get parent/subsidiary relationships
  const parentEntity = getParentEntity(entity);
  const subsidiaries = getSubsidiaryEntities(entity);

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

  // Get unique topics used across all claims
  const usedTopicSlugs = new Set<string>();
  for (const claim of claims) {
    for (const topicSlug of claim.topics) {
      usedTopicSlugs.add(topicSlug);
    }
  }
  const usedTopics = allTopics.filter((t) => usedTopicSlugs.has(t.slug));

  // Separate claims by status
  const assertedClaims = sortedClaims.filter((c) => c.status === "asserted");
  const corrections = sortedClaims.filter((c) => c.status !== "asserted");

  // Calculate stats
  const stats = {
    totalClaims: claims.length,
    asserted: assertedClaims.length,
    corrections: corrections.length,
    topics: usedTopics.length,
    sources: usedSources.length,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(entityToJsonLd(entity, parentEntity ?? undefined, subsidiaries)),
        }}
      />
      <main>
        {/* Header */}
        <header className="client-header">
          <div className="meta">{entity.type}</div>
          <h1>{entity.name}</h1>
          <p>{entity.description}</p>

          {parentEntity && (
            <p className="meta">
              Parent: <a href={`/clients/${parentEntity.slug}`}>{parentEntity.name}</a>
            </p>
          )}
          {subsidiaries.length > 0 && (
            <p className="meta">
              Subsidiaries:{" "}
              {subsidiaries.map((sub, i) => (
                <span key={sub.slug}>
                  {i > 0 && ", "}
                  <a href={`/clients/${sub.slug}`}>{sub.name}</a>
                </span>
              ))}
            </p>
          )}

          {entity.links?.officialSite && (
            <p>
              <a href={entity.links.officialSite} target="_blank" rel="noopener noreferrer">
                {entity.links.officialSite.replace(/^https?:\/\//, "")}
              </a>
            </p>
          )}
        </header>

        {/* Stats Bar */}
        <section className="stats-bar">
          <div className="stat">
            <span className="stat-value">{stats.totalClaims}</span>
            <span className="stat-label">Claims</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.topics}</span>
            <span className="stat-label">Topics</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.sources}</span>
            <span className="stat-label">Sources</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.corrections}</span>
            <span className="stat-label">Corrections</span>
          </div>
        </section>

        {/* Claims Section */}
        <section>
          <h2>Published Claims ({assertedClaims.length})</h2>
          <p className="meta">Verified statements with sources and version history</p>

          {assertedClaims.length === 0 ? (
            <p>No claims published yet.</p>
          ) : (
            assertedClaims.map((claim) => (
              <article key={claim.id} className="claim-item">
                <div className="meta">
                  <span className={`status status-${claim.status}`}>{claim.status}</span>
                  {" · "}v{claim.version}
                  {" · "}{claim.provenance.updatedAt}
                </div>
                <h3>{claim.title}</h3>
                <p>{claim.statement}</p>
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

        {/* Topics Section */}
        {usedTopics.length > 0 && (
          <section>
            <h2>Topics ({usedTopics.length})</h2>
            <p className="meta">Categories these claims are organized under</p>
            <ul>
              {usedTopics.map((topic) => (
                <li key={topic.slug}>
                  <a href={`/topics/${topic.slug}`}>{topic.name}</a>
                  <span className="meta"> — {topic.description}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sources Section */}
        <section>
          <h2>Sources ({usedSources.length})</h2>
          <p className="meta">Primary documents cited as evidence</p>
          <ul>
            {usedSources.map((source) => (
              <li key={source!.id}>
                <a href={source!.url} target="_blank" rel="noopener noreferrer">
                  {source!.title}
                </a>
                <span className="meta">
                  {" "}— {source!.publisher}, accessed {source!.accessDate}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Corrections Section */}
        {corrections.length > 0 && (
          <section>
            <h2>Corrections & Disputes ({corrections.length})</h2>
            <p className="meta">Claims that have been updated, disputed, or deprecated</p>
            {corrections.map((claim) => (
              <article key={claim.id} className="claim-item">
                <div className="meta">
                  <span className={`status status-${claim.status}`}>{claim.status}</span>
                  {" · "}v{claim.version}
                  {" · "}{claim.provenance.updatedAt}
                </div>
                <h3>{claim.title}</h3>
                <p>{claim.statement}</p>
                {claim.changelog.length > 1 && (
                  <div className="meta">
                    History:{" "}
                    {claim.changelog.map((entry, i) => (
                      <span key={i}>
                        {i > 0 && " → "}
                        v{entry.version} ({entry.date})
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </section>
        )}

        {/* About Section */}
        <section className="meta">
          <h2>About this dashboard</h2>
          <p>
            This dashboard shows all verified claims about {entity.name} published on{" "}
            <a href="https://missing.link">missing.link</a>, a knowledge substrate
            designed for AI citation.
          </p>
          <p>
            All claims include version history, explicit provenance, and links to
            primary sources. Claims can be corrected or updated without erasing history.
          </p>
          <p>
            <a href={`/entities/${slug}`}>View public entity page →</a>
          </p>
        </section>
      </main>
    </>
  );
}
