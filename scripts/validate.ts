#!/usr/bin/env npx ts-node

/**
 * Validation script for missing.link content
 * Run with: npm run validate
 */

import fs from "fs";
import path from "path";
import {
  ClaimSchema,
  SourceSchema,
  EntitySchema,
  TopicSchema,
} from "../lib/schemas";

const CONTENT_DIR = path.join(process.cwd(), "content");

interface ValidationResult {
  file: string;
  valid: boolean;
  errors: string[];
}

function validateJsonFiles(
  dir: string,
  schema: { parse: (data: unknown) => unknown },
  typeName: string
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const fullPath = path.join(CONTENT_DIR, dir);

  if (!fs.existsSync(fullPath)) {
    console.log(`  Directory not found: ${dir}`);
    return results;
  }

  const files = fs.readdirSync(fullPath).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const filePath = path.join(fullPath, file);
    const result: ValidationResult = {
      file: `${dir}/${file}`,
      valid: true,
      errors: [],
    };

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      schema.parse(data);
    } catch (error) {
      result.valid = false;
      if (error instanceof Error) {
        result.errors.push(error.message);
      } else {
        result.errors.push(String(error));
      }
    }

    results.push(result);
  }

  return results;
}

function validateCrossReferences(): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Load all IDs
  const entitySlugs = new Set<string>();
  const sourcesIds = new Set<string>();
  const topicSlugs = new Set<string>();

  // Read entities
  const entitiesDir = path.join(CONTENT_DIR, "entities");
  if (fs.existsSync(entitiesDir)) {
    for (const file of fs.readdirSync(entitiesDir).filter((f) => f.endsWith(".json"))) {
      const data = JSON.parse(fs.readFileSync(path.join(entitiesDir, file), "utf-8"));
      entitySlugs.add(data.slug);
    }
  }

  // Read sources
  const sourcesDir = path.join(CONTENT_DIR, "sources");
  if (fs.existsSync(sourcesDir)) {
    for (const file of fs.readdirSync(sourcesDir).filter((f) => f.endsWith(".json"))) {
      const data = JSON.parse(fs.readFileSync(path.join(sourcesDir, file), "utf-8"));
      sourcesIds.add(data.id);
    }
  }

  // Read topics
  const topicsDir = path.join(CONTENT_DIR, "topics");
  if (fs.existsSync(topicsDir)) {
    for (const file of fs.readdirSync(topicsDir).filter((f) => f.endsWith(".json"))) {
      const data = JSON.parse(fs.readFileSync(path.join(topicsDir, file), "utf-8"));
      topicSlugs.add(data.slug);
    }
  }

  // Validate claims cross-references
  const claimsDir = path.join(CONTENT_DIR, "claims");
  if (fs.existsSync(claimsDir)) {
    for (const file of fs.readdirSync(claimsDir).filter((f) => f.endsWith(".json"))) {
      const result: ValidationResult = {
        file: `claims/${file}`,
        valid: true,
        errors: [],
      };

      const data = JSON.parse(fs.readFileSync(path.join(claimsDir, file), "utf-8"));

      // Check entity references
      for (const entity of data.entities || []) {
        if (!entitySlugs.has(entity.slug)) {
          result.valid = false;
          result.errors.push(`Referenced entity not found: ${entity.slug}`);
        }
      }

      // Check topic references
      for (const topic of data.topics || []) {
        if (!topicSlugs.has(topic)) {
          result.valid = false;
          result.errors.push(`Referenced topic not found: ${topic}`);
        }
      }

      // Check source references
      for (const citation of data.citations || []) {
        if (!sourcesIds.has(citation.sourceId)) {
          result.valid = false;
          result.errors.push(`Referenced source not found: ${citation.sourceId}`);
        }
      }

      if (!result.valid) {
        results.push(result);
      }
    }
  }

  return results;
}

function main() {
  console.log("Validating missing.link content...\n");

  let hasErrors = false;

  // Validate each content type
  console.log("Validating claims...");
  const claimResults = validateJsonFiles("claims", ClaimSchema, "Claim");
  for (const result of claimResults) {
    if (result.valid) {
      console.log(`  ✓ ${result.file}`);
    } else {
      console.log(`  ✗ ${result.file}`);
      result.errors.forEach((e) => console.log(`    Error: ${e}`));
      hasErrors = true;
    }
  }

  console.log("\nValidating sources...");
  const sourceResults = validateJsonFiles("sources", SourceSchema, "Source");
  for (const result of sourceResults) {
    if (result.valid) {
      console.log(`  ✓ ${result.file}`);
    } else {
      console.log(`  ✗ ${result.file}`);
      result.errors.forEach((e) => console.log(`    Error: ${e}`));
      hasErrors = true;
    }
  }

  console.log("\nValidating entities...");
  const entityResults = validateJsonFiles("entities", EntitySchema, "Entity");
  for (const result of entityResults) {
    if (result.valid) {
      console.log(`  ✓ ${result.file}`);
    } else {
      console.log(`  ✗ ${result.file}`);
      result.errors.forEach((e) => console.log(`    Error: ${e}`));
      hasErrors = true;
    }
  }

  console.log("\nValidating topics...");
  const topicResults = validateJsonFiles("topics", TopicSchema, "Topic");
  for (const result of topicResults) {
    if (result.valid) {
      console.log(`  ✓ ${result.file}`);
    } else {
      console.log(`  ✗ ${result.file}`);
      result.errors.forEach((e) => console.log(`    Error: ${e}`));
      hasErrors = true;
    }
  }

  console.log("\nValidating cross-references...");
  const xrefResults = validateCrossReferences();
  if (xrefResults.length === 0) {
    console.log("  ✓ All cross-references valid");
  } else {
    for (const result of xrefResults) {
      console.log(`  ✗ ${result.file}`);
      result.errors.forEach((e) => console.log(`    Error: ${e}`));
      hasErrors = true;
    }
  }

  console.log("\n---");
  if (hasErrors) {
    console.log("Validation FAILED");
    process.exit(1);
  } else {
    console.log("Validation PASSED");
    process.exit(0);
  }
}

main();
