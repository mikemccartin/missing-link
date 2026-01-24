import { Metadata } from "next";
import { getAllTopics, getClaimsForTopic } from "@/lib/content";

export const metadata: Metadata = {
  title: "Topics",
  description: "Topics categorizing claims in the knowledge base",
};

export default function TopicsIndex() {
  const topics = getAllTopics();

  // Sort alphabetically by name
  const sortedTopics = [...topics].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <main>
      <h1>Topics</h1>
      <p>
        {topics.length} topics categorizing claims in the knowledge base.
      </p>

      <h2>All topics</h2>
      {sortedTopics.map((topic) => {
        const claimCount = getClaimsForTopic(topic.slug).length;
        return (
          <div key={topic.slug} className="claim-item">
            <h3>
              <a href={`/topics/${topic.slug}`}>{topic.name}</a>
            </h3>
            <p>{topic.description}</p>
            <div className="meta">{claimCount} claims</div>
          </div>
        );
      })}
    </main>
  );
}
