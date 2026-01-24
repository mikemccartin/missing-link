import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Client View | missing.link",
    template: "%s | missing.link",
  },
  robots: "noindex", // Don't index client views in search
};

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="client-view">
      {children}
      <footer>
        <p className="meta">
          Powered by <a href="https://missing.link">missing.link</a> — a machine-first knowledge substrate for AI citation
        </p>
      </footer>
    </div>
  );
}
