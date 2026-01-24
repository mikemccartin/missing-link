#!/usr/bin/env npx ts-node

/**
 * Source snapshot script for missing.link
 *
 * Archives source URLs using Oxylabs Web Scraper API.
 *
 * Usage:
 *   npm run snapshot -- src_abc12345
 *   npm run snapshot -- --all
 *
 * Environment variables required:
 *   OXYLABS_USERNAME
 *   OXYLABS_PASSWORD
 */

import fs from "fs";
import path from "path";
import https from "https";
import { SourceSchema, Source } from "../lib/schemas";

const CONTENT_DIR = path.join(process.cwd(), "content");
const ARTIFACTS_DIR = path.join(CONTENT_DIR, "sources", "artifacts");

interface OxylabsResponse {
  results: Array<{
    content: string;
    status_code: number;
    url: string;
  }>;
}

async function fetchWithOxylabs(url: string): Promise<string> {
  const username = process.env.OXYLABS_USERNAME;
  const password = process.env.OXYLABS_PASSWORD;

  if (!username || !password) {
    throw new Error("OXYLABS_USERNAME and OXYLABS_PASSWORD environment variables required");
  }

  const payload = JSON.stringify({
    source: "universal",
    url,
    render: "html",
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "realtime.oxylabs.io",
        port: 443,
        path: "/v1/queries",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Oxylabs returned status ${res.statusCode}: ${data}`));
            return;
          }
          try {
            const response: OxylabsResponse = JSON.parse(data);
            if (response.results && response.results[0]) {
              resolve(response.results[0].content);
            } else {
              reject(new Error("No content in Oxylabs response"));
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function snapshotSource(sourceId: string): Promise<void> {
  const sourcePath = path.join(CONTENT_DIR, "sources", `${sourceId}.json`);

  if (!fs.existsSync(sourcePath)) {
    console.error(`Source not found: ${sourceId}`);
    return;
  }

  const sourceData = JSON.parse(fs.readFileSync(sourcePath, "utf-8"));
  const source: Source = SourceSchema.parse(sourceData);

  console.log(`\nSnapshotting: ${source.title}`);
  console.log(`URL: ${source.url}`);

  try {
    const content = await fetchWithOxylabs(source.url);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const artifactDir = path.join(ARTIFACTS_DIR, sourceId);

    // Ensure artifact directory exists
    fs.mkdirSync(artifactDir, { recursive: true });

    // Save snapshot
    const artifactPath = path.join(artifactDir, `${timestamp}.html`);
    fs.writeFileSync(artifactPath, content);

    // Update source with snapshot reference
    const snapshot = {
      timestamp: new Date().toISOString(),
      artifactPath: `artifacts/${sourceId}/${timestamp}.html`,
      method: "oxylabs" as const,
    };

    source.snapshots = source.snapshots || [];
    source.snapshots.push(snapshot);

    fs.writeFileSync(sourcePath, JSON.stringify(source, null, 2));

    console.log(`✓ Saved snapshot: ${artifactPath}`);
  } catch (error) {
    console.error(`✗ Failed to snapshot: ${error}`);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage:");
    console.log("  npm run snapshot -- src_abc12345   # Snapshot specific source");
    console.log("  npm run snapshot -- --all          # Snapshot all sources");
    console.log("\nRequired environment variables:");
    console.log("  OXYLABS_USERNAME");
    console.log("  OXYLABS_PASSWORD");
    process.exit(1);
  }

  if (args[0] === "--all") {
    const sourcesDir = path.join(CONTENT_DIR, "sources");
    const sourceFiles = fs.readdirSync(sourcesDir).filter((f) => f.endsWith(".json"));

    console.log(`Snapshotting ${sourceFiles.length} sources...`);

    for (const file of sourceFiles) {
      const sourceId = file.replace(".json", "");
      await snapshotSource(sourceId);
    }
  } else {
    await snapshotSource(args[0]);
  }

  console.log("\nDone.");
}

main().catch(console.error);
