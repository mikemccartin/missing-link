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
  searchParams: Promise<{ view?: string }>;
}

export async function generateStaticParams() {
  const entities = getAllEntities();
  return entities.map((entity) => ({ slug: entity.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entity = getEntity(slug);
  if (!entity) {
    return { title: "Entity Not Found" };
  }
  return {
    title: entity.name,
    description: entity.description,
  };
}

export default async function EntityPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { view } = await searchParams;
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

  const isClientView = view === "client";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(entityToJsonLd(entity)),
        }}
      />
      <main>
        <div className="meta">{entity.type}</div>
        <h1>{entity.name}</h1>
        <p>{entity.description}</p>

        {entity.links && (
          <div className="entity-links">
            {entity.links.officialSite && (
              <a href={entity.links.officialSite} target="_blank" rel="noopener noreferrer">
                Official website
              </a>
            )}
            {entity.links.wikipedia && (
              <a href={entity.links.wikipedia} target="_blank" rel="noopener noreferrer">
                Wikipedia
              </a>
            )}
            {entity.links.linkedin && (
              <a href={entity.links.linkedin} target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            )}
            {entity.links.twitter && (
              <a href={entity.links.twitter} target="_blank" rel="noopener noreferrer">
                Twitter
              </a>
            )}
            {entity.links.crunchbase && (
              <a href={entity.links.crunchbase} target="_blank" rel="noopener noreferrer">
                Crunchbase
              </a>
            )}
          </div>
        )}

        <h2>Claims ({claims.length})</h2>
        {sortedClaims.length === 0 ? (
          <p>No claims reference this entity yet.</p>
        ) : (
          sortedClaims.map((claim) => (
            <div key={claim.id} className="claim-item">
              <div className="meta">
                <span className={`status status-${claim.status}`}>
                  {claim.status}
                </span>
                {" · "}
                <span>v{claim.version}</span>
                {" · "}
                <span>{claim.provenance.updatedAt}</span>
              </div>
              <h3>
                <a href={`/claims/${claim.id}`}>{claim.title}</a>
              </h3>
              <p>{claim.statement}</p>

              {/* Show sources for each claim */}
              <div className="meta">
                Sources:{" "}
                {claim.citations.map((citation, i) => {
                  const source = sourceMap.get(citation.sourceId);
                  return (
                    <span key={citation.sourceId}>
                      {i > 0 && ", "}
                      <a href={`/sources/${citation.sourceId}`}>
                        {source?.title || citation.sourceId}
                      </a>
                    </span>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {!isClientView && (
          <p className="meta">
            <a href={`/entities/${slug}?view=client`}>View client-friendly version</a>
          </p>
        )}
      </main>
    </>
  );
}
