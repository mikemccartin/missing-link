import { Metadata } from "next";
import { getAllEntities, getClaimsForEntity } from "@/lib/content";

export const metadata: Metadata = {
  title: "Entities",
  description: "Organizations, people, and concepts referenced in claims",
};

export default function EntitiesIndex() {
  const entities = getAllEntities();

  // Sort alphabetically by name
  const sortedEntities = [...entities].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <main>
      <h1>Entities</h1>
      <p>
        {entities.length} organizations, people, and concepts referenced in
        claims.
      </p>

      <h2>All entities</h2>
      {sortedEntities.map((entity) => {
        const claimCount = getClaimsForEntity(entity.slug).length;
        return (
          <div key={entity.slug} className="claim-item">
            <div className="meta">{entity.type}</div>
            <h3>
              <a href={`/entities/${entity.slug}`}>{entity.name}</a>
            </h3>
            <p>{entity.description}</p>
            <div className="meta">{claimCount} associated claims</div>
          </div>
        );
      })}
    </main>
  );
}
