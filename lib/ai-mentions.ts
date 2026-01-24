import fs from "fs";
import path from "path";

const RESULTS_DIR = path.join(process.cwd(), "content", "ai-mentions");

export interface MentionResult {
  entity: string;
  entityName: string;
  prompt: string;
  timestamp: string;
  platform: string;
  cited: boolean;
  citedUrl?: string;
  sources: Array<{ title: string; url: string }>;
  answerExcerpt: string;
}

export interface PlatformStats {
  checked: number;
  cited: number;
}

export interface MentionSummary {
  lastRun: string;
  totalChecks: number;
  citations: number;
  platformBreakdown?: Record<string, PlatformStats>;
  results: MentionResult[];
}

export function getLatestMentions(): MentionSummary | null {
  const summaryPath = path.join(RESULTS_DIR, "latest.json");

  if (!fs.existsSync(summaryPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(summaryPath, "utf-8");
    return JSON.parse(content) as MentionSummary;
  } catch {
    return null;
  }
}

export function getMentionHistory(): MentionSummary[] {
  if (!fs.existsSync(RESULTS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith(".json") && f !== "latest.json")
    .sort()
    .reverse()
    .slice(0, 10);

  return files.map(file => {
    const content = fs.readFileSync(path.join(RESULTS_DIR, file), "utf-8");
    return {
      lastRun: file.replace(".json", "").replace(/-/g, ":"),
      totalChecks: 0,
      citations: 0,
      results: JSON.parse(content) as MentionResult[],
    };
  });
}
