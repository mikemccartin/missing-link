#!/usr/bin/env npx ts-node
/**
 * missing.link Draft Approver
 *
 * Validates draft content and moves approved files to /content/.
 *
 * Usage:
 *   npm run approve-drafts -- --crawl <id> [options]
 *
 * Options:
 *   --crawl <id>        Crawl ID to approve (folder name in /drafts/)
 *   --validate-only     Just validate, don't move files
 *   --force             Skip confirmation prompts
 *   --help              Show this help message
 *
 * Examples:
 *   npm run approve-drafts -- --crawl upbound.com_20260125_034546
 *   npm run approve-drafts -- --crawl upbound.com_20260125_034546 --validate-only
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import {
  EntitySchema,
  SourceSchema,
  ClaimSchema,
  Entity,
  Source,
  Claim,
} from '../lib/schemas';
import { DraftManifest, DraftEntity, DraftSource, DraftClaim } from '../lib/processor';

interface CliArgs {
  crawl?: string;
  validateOnly?: boolean;
  force?: boolean;
  help?: boolean;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case '--crawl':
      case '-c':
        args.crawl = next;
        i++;
        break;
      case '--validate-only':
      case '-v':
        args.validateOnly = true;
        break;
      case '--force':
      case '-f':
        args.force = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }

  return args;
}

function showHelp(): void {
  console.log(`
missing.link Draft Approver
Validates draft content and moves approved files to /content/.

USAGE:
  npm run approve-drafts -- --crawl <id> [options]

OPTIONS:
  --crawl, -c <id>     Crawl ID to approve (folder name in /drafts/)
  --validate-only, -v  Just validate, don't move files
  --force, -f          Skip confirmation prompts
  --help, -h           Show this help message

EXAMPLES:
  # Approve drafts
  npm run approve-drafts -- --crawl upbound.com_20260125_034546

  # Validate only (no changes)
  npm run approve-drafts -- --crawl upbound.com_20260125_034546 --validate-only

  # Skip confirmation
  npm run approve-drafts -- --crawl upbound.com_20260125_034546 --force

WORKFLOW:
  1. Review files in /drafts/[crawl-id]/
  2. Edit JSON files as needed
  3. Delete unwanted drafts
  4. Run this script to validate and approve
  5. Approved content moves to /content/
`);
}

/**
 * Prompt user for confirmation.
 */
async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Remove _draft metadata from an object.
 */
function stripDraftMetadata<T>(obj: T): Omit<T, '_draft'> {
  const { _draft, ...rest } = obj as T & { _draft?: unknown };
  return rest as Omit<T, '_draft'>;
}

/**
 * Validate a draft entity.
 */
function validateEntity(data: DraftEntity): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  // Remove draft metadata for validation
  const entity = stripDraftMetadata(data);

  try {
    EntitySchema.parse(entity);
  } catch (error) {
    result.valid = false;
    if (error instanceof Error) {
      result.errors.push(error.message);
    }
  }

  // Add warnings for low confidence
  if (data._draft.confidence === 'low') {
    result.warnings.push('Low confidence extraction - review carefully');
  }

  return result;
}

/**
 * Validate a draft source.
 */
function validateSource(data: DraftSource): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  // Remove draft metadata for validation
  const source = stripDraftMetadata(data);

  try {
    SourceSchema.parse(source);
  } catch (error) {
    result.valid = false;
    if (error instanceof Error) {
      result.errors.push(error.message);
    }
  }

  // Add warnings for low confidence
  if (data._draft.confidence === 'low') {
    result.warnings.push('Low confidence extraction - review carefully');
  }

  return result;
}

/**
 * Validate a draft claim.
 */
function validateClaim(
  data: DraftClaim,
  validEntitySlugs: Set<string>,
  validSourceIds: Set<string>
): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  // Remove draft metadata for validation
  const claim = stripDraftMetadata(data);

  try {
    ClaimSchema.parse(claim);
  } catch (error) {
    result.valid = false;
    if (error instanceof Error) {
      result.errors.push(error.message);
    }
  }

  // Check entity references
  for (const entityRef of data.entities) {
    if (!validEntitySlugs.has(entityRef.slug)) {
      result.warnings.push(`References unknown entity: ${entityRef.slug}`);
    }
  }

  // Check source references
  for (const citation of data.citations) {
    if (!validSourceIds.has(citation.sourceId)) {
      result.errors.push(`References unknown source: ${citation.sourceId}`);
      result.valid = false;
    }
  }

  // Add warnings for low confidence
  if (data._draft.confidence === 'low') {
    result.warnings.push('Low confidence extraction - review carefully');
  }

  return result;
}

/**
 * List existing entities in content folder.
 */
function getExistingEntitySlugs(): Set<string> {
  const slugs = new Set<string>();
  const contentDir = path.join(process.cwd(), 'content', 'entities');

  if (fs.existsSync(contentDir)) {
    const files = fs.readdirSync(contentDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        slugs.add(file.replace('.json', ''));
      }
    }
  }

  return slugs;
}

