#!/usr/bin/env npx ts-node

/**
 * Ingest script for missing.link
 *
 * Creates draft claim JSON from simple markdown input.
 *
 * Usage:
 *   npm run ingest -- --entity tandem-theory --topic marketing-technology
 *
 * Then paste your content (Ctrl+D to finish):
 *   # Claim Title
 *   The statement you want to make about the entity.
 *
 *   Source: https://example.com/page
 *   Quote: "Direct quote from the source"
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { generateClaimId, generateSourceId } from "../lib/schemas";

const CONTENT_DIR = path.join(process.cwd(), "content");

interface IngestOptions {
  entity?: string;
  topic?: string;
}

function parseArgs(): IngestOptions {
  const args = process.argv.slice(2);
  const options: IngestOptions = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--entity" && args[i + 1]) {
      options.entity = args[i + 1];
      i++;
    } else if (args[i] === "--topic" && args[i + 1]) {
      options.topic = args[i + 1];
      i++;
    }
  }

  return options;
}

async function readInput(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\nPaste your content (Ctrl+D when done):\n");
  console.log("Format:");
  console.log("  # Claim Title");
  console.log("  Statement about the entity (max 240 chars)");
  console.log("  ");
  console.log("  Source: https://...");
  console.log("  Quote: \"...\"\n");

  const lines: string[] = [];

  return new Promise((resolve) => {
    rl.on("line", (line) => {
      lines.push(line);
    });

    rl.on("close", () => {
      resolve(lines.join("\n"));
    });
  });
}

function parseContent(content: string): {
  title: string;
  statement: string;
  sourceUrl?: string;
  quote?: string;
} {
  const lines = content.split("\n").filter((l) => l.trim());

  let title = "";
  let statement = "";
  let sourceUrl = "";
  let quote = "";

  for (const line of lines) {
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
    } else if (line.toLowerCase().startsWith("source:")) {
      sourceUrl = line.slice(7).trim();
    } else if (line.toLowerCase().startsWith("quote:")) {
      quote = line.slice(6).trim().replace(/^["']|["']$/g, "");
    } else if (!title) {
      // Skip lines before title
    } else if (!statement) {
      statement = line.trim();
    }
  }

  return { title, statement, sourceUrl, quote };
}

function createSourceJson(url: string): { id: string; json: object } {
  const id = generateSourceId();
  const today = new Date().toISOString().split("T")[0];

  // Try to extract domain for publisher
  let publisher = "Unknown";
  try {
    publisher = new URL(url).hostname.replace("www.", "");
  } catch {
    // Keep Unknown
  }

  const json = {
    id,
    title: `Source from ${publisher}`,
    publisher,
    url,
    accessDate: today,
    type: "webpage",
  };

  return { id, json };
}

function createClaimJson(
  title: string,
  statement: string,
  entitySlug: string,
  topicSlug: string,
  sourceId: string,
  quote?: string
): { id: string; json: object } {
  const id = generateClaimId();
  const today = new Date().toISOString().split("T")[0];

  const json = {
    id,
    title,
    statement: statement.slice(0, 240),
    status: "asserted",
    entities: [{ slug: entitySlug, role: "subject" }],
    topics: topicSlug ? [topicSlug] : [],
    citations: [
      {
        sourceId,
        ...(quote && { quote: quote.slice(0, 300) }),
      },
    ],
    provenance: {
      author: "missing.link",
      createdAt: today,
      updatedAt: today,
    },
    version: 1,
    changelog: [
      {
        version: 1,
        date: today,
        summary: "Initial claim created via ingest script",
      },
    ],
  };

  return { id, json };
}

async function main() {
  const options = parseArgs();

  if (!options.entity) {
    console.error("Error: --entity is required");
    console.log("\nUsage: npm run ingest -- --entity <slug> [--topic <slug>]");
    console.log("\nAvailable entities:");
    const entitiesDir = path.join(CONTENT_DIR, "entities");
    if (fs.existsSync(entitiesDir)) {
      const entities = fs.readdirSync(entitiesDir).filter((f) => f.endsWith(".json"));
      entities.forEach((f) => console.log(`  - ${f.replace(".json", "")}`));
    }
    process.exit(1);
  }

  // Verify entity exists
  const entityPath = path.join(CONTENT_DIR, "entities", `${options.entity}.json`);
  if (!fs.existsSync(entityPath)) {
    console.error(`Error: Entity "${options.entity}" not found`);
    process.exit(1);
  }

  // Verify topic exists if provided
  if (options.topic) {
    const topicPath = path.join(CONTENT_DIR, "topics", `${options.topic}.json`);
    if (!fs.existsSync(topicPath)) {
      console.error(`Error: Topic "${options.topic}" not found`);
      process.exit(1);
    }
  }

  const input = await readInput();
  const { title, statement, sourceUrl, quote } = parseContent(input);

  if (!title || !statement) {
    console.error("\nError: Could not parse title and statement from input");
    process.exit(1);
  }

  console.log("\n--- Parsed Content ---");
  console.log(`Title: ${title}`);
  console.log(`Statement: ${statement}`);
  console.log(`Source: ${sourceUrl || "(none)"}`);
  console.log(`Quote: ${quote || "(none)"}`);

  // Create source if URL provided
  let sourceId = "";
  if (sourceUrl) {
    const source = createSourceJson(sourceUrl);
    sourceId = source.id;
    const sourcePath = path.join(CONTENT_DIR, "sources", `${source.id}.json`);
    fs.writeFileSync(sourcePath, JSON.stringify(source.json, null, 2));
    console.log(`\n✓ Created source: ${sourcePath}`);
  } else {
    console.error("\nError: Source URL is required");
    process.exit(1);
  }

  // Create claim
  const claim = createClaimJson(
    title,
    statement,
    options.entity,
    options.topic || "",
    sourceId,
    quote
  );
  const claimPath = path.join(CONTENT_DIR, "claims", `${claim.id}.json`);
  fs.writeFileSync(claimPath, JSON.stringify(claim.json, null, 2));
  console.log(`✓ Created claim: ${claimPath}`);

  console.log("\n--- Next Steps ---");
  console.log("1. Review and edit the generated JSON files");
  console.log("2. Run: npm run validate");
  console.log("3. Commit and push to deploy");
}

main().catch(console.error);
