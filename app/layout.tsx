import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "missing.link",
    template: "%s | missing.link",
  },
  description: "A machine-first knowledge substrate for AI citation. Verified claims with transparent provenance.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://missing.link"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header>
          <a href="/" className="logo">missing.link</a>
          <nav>
            <a href="/claims">Claims</a>
            <a href="/entities">Entities</a>
            <a href="/sources">Sources</a>
            <a href="/topics">Topics</a>
            <a href="/corrections">Corrections</a>
          </nav>
        </header>
        {children}
        <footer>
          <p>
            missing.link is a machine-first knowledge substrate.{" "}
            <a href="/llms.txt">llms.txt</a> ·{" "}
            <a href="/rss.xml">RSS</a> ·{" "}
            <a href="/sitemap.xml">Sitemap</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
