import { Metadata } from "next";
import { getAllSources } from "@/lib/content";

export const metadata: Metadata = {
  title: "Sources",
  description: "Primary sources cited in claims",
};

export default function SourcesIndex() {
  const sources = getAllSources();

  // Sort by access date (most recent first)
  const sortedSources = [...sources].sort((a, b) =>
    b.accessDate.localeCompare(a.accessDate)
  );

  return (
    <main>
      <h1>Sources</h1>
      <p>
        {sources.length} primary sources cited in claims.
      </p>

      <h2>All sources</h2>
      {sortedSources.map((source) => (
        <div key={source.id} className="claim-item">
          <div className="meta">
            {source.type} · {source.publisher}
          </div>
          <h3>
            <a href={`/sources/${source.id}`}>{source.title}</a>
          </h3>
          {source.excerpt && <p>{source.excerpt}</p>}
          <div className="meta">
            Accessed {source.accessDate}
            {source.publishedDate && ` · Published ${source.publishedDate}`}
          </div>
        </div>
      ))}
    </main>
  );
}
