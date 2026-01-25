/**
 * missing.link Content Spider - Content Extraction
 *
 * Extracts clean text, metadata, and structured data from HTML pages.
 */

import { PageMetadata, PageType } from "./types";

/**
 * Extracts and processes content from HTML pages.
 */
export class ContentExtractor {
  /**
   * Extract clean text content from HTML, removing navigation, scripts, styles, etc.
   */
  extractText(html: string): string {
    let text = html;

    // Remove script tags and their content
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ");

    // Remove style tags and their content
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ");

    // Remove common non-content elements
    const elementsToRemove = [
      "nav",
      "header",
      "footer",
      "aside",
      "noscript",
      "iframe",
      "form",
      "svg",
      "canvas",
    ];
    for (const el of elementsToRemove) {
      const regex = new RegExp(
        `<${el}\\b[^>]*>([\\s\\S]*?)<\\/${el}>`,
        "gi"
      );
      text = text.replace(regex, " ");
    }

    // Remove elements by common class/id patterns for non-content
    const patterns = [
      /class\s*=\s*["'][^"']*(?:nav|menu|sidebar|footer|header|cookie|banner|popup|modal|advertisement|ad-|ads-)[^"']*["'][^>]*>[\s\S]*?(?=<(?:div|section|article|main|body)|$)/gi,
    ];
    for (const pattern of patterns) {
      text = text.replace(pattern, " ");
    }

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, " ");

    // Remove all remaining HTML tags but preserve some structure
    // Convert block elements to newlines
    text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)>/gi, "\n");
    text = text.replace(/<(br|hr)\s*\/?>/gi, "\n");

    // Remove all other tags
    text = text.replace(/<[^>]+>/g, " ");

    // Decode HTML entities
    text = this.decodeHtmlEntities(text);

    // Clean up whitespace
    text = text
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 0)
      .join("\n");

    // Remove excessive newlines
    text = text.replace(/\n{3,}/g, "\n\n");

    return text.trim();
  }

  /**
   * Decode common HTML entities.
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      "&nbsp;": " ",
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&#39;": "'",
      "&apos;": "'",
      "&copy;": "©",
      "&reg;": "®",
      "&trade;": "™",
      "&mdash;": "—",
      "&ndash;": "–",
      "&hellip;": "…",
      "&bull;": "•",
      "&lsquo;": "\u2018",
      "&rsquo;": "\u2019",
      "&ldquo;": "\u201C",
      "&rdquo;": "\u201D",
    };

    let result = text;
    for (const [entity, char] of Object.entries(entities)) {
      result = result.replace(new RegExp(entity, "gi"), char);
    }

    // Decode numeric entities
    result = result.replace(/&#(\d+);/g, (_, num) =>
      String.fromCharCode(parseInt(num, 10))
    );
    result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );

    return result;
  }

  /**
   * Extract metadata from HTML page.
   */
  extractMetadata(html: string, url: string): PageMetadata {
    const getMetaContent = (nameOrProperty: string): string | null => {
      // Try name attribute
      let match = html.match(
        new RegExp(
          `<meta[^>]+name\\s*=\\s*["']${nameOrProperty}["'][^>]+content\\s*=\\s*["']([^"']*)["']`,
          "i"
        )
      );
      if (match) return this.decodeHtmlEntities(match[1]);

      // Try content before name
      match = html.match(
        new RegExp(
          `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]+name\\s*=\\s*["']${nameOrProperty}["']`,
          "i"
        )
      );
      if (match) return this.decodeHtmlEntities(match[1]);

      // Try property attribute (for Open Graph)
      match = html.match(
        new RegExp(
          `<meta[^>]+property\\s*=\\s*["']${nameOrProperty}["'][^>]+content\\s*=\\s*["']([^"']*)["']`,
          "i"
        )
      );
      if (match) return this.decodeHtmlEntities(match[1]);

      // Try content before property
      match = html.match(
        new RegExp(
          `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]+property\\s*=\\s*["']${nameOrProperty}["']`,
          "i"
        )
      );
      if (match) return this.decodeHtmlEntities(match[1]);

      return null;
    };

    // Extract title
    let title = "";
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      title = this.decodeHtmlEntities(titleMatch[1].trim());
    }
    // Prefer og:title if available
    const ogTitle = getMetaContent("og:title");
    if (ogTitle) {
      title = ogTitle;
    }

    // Extract description
    let description = getMetaContent("description") || "";
    const ogDescription = getMetaContent("og:description");
    if (ogDescription) {
      description = ogDescription;
    }

    // Extract canonical URL
    let canonicalUrl: string | null = null;
    const canonicalMatch = html.match(
      /<link[^>]+rel\s*=\s*["']canonical["'][^>]+href\s*=\s*["']([^"']*)["']/i
    );
    if (canonicalMatch) {
      canonicalUrl = canonicalMatch[1];
    } else {
      // Try href before rel
      const altMatch = html.match(
        /<link[^>]+href\s*=\s*["']([^"']*)["'][^>]+rel\s*=\s*["']canonical["']/i
      );
      if (altMatch) {
        canonicalUrl = altMatch[1];
      }
    }

    // Extract language
    let language: string | null = null;
    const langMatch = html.match(/<html[^>]+lang\s*=\s*["']([^"']*)["']/i);
    if (langMatch) {
      language = langMatch[1];
    }

    return {
      title,
      description,
      canonicalUrl,
      ogImage: getMetaContent("og:image"),
      ogType: getMetaContent("og:type"),
      language,
      author: getMetaContent("author"),
      publishedDate:
        getMetaContent("article:published_time") ||
        getMetaContent("datePublished"),
      modifiedDate:
        getMetaContent("article:modified_time") ||
        getMetaContent("dateModified"),
    };
  }

  /**
   * Classify the page type based on URL patterns and content.
   */
  classifyPage(url: string, html: string, metadata: PageMetadata): PageType {
    const urlLower = url.toLowerCase();
    const pathLower = new URL(url).pathname.toLowerCase();
    const titleLower = metadata.title.toLowerCase();

    // Homepage detection
    if (pathLower === "/" || pathLower === "") {
      return "homepage";
    }

    // About pages
    if (
      pathLower.match(/\/(about|company|who-we-are|our-story|mission|values)/) ||
      titleLower.includes("about us") ||
      titleLower.includes("our company") ||
      titleLower.includes("who we are")
    ) {
      return "about";
    }

    // Team pages
    if (
      pathLower.match(/\/(team|leadership|people|management|executives|staff|our-team)/) ||
      titleLower.includes("our team") ||
      titleLower.includes("leadership") ||
      titleLower.includes("management team")
    ) {
      return "team";
    }

    // Product/service pages
    if (
      pathLower.match(/\/(product|service|solution|offering|platform|feature)/) ||
      titleLower.includes("product") ||
      titleLower.includes("service") ||
      titleLower.includes("solution")
    ) {
      return "product";
    }

    // News/blog pages
    if (
      pathLower.match(/\/(news|press|blog|article|post|stories|media|announcement)/) ||
      metadata.ogType === "article" ||
      titleLower.includes("news") ||
      titleLower.includes("press release") ||
      titleLower.includes("blog")
    ) {
      return "news";
    }

    // Contact pages
    if (
      pathLower.match(/\/(contact|get-in-touch|reach-us|connect|inquiry)/) ||
      titleLower.includes("contact") ||
      titleLower.includes("get in touch")
    ) {
      return "contact";
    }

    // Legal pages
    if (
      pathLower.match(/\/(privacy|terms|legal|policy|disclaimer|cookie|gdpr|ccpa)/) ||
      titleLower.includes("privacy policy") ||
      titleLower.includes("terms of") ||
      titleLower.includes("legal")
    ) {
      return "legal";
    }

    return "other";
  }

  /**
   * Extract JSON-LD structured data from HTML.
   */
  extractJsonLd(html: string): object | null {
    const jsonLdMatches = html.match(
      /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    );

    if (!jsonLdMatches || jsonLdMatches.length === 0) {
      return null;
    }

    const results: object[] = [];

    for (const match of jsonLdMatches) {
      // Extract the JSON content
      const contentMatch = match.match(
        /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
      );
      if (!contentMatch) continue;

      try {
        const jsonContent = contentMatch[1].trim();
        const parsed = JSON.parse(jsonContent);
        results.push(parsed);
      } catch {
        // Invalid JSON, skip this block
        continue;
      }
    }

    if (results.length === 0) {
      return null;
    }

    // Return single object or array
    return results.length === 1 ? results[0] : results;
  }

  /**
   * Extract all links from HTML, separating internal and external.
   */
  extractLinks(
    html: string,
    baseUrl: string
  ): { internal: string[]; external: string[] } {
    const internal: Set<string> = new Set();
    const external: Set<string> = new Set();

    const base = new URL(baseUrl);
    const baseDomain = base.hostname.replace(/^www\./, "");

    // Find all href attributes
    const hrefMatches = Array.from(html.matchAll(/href\s*=\s*["']([^"'#]+)/gi));

    for (const match of hrefMatches) {
      let href = match[1].trim();

      // Skip non-http links
      if (
        href.startsWith("javascript:") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("data:")
      ) {
        continue;
      }

      try {
        // Resolve relative URLs
        const resolved = new URL(href, baseUrl);

        // Skip non-http(s) protocols
        if (!resolved.protocol.startsWith("http")) {
          continue;
        }

        const resolvedDomain = resolved.hostname.replace(/^www\./, "");

        if (resolvedDomain === baseDomain) {
          // Internal link - normalize and add
          internal.add(this.normalizeUrl(resolved.toString()));
        } else {
          // External link
          external.add(resolved.toString());
        }
      } catch {
        // Invalid URL, skip
        continue;
      }
    }

    return {
      internal: Array.from(internal),
      external: Array.from(external),
    };
  }

  /**
   * Normalize a URL for consistent comparison.
   */
  normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);

      // Remove fragment
      parsed.hash = "";

      // Remove trailing slash (except for root)
      if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
        parsed.pathname = parsed.pathname.slice(0, -1);
      }

      // Sort query params
      parsed.searchParams.sort();

      // Lowercase hostname
      parsed.hostname = parsed.hostname.toLowerCase();

      return parsed.toString();
    } catch {
      return url;
    }
  }
}
