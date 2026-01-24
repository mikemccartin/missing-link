import { Metadata } from "next";
import { getAllClaims, getEntityNames } from "@/lib/content";

export const metadata: Metadata = {
  title: "Claims",
  description: "All verified claims with citations and provenance",
};

export default function ClaimsIndex() {
  const claims = getAllClaims();

  // Get all entity slugs for name resolution
  const allEntitySlugs = claims.flatMap((c) => c.entities.map((e) => e.slug));
  const entityNames = getEntityNames(allEntitySlugs);

  // Sort by most recently updated
  const sortedClaims = [...claims].sort((a, b) =>
    b.provenance.updatedAt.localeCompare(a.provenance.updatedAt)
  );

  return (
    <main>
      <h1>Claims</h1>
      <p>
        {claims.length} verified claims with citations and provenance.
      </p>

      <h2>All claims</h2>
      {sortedClaims.map((claim) => (
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
          <div className="meta">
            Entities:{" "}
            {claim.entities.map((e, i) => (
              <span key={e.slug}>
                {i > 0 && ", "}
                <a href={`/entities/${e.slug}`}>
                  {entityNames.get(e.slug) || e.slug}
                </a>
              </span>
            ))}
          </div>
        </div>
      ))}
    </main>
  );
}
