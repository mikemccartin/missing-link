import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAllClaims,
  getClaim,
  getSourcesForClaim,
  getEntityNames,
  getTopicNames,
} from "@/lib/content";
import { claimToJsonLd, jsonLdScript } from "@/lib/jsonld";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const claims = getAllClaims();
  return claims.map((claim) => ({ id: claim.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const claim = getClaim(id);
  if (!claim) {
    return { title: "Claim Not Found" };
  }
  return {
    title: claim.title,
    description: claim.statement,
  };
}

export default async function ClaimPage({ params }: Props) {
  const { id } = await params;
  const claim = getClaim(id);

  if (!claim) {
    notFound();
  }

  const sources = getSourcesForClaim(claim);
  const entityNames = getEntityNames(claim.entities.map((e) => e.slug));
  const topicNames = getTopicNames(claim.topics);

  // Build source lookup for citations
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(claimToJsonLd(claim, sources)),
        }}
      />
      <main>
        <div className="meta">
          <span className={`status status-${claim.status}`}>
            {claim.status}
          </span>
          {" · "}
          <span>Version {claim.version}</span>
          {" · "}
          <span>Updated {claim.provenance.updatedAt}</span>
        </div>

        <h1>{claim.title}</h1>

        <p>
          <strong>{claim.statement}</strong>
        </p>

        <h2>Entities</h2>
        <ul>
          {claim.entities.map((entity) => (
            <li key={entity.slug}>
              <a href={`/entities/${entity.slug}`}>
                {entityNames.get(entity.slug) || entity.slug}
              </a>{" "}
              ({entity.role})
            </li>
          ))}
        </ul>

        <h2>Topics</h2>
        <ul>
          {claim.topics.map((topic) => (
            <li key={topic}>
              {topicNames.get(topic) || topic}
            </li>
          ))}
        </ul>

        <h2>Citations</h2>
        {claim.citations.map((citation, index) => {
          const source = sourceMap.get(citation.sourceId);
          return (
            <div key={index} className="citation">
              {citation.quote && (
                <blockquote>&quot;{citation.quote}&quot;</blockquote>
              )}
              <p>
                <a href={`/sources/${citation.sourceId}`}>
                  {source?.title || citation.sourceId}
                </a>
                {citation.locator && ` — ${citation.locator}`}
              </p>
              {citation.note && <p className="meta">{citation.note}</p>}
            </div>
          );
        })}

        <h2>Provenance</h2>
        <table>
          <tbody>
            <tr>
              <td>Author</td>
              <td>{claim.provenance.author}</td>
            </tr>
            <tr>
              <td>Created</td>
              <td>{claim.provenance.createdAt}</td>
            </tr>
            <tr>
              <td>Updated</td>
              <td>{claim.provenance.updatedAt}</td>
            </tr>
            <tr>
              <td>Claim ID</td>
              <td><code>{claim.id}</code></td>
            </tr>
          </tbody>
        </table>

        <h2>Changelog</h2>
        <div className="changelog">
          {claim.changelog.map((entry) => (
            <div key={entry.version} className="changelog-entry">
              <strong>v{entry.version}</strong> ({entry.date}): {entry.summary}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