/**
 * List existing sources in content folder.
 */
function getExistingSourceIds(): Set<string> {
  const ids = new Set<string>();
  const contentDir = path.join(process.cwd(), 'content', 'sources');

  if (fs.existsSync(contentDir)) {
    const files = fs.readdirSync(contentDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = fs.readFileSync(path.join(contentDir, file), 'utf-8');
          const source = JSON.parse(content);
          if (source.id) {
            ids.add(source.id);
          }
        } catch {
          // Ignore invalid files
        }
      }
    }
  }

  return ids;
}

/**
 * Load JSON file.
 */
function loadJson<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Main approval function.
 */
async function main(): Promise<void> {
  const args = parseArgs();

  // Show help
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Validate crawl ID
  if (!args.crawl) {
    console.error('Error: --crawl is required');
    console.error('Use --help for usage information');
    process.exit(1);
  }

  // Find draft directory
  const draftsDir = path.join(process.cwd(), 'drafts', args.crawl);
  if (!fs.existsSync(draftsDir)) {
    console.error(`Error: Draft directory not found: ${draftsDir}`);
    console.error('\nAvailable drafts:');

    const draftsRoot = path.join(process.cwd(), 'drafts');
    if (fs.existsSync(draftsRoot)) {
      const dirs = fs.readdirSync(draftsRoot);
      for (const dir of dirs) {
        console.log(`  - ${dir}`);
      }
    } else {
      console.log('  (none)');
    }

    process.exit(1);
  }

  // Load manifest
  const manifestPath = path.join(draftsDir, 'manifest.json');
  const manifest = loadJson<DraftManifest>(manifestPath);
  if (!manifest) {
    console.error(`Error: Could not load manifest from ${manifestPath}`);
    process.exit(1);
  }

  console.log(`\nDraft validation for: ${args.crawl}`);
  console.log(`  Domain: ${manifest.domain}`);
  console.log(`  Processed: ${manifest.processedAt}`);
  console.log(`  Drafts: ${manifest.drafts.entities.length} entities, ${manifest.drafts.sources.length} sources, ${manifest.drafts.claims.length} claims`);

  // Get existing content for reference checking
  const existingEntities = getExistingEntitySlugs();
  const existingSourceIds = getExistingSourceIds();

  // Collect all draft entity slugs and source IDs
  const draftEntitySlugs = new Set<string>();
  const draftSourceIds = new Set<string>();

  // Validation results
  let totalFiles = 0;
  let validFiles = 0;
  let invalidFiles = 0;
  const allErrors: Array<{ file: string; errors: string[] }> = [];
  const allWarnings: Array<{ file: string; warnings: string[] }> = [];

  // Validate entities
  console.log('\nValidating entities...');
  const entitiesDir = path.join(draftsDir, 'entities');
  if (fs.existsSync(entitiesDir)) {
    const files = fs.readdirSync(entitiesDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      totalFiles++;
      const filePath = path.join(entitiesDir, file);
      const entity = loadJson<DraftEntity>(filePath);

      if (!entity) {
        invalidFiles++;
        allErrors.push({ file: `entities/${file}`, errors: ['Could not parse JSON'] });
        continue;
      }

      draftEntitySlugs.add(entity.slug);
      const result = validateEntity(entity);

      if (result.valid) {
        validFiles++;
        console.log(`  [OK] ${file}`);
      } else {
        invalidFiles++;
        console.log(`  [FAIL] ${file}`);
        allErrors.push({ file: `entities/${file}`, errors: result.errors });
      }

      if (result.warnings.length > 0) {
        allWarnings.push({ file: `entities/${file}`, warnings: result.warnings });
      }
    }
  }

  // Validate sources
  console.log('\nValidating sources...');
  const sourcesDir = path.join(draftsDir, 'sources');
  if (fs.existsSync(sourcesDir)) {
    const files = fs.readdirSync(sourcesDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      totalFiles++;
      const filePath = path.join(sourcesDir, file);
      const source = loadJson<DraftSource>(filePath);

      if (!source) {
        invalidFiles++;
        allErrors.push({ file: `sources/${file}`, errors: ['Could not parse JSON'] });
        continue;
      }

      draftSourceIds.add(source.id);
      const result = validateSource(source);

      if (result.valid) {
        validFiles++;
        console.log(`  [OK] ${file}`);
      } else {
        invalidFiles++;
        console.log(`  [FAIL] ${file}`);
        allErrors.push({ file: `sources/${file}`, errors: result.errors });
      }

      if (result.warnings.length > 0) {
        allWarnings.push({ file: `sources/${file}`, warnings: result.warnings });
      }
    }
  }

  // Validate claims (need entity and source references)
  console.log('\nValidating claims...');
  const claimsDir = path.join(draftsDir, 'claims');

  // Combine existing and draft entities/sources for reference checking
  const allEntitySlugs = new Set([...existingEntities, ...draftEntitySlugs]);
  const allSourceIds = new Set([...existingSourceIds, ...draftSourceIds]);

  if (fs.existsSync(claimsDir)) {
    const files = fs.readdirSync(claimsDir).filter((f) => f.endsWith('.json'));

    for (const file of files) {
      totalFiles++;
      const filePath = path.join(claimsDir, file);
      const claim = loadJson<DraftClaim>(filePath);

      if (!claim) {
        invalidFiles++;
        allErrors.push({ file: `claims/${file}`, errors: ['Could not parse JSON'] });
        continue;
      }

      const result = validateClaim(claim, allEntitySlugs, allSourceIds);

      if (result.valid) {
        validFiles++;
        console.log(`  [OK] ${file}`);
      } else {
        invalidFiles++;
        console.log(`  [FAIL] ${file}`);
        allErrors.push({ file: `claims/${file}`, errors: result.errors });
      }

      if (result.warnings.length > 0) {
        allWarnings.push({ file: `claims/${file}`, warnings: result.warnings });
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total files: ${totalFiles}`);
  console.log(`Valid: ${validFiles}`);
  console.log(`Invalid: ${invalidFiles}`);

  // Show errors
  if (allErrors.length > 0) {
    console.log('\nERRORS:');
    for (const { file, errors } of allErrors) {
      console.log(`  ${file}:`);
      for (const error of errors) {
        console.log(`    - ${error}`);
      }
    }
  }

  // Show warnings
  if (allWarnings.length > 0) {
    console.log('\nWARNINGS:');
    for (const { file, warnings } of allWarnings) {
      console.log(`  ${file}:`);
      for (const warning of warnings) {
        console.log(`    - ${warning}`);
      }
    }
  }

  // Stop if validation only
  if (args.validateOnly) {
    console.log('\n[VALIDATE ONLY] No files were moved.');
    process.exit(invalidFiles > 0 ? 1 : 0);
  }

  // Stop if validation failed
  if (invalidFiles > 0) {
    console.log('\nValidation failed. Fix errors before approving.');
    process.exit(1);
  }

  // Confirmation
  if (!args.force) {
    console.log('');
    const confirmed = await confirm(`Move ${totalFiles} files to /content/?`);
    if (!confirmed) {
      console.log('Cancelled.');
      process.exit(0);
    }
  }

  // Move files to content
  console.log('\nMoving files to /content/...');
  const contentDir = path.join(process.cwd(), 'content');

  // Move entities
  if (fs.existsSync(entitiesDir)) {
    const targetDir = path.join(contentDir, 'entities');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const files = fs.readdirSync(entitiesDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const src = path.join(entitiesDir, file);
      const dst = path.join(targetDir, file);

      // Load, strip _draft, save
      const entity = loadJson<DraftEntity>(src);
      if (entity) {
        const clean = stripDraftMetadata(entity);
        fs.writeFileSync(dst, JSON.stringify(clean, null, 2));
        console.log(`  entities/${file} → content/entities/${file}`);
      }
    }
  }

  // Move sources
  if (fs.existsSync(sourcesDir)) {
    const targetDir = path.join(contentDir, 'sources');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const files = fs.readdirSync(sourcesDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const src = path.join(sourcesDir, file);
      const dst = path.join(targetDir, file);

      // Load, strip _draft, save
      const source = loadJson<DraftSource>(src);
      if (source) {
        const clean = stripDraftMetadata(source);
        fs.writeFileSync(dst, JSON.stringify(clean, null, 2));
        console.log(`  sources/${file} → content/sources/${file}`);
      }
    }
  }

  // Move claims
  if (fs.existsSync(claimsDir)) {
    const targetDir = path.join(contentDir, 'claims');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const files = fs.readdirSync(claimsDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const src = path.join(claimsDir, file);
      const dst = path.join(targetDir, file);

      // Load, strip _draft, save
      const claim = loadJson<DraftClaim>(src);
      if (claim) {
        const clean = stripDraftMetadata(claim);
        fs.writeFileSync(dst, JSON.stringify(clean, null, 2));
        console.log(`  claims/${file} → content/claims/${file}`);
      }
    }
  }

  // Archive draft directory
  const archiveDir = path.join(process.cwd(), 'drafts', '.archive');
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  const archiveName = `${args.crawl}_${Date.now()}`;
  const archivePath = path.join(archiveDir, archiveName);
  fs.renameSync(draftsDir, archivePath);

  console.log(`\nArchived drafts to: drafts/.archive/${archiveName}`);

  console.log('\nDone!');
  console.log(`\nNext steps:`);
  console.log(`  1. Run: npm run validate`);
  console.log(`  2. Review changes: git diff`);
  console.log(`  3. Commit: git add content/ && git commit -m "Add content from ${manifest.domain}"`);
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
