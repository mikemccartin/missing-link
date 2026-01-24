import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAllTopics,
  getTopic,
  getClaimsForTopic,
  getEntityNames,
} from "@/lib/content";
import { topicToJsonLd, jsonLdScript } from "@/lib/jsonld";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const topics = getAllTopics();
  return topics.map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const topic = getTopic(slug);
  if (!topic) {
    return { title: "Topic Not Found" };
  }
  return {
    title: topic.name,
    description: topic.description,
  };
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  const topic = getTopic(slug);

  if (!topic) {
    notFound();
  }

  const claims = getClaimsForTopic(slug);

  // Get all entity slugs for name resolution
  const allEntitySlugs = claims.flatMap((c) => c.entities.map((e) => e.slug));
  const entityNames = getEntityNames(allEntitySlugs);

  // Sort claims by status then by date
  const sortedClaims = [...claims].sort((a, b) => {
    if (a.status !== b.status) {
      const statusOrder = { asserted: 0, disputed: 1, corrected: 2, deprecated: 3 };
      return statusOrder[a.status] - statusOrder[b.status];
    }
    return b.provenance.updatedAt.localeCompare(a.provenance.updatedAt);
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(topicToJsonLd(topic)),
        }}
      />
      <main>
        <div className="meta">topic</div>
        <h1>{topic.name}</h1>
        <p>{topic.description}</p>

        <h2>Claims ({claims.length})</h2>
        {sortedClaims.length === 0 ? (
          <p>No claims tagged with this topic yet.</p>
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
          ))
        )}
      </main>
    </>
  );
}
