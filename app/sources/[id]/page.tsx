import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllSources, getSource, getAllClaims } from "@/lib/content";
import { sourceToJsonLd, jsonLdScript } from "@/lib/jsonld";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const sources = getAllSources();
  return sources.map((source) => ({ id: source.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const source = getSource(id);
  if (!source) {
    return { title: "Source Not Found" };
  }
  return {
    title: source.title,
    description: source.excerpt || `Source from ${source.publisher}`,
  };
}

export default async function SourcePage({ params }: Props) {
  const { id } = await params;
  const source = getSource(id);

  if (!source) {
    notFound();
  }

  // Find claims that cite this source
  const claims = getAllClaims().filter((claim) =>
    claim.citations.some((c) => c.sourceId === source.id)
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(sourceToJsonLd(source)),
        }}
      />
      <main>
        <div className="meta">{source.type}</div>
        <h1>{source.title}</h1>

        <table>
          <tbody>
            <tr>
              <td>Publisher</td>
              <td>{source.publisher}</td>
            </tr>
            {source.author && (
              <tr>
                <td>Author</td>
                <td>{source.author}</td>
              </tr>
            )}
            <tr>
              <td>URL</td>
              <td>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.url}
                </a>
              </td>
            </tr>
            <tr>
              <td>Access date</td>
              <td>{source.accessDate}</td>
            </tr>
            {source.publishedDate && (
              <tr>
                <td>Published</td>
                <td>{source.publishedDate}</td>
              </tr>
            )}
            <tr>
              <td>Source ID</td>
              <td><code>{source.id}</code></td>
            </tr>
          </tbody>
        </table>

        {source.excerpt && (
          <>
            <h2>Excerpt</h2>
            <blockquote>{source.excerpt}</blockquote>
          </>
        )}

        {source.notes && (
          <>
            <h2>Notes</h2>
            <p>{source.notes}</p>
          </>
        )}

        {source.snapshots && source.snapshots.length > 0 && (
          <>
            <h2>Snapshots</h2>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Method</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {source.snapshots.map((snapshot, i) => (
                  <tr key={i}>
                    <td>{snapshot.timestamp}</td>
                    <td>{snapshot.method}</td>
                    <td>{snapshot.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h2>Citing claims ({claims.length})</h2>
        {claims.length === 0 ? (
          <p>No claims cite this source yet.</p>
        ) : (
          <ul>
            {claims.map((claim) => (
              <li key={claim.id}>
                <a href={`/claims/${claim.id}`}>{claim.title}</a>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
