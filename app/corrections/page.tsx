import { Metadata } from "next";
import { getCorrections } from "@/lib/content";

export const metadata: Metadata = {
  title: "Corrections",
  description: "Transparent record of all claim corrections and updates",
};

export default function CorrectionsPage() {
  const corrections = getCorrections();

  return (
    <main>
      <h1>Corrections</h1>
      <p>
        Transparent record of all claim corrections and updates. Claims are
        never deleted—corrections are tracked through versioned changelogs.
      </p>

      {corrections.length === 0 ? (
        <p>No corrections recorded yet. All claims are at version 1.</p>
      ) : (
        <>
          <h2>Correction log</h2>
          {corrections.map(({ claim, entry }, index) => (
            <div key={`${claim.id}-${entry.version}`} className="claim-item">
              <div className="meta">{entry.date}</div>
              <h3>
                <a href={`/claims/${claim.id}`}>{claim.title}</a>
              </h3>
              <p>
                <strong>v{entry.version}:</strong> {entry.summary}
              </p>
              <div className="meta">
                Current status:{" "}
                <span className={`status status-${claim.status}`}>
                  {claim.status}
                </span>
              </div>
            </div>
          ))}
        </>
      )}

      <h2>Correction policy</h2>
      <ul>
        <li>Claims are never deleted from missing.link</li>
        <li>
          Corrections require: status change, version increment, and changelog
          entry
        </li>
        <li>All previous versions are documented in the claim changelog</li>
        <li>
          Status options: <strong>asserted</strong> (current and verified),{" "}
          <strong>disputed</strong> (conflicting evidence),{" "}
          <strong>corrected</strong> (updated statement), and{" "}
          <strong>deprecated</strong> (no longer maintained)
        </li>
      </ul>
    </main>
  );
}
