/**
 * missing.link Content Spider - Robots.txt Parser
 *
 * Parses robots.txt files and determines crawl permissions.
 */

interface RobotsRule {
  path: string;
  allow: boolean;
}

interface RobotsGroup {
  userAgents: string[];
  rules: RobotsRule[];
  crawlDelay: number | null;
}

/**
 * Parses and evaluates robots.txt directives.
 */
export class RobotsParser {
  private groups: RobotsGroup[] = [];
  private sitemaps: string[] = [];

  constructor(robotsTxt: string) {
    this.parse(robotsTxt);
  }

  /**
   * Parse robots.txt content into structured rules.
   */
  private parse(content: string): void {
    const lines = content.split("\n").map((line) => {
      // Remove comments and trim
      const commentIndex = line.indexOf("#");
      if (commentIndex !== -1) {
        line = line.slice(0, commentIndex);
      }
      return line.trim();
    });

    let currentGroup: RobotsGroup | null = null;

    for (const line of lines) {
      if (!line) continue;

      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) continue;

      const directive = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();

      if (!value) continue;

      switch (directive) {
        case "user-agent":
          // Start a new group or add to existing if consecutive user-agents
          if (
            currentGroup === null ||
            currentGroup.rules.length > 0 ||
            currentGroup.crawlDelay !== null
          ) {
            currentGroup = {
              userAgents: [value.toLowerCase()],
              rules: [],
              crawlDelay: null,
            };
            this.groups.push(currentGroup);
          } else {
            currentGroup.userAgents.push(value.toLowerCase());
          }
          break;

        case "disallow":
          if (currentGroup && value) {
            currentGroup.rules.push({ path: value, allow: false });
          }
          break;

        case "allow":
          if (currentGroup && value) {
            currentGroup.rules.push({ path: value, allow: true });
          }
          break;

        case "crawl-delay":
          if (currentGroup) {
            const delay = parseFloat(value);
            if (!isNaN(delay) && delay >= 0) {
              currentGroup.crawlDelay = delay;
            }
          }
          break;

        case "sitemap":
          this.sitemaps.push(value);
          break;
      }
    }
  }

  /**
   * Find the most specific matching group for a user agent.
   */
  private findMatchingGroup(userAgent: string): RobotsGroup | null {
    const ua = userAgent.toLowerCase();

    // First, look for exact match
    for (const group of this.groups) {
      if (group.userAgents.some((agent) => ua.includes(agent) || agent === "*"))
        continue;
      if (group.userAgents.some((agent) => agent === ua)) {
        return group;
      }
    }

    // Then, look for partial match (e.g., "missing.link-spider" matches "missing.link")
    let bestMatch: RobotsGroup | null = null;
    let bestMatchLength = 0;

    for (const group of this.groups) {
      for (const agent of group.userAgents) {
        if (agent === "*") continue;
        if (ua.includes(agent) && agent.length > bestMatchLength) {
          bestMatch = group;
          bestMatchLength = agent.length;
        }
      }
    }

    if (bestMatch) return bestMatch;

    // Finally, fall back to wildcard
    for (const group of this.groups) {
      if (group.userAgents.includes("*")) {
        return group;
      }
    }

    return null;
  }

  /**
   * Check if a path matches a robots.txt pattern.
   * Supports * wildcards and $ end-of-path anchor.
   */
  private pathMatches(pattern: string, path: string): boolean {
    // Empty pattern matches nothing
    if (!pattern) return false;

    // Handle $ end anchor
    const mustMatchEnd = pattern.endsWith("$");
    if (mustMatchEnd) {
      pattern = pattern.slice(0, -1);
    }

    // Convert pattern to regex
    let regexStr = "^";
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      if (char === "*") {
        regexStr += ".*";
      } else if ("[](){}+?.\\^$|".includes(char)) {
        regexStr += "\\" + char;
      } else {
        regexStr += char;
      }
    }

    if (mustMatchEnd) {
      regexStr += "$";
    }

    try {
      const regex = new RegExp(regexStr);
      return regex.test(path);
    } catch {
      // If regex fails, do simple prefix match
      return path.startsWith(pattern.replace(/\*/g, ""));
    }
  }

  /**
   * Check if a URL is allowed to be crawled by the given user agent.
   */
  isAllowed(url: string, userAgent: string): boolean {
    // Parse URL to get path
    let path: string;
    try {
      const parsed = new URL(url);
      path = parsed.pathname + parsed.search;
    } catch {
      // Invalid URL, be conservative and disallow
      return false;
    }

    const group = this.findMatchingGroup(userAgent);

    // No matching group means everything is allowed
    if (!group) return true;

    // No rules means everything is allowed
    if (group.rules.length === 0) return true;

    // Find the most specific matching rule
    // Rules are evaluated by specificity (longest path match wins)
    // Among rules with same specificity, Allow takes precedence over Disallow
    let bestMatch: RobotsRule | null = null;
    let bestMatchLength = -1;

    for (const rule of group.rules) {
      if (this.pathMatches(rule.path, path)) {
        const matchLength = rule.path.replace(/\*/g, "").length;
        if (matchLength > bestMatchLength) {
          bestMatch = rule;
          bestMatchLength = matchLength;
        } else if (matchLength === bestMatchLength && rule.allow) {
          // Same length, but allow takes precedence
          bestMatch = rule;
        }
      }
    }

    // No matching rule means allowed
    if (!bestMatch) return true;

    return bestMatch.allow;
  }

  /**
   * Get the crawl delay for a user agent (in seconds).
   */
  getCrawlDelay(userAgent: string): number | null {
    const group = this.findMatchingGroup(userAgent);
    return group?.crawlDelay ?? null;
  }

  /**
   * Get all sitemap URLs declared in robots.txt.
   */
  getSitemaps(): string[] {
    return [...this.sitemaps];
  }

  /**
   * Create a RobotsParser by fetching robots.txt from a URL.
   */
  static async fetch(baseUrl: string): Promise<RobotsParser> {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();

    try {
      const response = await fetch(robotsUrl, {
        headers: {
          "User-Agent": "missing.link-spider/1.0",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        // No robots.txt or error - return permissive parser
        return new RobotsParser("");
      }

      const text = await response.text();
      return new RobotsParser(text);
    } catch {
      // Network error - return permissive parser
      return new RobotsParser("");
    }
  }
}
