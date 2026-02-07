#!/usr/bin/env npx ts-node
/**
 * missing.link Draft Deduplicator
 *
 * Cleans draft content before approval:
 * 1. Merges conceptual duplicates (same entity, different slugs)
 * 2. Picks best entity version from "home" batch for cross-batch dupes
 * 3. Filters out noise entities (menu items, beverages, neighborhoods, etc.)
 * 4. Updates all claim entity references to use canonical slugs
 * 5. Removes orphaned entity files
 *
 * Usage:
 *   npm run dedup-drafts [-- --dry-run]
 *
 * Options:
 *   --dry-run    Report changes without modifying files
 */

import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────

/**
 * Category 1: Canonical slug mappings.
 * Maps variant slugs → canonical slug.
 * The canonical slug's entity file will be kept; variants will be deleted.
 */
const SLUG_MERGE_MAP: Record<string, string> = {
  // The ONE Group variants → canonical
  'the-one': 'the-one-group-hospitality',
  'tog': 'the-one-group-hospitality',
  'togrp': 'the-one-group-hospitality',
  'togrp-com': 'the-one-group-hospitality',
  'one-hospitality': 'the-one-group-hospitality',

  // Benihana National Corp → Benihana
  'benihana-national': 'benihana',

  // STK → STK Steakhouse
  'stk': 'stk-steakhouse',

  // OpenTable variants
  'open-table': 'opentable',

  // Friends with Benefits variants → canonical
  'friends-with-benefits-loyalty-program': 'friends-with-benefits',
  'friends-with-benefits-rewards': 'friends-with-benefits',

  // Dom Perignon encoding variant
  'dom-p-rignon': 'dom-perignon',

  // Cosmopolitan
  'the-cosmopolitan-of-las-vegas': 'the-cosmopolitan',

  // St. Jude
  'st-jude-children': 'st-jude',

  // The Chef's Table variants
  'the-chef': 'the-chefs-table',

  // Mio sake variants
  'mio-sparkling-sake': 'mio-sparkling',

  // STK location dupes (Downtown = NYC Downtown)
  'stk-downtown': 'stk-nyc-downtown',
};

/**
 * Category 2: Home batch preferences.
 * Maps entity slug → preferred batch prefix (domain).
 * When the same slug exists in multiple batches, prefer the "home" version.
 */
const HOME_BATCH_MAP: Record<string, string> = {
  'the-one-group-hospitality': 'togrp.com',
  'benihana': 'benihana.com',
  'kona-grill': 'konagrill.com',
  'ra-sushi': 'rasushi.com',
  'stk-steakhouse': 'stksteakhouse.com',
  'bao-yum': 'baoyum.com',
  'friends-with-benefits': 'togrp.com',
  'salt-water-social': 'togrp.com',
  'samurai': 'togrp.com',
  'chassis': 'togrp.com',
  'opentable': 'togrp.com',
  'fanatic-design': 'togrp.com',
  'font-awesome': 'benihana.com',
  'fonticons': 'benihana.com',
  'mapbox': 'benihana.com',
  'web-content-accessibility-guidelines-wcag': 'togrp.com',
  'stk-london': 'stksteakhouse.com',
  'stk-milan': 'stksteakhouse.com',
  'valentine': 'benihana.com',
};

/**
 * Category 3: Noise entity patterns.
 * Entities matching these patterns will be removed.
 */

// Exact slugs to remove (known noise)
const NOISE_SLUGS = new Set([
  // Tech/CMS artifacts
  'contact-form-7',
  '501-c-3',

  // Generic/meaningless
  'gift-cards',
  'happy-hour',
  'sake',
  'sushi',
  'sashimi',
  'teppanyaki',
  'lifestyle-menu',
  'power-lunch',
  'power-lunch-menu',
  'restaurant-week',
  'endless-holiday-menu',
  'dare-to-brunch',
  'magnum-mondays',
  'steak-night-america',
  'steak-night-milan',
  'las-vegas-steak-night',
  'denver-menu',
]);

/**
 * Noise detection heuristics.
 * Returns true if the entity is likely noise.
 */
function isNoiseEntity(slug: string, entity: DraftEntityFile): boolean {
  // Exact match noise
  if (NOISE_SLUGS.has(slug)) return true;

  const name = entity.name || '';
  const type = entity.type || '';
  const desc = (entity.description || '').toLowerCase();

  // Menu item patterns (food dishes)
  const menuPatterns = [
    /roll$/i, /soup$/i, /salad$/i, /bowl$/i, /bao$/i, /slider$/i,
    /burrito$/i, /meatloaf$/i, /salmon$/i, /steak$/i, /filet$/i,
    /lobster/i, /chicken$/i, /shrimp$/i, /gyoza$/i, /tempura/i,
    /wagyu.*filet/i, /wagyu.*broil/i, /wagyu.*slider/i, /fried rice$/i,
    /ceviche$/i, /poke$/i, /wontons$/i, /katsu$/i, /teriyaki$/i,
    /ra-men$/i, /yakisoba$/i, /mochi$/i, /cr-me br-l-e$/i,
    /hibachi.*chicken$/i, /hibachi.*shrimp$/i, /hibachi.*steak$/i,
    /hibachi.*supreme$/i, /hibachi.*chateaubriand$/i, /hibachi.*rice$/i,
    /hibachi.*filet/i, /hibachi.*burritos$/i,
    /platter$/i, /punch bowl$/i,
  ];

  // Beverage patterns
  const beveragePatterns = [
    /vodka$/i, /tequila$/i, /merlot$/i, /prosecco$/i, /pinot grigio$/i,
    /cabernet$/i, /sauvignon blanc$/i, /lager$/i, /ale$/i, /ipa$/i,
    /seltzer$/i, /ultra$/i, /martini$/i, /margarita$/i, /lemonade$/i,
    /champagne$/i, /brut$/i, /sparkling$/i, /ros[eé]$/i, /plum wine$/i,
    /sake$/i, /nigori$/i, /ginjo$/i,
  ];

  // Check menu item patterns
  for (const pattern of menuPatterns) {
    if (pattern.test(name) || pattern.test(slug)) return true;
  }

  // Check beverage patterns
  for (const pattern of beveragePatterns) {
    if (pattern.test(name) || pattern.test(slug)) return true;
  }

  // Known beverage brand names
  const beverageBrands = [
    'absolut', 'casamigos', 'patron', 'don-julio', 'grey-goose', 'reyka',
    'skyy', 'corona', 'sapporo', 'asahi', 'kirin', 'stella-artois',
    'michelob', 'high-noon', 'hitachino', 'orion', 'golden-road',
    'austin-beerworks', 'athletic-golden', 'hakutsuru', 'hakkaisan',
    'heavensake', 'kizakura', 'amabuki', 'kubota', 'joto',
    'veuve-clicquot', 'laurent-perrier', 'ferrari-brut', 'ferrari-ros',
    'la-marca', 'mionetto', 'kim-crawford', 'bonanza',
    'caposaldo', 'santa-margherita', 'woodbridge', 'brush-creek',
    'a-to-z-rose', '14-hands', 'dom-perignon', 'dom-p-rignon',
    'mo-t-chandon', 'grand-marnier', 'ancho-reyes', 'monin',
    'maker', 'poland-spring', 'ramune', 'hana-flavored-sake',
    'kinsen-plum-wine', 'mio-sparkling', 'mio', 'sho-chiku-bai',
    'shimizu-no-mai', 'kawaba', 'kyoto-matcha',
  ];
  if (beverageBrands.some(b => slug.startsWith(b))) return true;

  // Benihana-specific product entities (sauces, menu items with Benihana prefix)
  if (/^benihana-(fried-rice|ginger-sauce|garlic-sauce|yum-yum|onion-soup|mojito|plum|punch|sake|inspired)/.test(slug)) return true;

  // RA Sushi gift cards
  if (slug === 'ra-sushi-gift-cards' || slug === 'benihana-gift-cards') return true;

  // Kona Grill individual location entities (keep the main brand, skip location-specific entities)
  if (/^kona-grill-(baltimore|huntsville|north-star|tampa)$/.test(slug)) return true;

  // Specific menu/promotional entities
  const promoSlugs = [
    'be-the-chef', 'taste-of-benihana', 'taste-of-benihana-menu',
    'taste-of-kona', 'kabuki-kids', 'kabuki-kids-menu', 'kabuki-sushi',
    'sushi-garden', 'sushi-me', 'sushi-sake-101', 'sushi-sake-201',
    'ocean-treasure', 'rising-sun-platter', 'tokyo-platter',
    'bounty-of-the-seven-seas', 'wagyu-of-the-world',
    'fishbowl-cocktails', 'splash-n-meadow', 'blue-ocean-punch-bowl',
    'blue-samurai-punch-bowl', 'beni-tini', 'tokyo-mule', 'dirty-bull',
    'catch-me-if-you-can', 'nectar-slider', 'dojo-sushi',
    'ra-ckin-for-nicky', 'ra-ckin-roll', 'salt-water-social',
    '26-steak-date', '3-6-9-happy-hour', '7-7-7-happy-hour',
    'samurai-restaurant', 'hibachi-supreme',
    'rooftop-by-stk', 'vibe-dining',
    'stk-steakhouse-atlanta', 'stk-steakhouse-niagara-fallsview',
  ];
  if (promoSlugs.includes(slug)) return true;

  // Description-based detection: "a menu item", "a cocktail", "a dish"
  if (/\b(menu item|cocktail|dish|appetizer|dessert|entrée|entree|beverage|drink|beer|wine|sake|spirit)\b/.test(desc)) {
    // But don't remove if it's a real brand/org
    if (type !== 'organization' && type !== 'person') return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

interface DraftMetadata {
  confidence: string;
  sourcePages: string[];
  extractedAt: string;
  model: string;
}

interface DraftEntityFile {
  slug: string;
  name: string;
  type: string;
  description: string;
  links?: { officialSite?: string };
  parentEntity?: string;
  _draft: DraftMetadata;
}

interface ClaimEntityRef {
  slug: string;
  role: string;
}

interface DraftClaimFile {
  id: string;
  title: string;
  statement: string;
  status: string;
  entities: ClaimEntityRef[];
  topics: string[];
  citations: Array<{ sourceId: string; quote?: string }>;
  provenance: { author: string; createdAt: string; updatedAt: string };
  version: number;
  changelog: Array<{ version: number; date: string; summary: string }>;
  _draft: DraftMetadata;
}

// ─────────────────────────────────────────────────────────
// MAIN SCRIPT
// ─────────────────────────────────────────────────────────

interface Stats {
  entitiesMerged: number;
  entitiesRemoved: number;
  entitiesKeptBestVersion: number;
  claimsUpdated: number;
  claimsRemoved: number;
  noiseRemoved: number;
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    console.log('=== DRY RUN MODE (no files will be modified) ===\n');
  }

  const draftsRoot = path.join(process.cwd(), 'drafts');
  const batches = fs.readdirSync(draftsRoot)
    .filter(d => !d.startsWith('.') && fs.statSync(path.join(draftsRoot, d)).isDirectory());

  console.log(`Found ${batches.length} draft batches:`);
  batches.forEach(b => console.log(`  - ${b}`));
  console.log('');

  const stats: Stats = {
    entitiesMerged: 0,
    entitiesRemoved: 0,
    entitiesKeptBestVersion: 0,
    claimsUpdated: 0,
    claimsRemoved: 0,
    noiseRemoved: 0,
  };

  // ─── Phase 1: Build entity inventory ───
  console.log('Phase 1: Building entity inventory...');

  // Map: slug → array of { batch, filePath, entity }
  const entityInventory = new Map<string, Array<{
    batch: string;
    filePath: string;
    entity: DraftEntityFile;
  }>>();

  for (const batch of batches) {
    const entitiesDir = path.join(draftsRoot, batch, 'entities');
    if (!fs.existsSync(entitiesDir)) continue;

    const files = fs.readdirSync(entitiesDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(entitiesDir, file);
      const slug = file.replace('.json', '');

      try {
        const entity = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DraftEntityFile;
        if (!entityInventory.has(slug)) {
          entityInventory.set(slug, []);
        }
        entityInventory.get(slug)!.push({ batch, filePath, entity });
      } catch {
        console.warn(`  Warning: Could not parse ${filePath}`);
      }
    }
  }

  console.log(`  Total unique slugs: ${entityInventory.size}`);
  console.log(`  Cross-batch dupes: ${Array.from(entityInventory.values()).filter(v => v.length > 1).length}`);

  // ─── Phase 2: Identify merges, noise, and best versions ───
  console.log('\nPhase 2: Analyzing entities...');

  // Track which entities to delete (filePath → reason)
  const entitiesToDelete = new Map<string, string>();

  // Track slug remapping for claims (old slug → canonical slug)
  const slugRemapForClaims = new Map<string, string>();

  // Populate slug remap from merge map
  for (const [variant, canonical] of Object.entries(SLUG_MERGE_MAP)) {
    slugRemapForClaims.set(variant, canonical);
  }

  // Phase 2a: Mark merge variants for deletion
  console.log('\n  Category 1: Conceptual duplicates to merge...');
  for (const [variant, canonical] of Object.entries(SLUG_MERGE_MAP)) {
    const entries = entityInventory.get(variant);
    if (entries) {
      for (const entry of entries) {
        entitiesToDelete.set(entry.filePath, `Merged: ${variant} → ${canonical}`);
        stats.entitiesMerged++;
      }
      console.log(`    ${variant} → ${canonical} (${entries.length} file(s))`);
    }
  }

  // Phase 2b: For cross-batch dupes, keep best version
  console.log('\n  Category 2: Cross-batch duplicates (keeping best version)...');
  for (const [slug, entries] of entityInventory) {
    if (entries.length <= 1) continue;
    if (SLUG_MERGE_MAP[slug]) continue; // Already handled as merge variant

    // Determine which batch to keep
    const homeDomain = HOME_BATCH_MAP[slug];
    let kept: typeof entries[0] | null = null;

    if (homeDomain) {
      // Prefer home batch
      kept = entries.find(e => e.batch.startsWith(homeDomain)) || null;
    }

    if (!kept) {
      // Pick highest confidence, or most source pages
      kept = entries.reduce((best, current) => {
        const confOrder = ['low', 'medium', 'high'];
        const bestConf = confOrder.indexOf(best.entity._draft.confidence);
        const currConf = confOrder.indexOf(current.entity._draft.confidence);
        if (currConf > bestConf) return current;
        if (currConf === bestConf && current.entity._draft.sourcePages.length > best.entity._draft.sourcePages.length) {
          return current;
        }
        return best;
      });
    }

    // Delete all non-kept versions
    for (const entry of entries) {
      if (entry !== kept) {
        entitiesToDelete.set(entry.filePath, `Cross-batch dupe: keeping ${kept.batch} version`);
        stats.entitiesKeptBestVersion++;
      }
    }

    if (entries.length > 1) {
      console.log(`    ${slug}: keeping ${kept.batch} (${entries.length - 1} duplicate(s) removed)`);
    }
  }

  // Phase 2c: Identify noise entities
  console.log('\n  Category 3: Noise entities to remove...');
  const noiseReport: string[] = [];
  for (const [slug, entries] of entityInventory) {
    if (SLUG_MERGE_MAP[slug]) continue; // Already handled

    // Check any version for noise
    const representative = entries[0].entity;
    if (isNoiseEntity(slug, representative)) {
      for (const entry of entries) {
        if (!entitiesToDelete.has(entry.filePath)) {
          entitiesToDelete.set(entry.filePath, `Noise: ${representative.type} "${representative.name}"`);
          stats.noiseRemoved++;
        }
      }
      noiseReport.push(`    ${slug} (${representative.type}: "${representative.name}")`);
    }
  }
  console.log(`  Found ${noiseReport.length} noise entity slugs`);
  // Show first 30
  noiseReport.slice(0, 30).forEach(line => console.log(line));
  if (noiseReport.length > 30) {
    console.log(`    ... and ${noiseReport.length - 30} more`);
  }

  // ─── Phase 3: Update claims ───
  console.log('\nPhase 3: Updating claim entity references...');

  // Build set of all entity slugs that will be deleted (to track orphaned claims)
  const deletedSlugs = new Set<string>();
  for (const [filePath] of entitiesToDelete) {
    const slug = path.basename(filePath, '.json');
    deletedSlugs.add(slug);
  }

  // Also need to know which slugs survive (exist somewhere and not deleted)
  const survivingSlugs = new Set<string>();
  for (const [slug, entries] of entityInventory) {
    for (const entry of entries) {
      if (!entitiesToDelete.has(entry.filePath)) {
        // This slug survives in at least one batch
        survivingSlugs.add(slug);
      }
    }
  }

  // Add canonical targets from merge map
  for (const canonical of Object.values(SLUG_MERGE_MAP)) {
    survivingSlugs.add(canonical);
  }

  // Also load existing content entities (already approved)
  const existingEntitiesDir = path.join(process.cwd(), 'content', 'entities');
  if (fs.existsSync(existingEntitiesDir)) {
    const files = fs.readdirSync(existingEntitiesDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      survivingSlugs.add(file.replace('.json', ''));
    }
  }

  for (const batch of batches) {
    const claimsDir = path.join(draftsRoot, batch, 'claims');
    if (!fs.existsSync(claimsDir)) continue;

    const files = fs.readdirSync(claimsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(claimsDir, file);

      try {
        const claim = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as DraftClaimFile;
        let modified = false;

        // Update entity references
        for (const entityRef of claim.entities) {
          const canonical = slugRemapForClaims.get(entityRef.slug);
          if (canonical) {
            entityRef.slug = canonical;
            modified = true;
          }
        }

        // Deduplicate entity references (same slug might appear twice after remapping)
        const seenSlugs = new Set<string>();
        const uniqueEntities: ClaimEntityRef[] = [];
        for (const entityRef of claim.entities) {
          if (!seenSlugs.has(entityRef.slug)) {
            seenSlugs.add(entityRef.slug);
            uniqueEntities.push(entityRef);
          }
        }
        if (uniqueEntities.length !== claim.entities.length) {
          claim.entities = uniqueEntities;
          modified = true;
        }

        // Also update parentEntity references in the entity's own claim
        if (modified && !dryRun) {
          fs.writeFileSync(filePath, JSON.stringify(claim, null, 2));
          stats.claimsUpdated++;
        } else if (modified) {
          stats.claimsUpdated++;
        }
      } catch {
        console.warn(`  Warning: Could not parse ${filePath}`);
      }
    }
  }

  console.log(`  Claims updated: ${stats.claimsUpdated}`);

  // ─── Phase 4: Update parentEntity references in entity files ───
  console.log('\nPhase 4: Updating parentEntity references...');

  for (const [slug, entries] of entityInventory) {
    for (const entry of entries) {
      if (entitiesToDelete.has(entry.filePath)) continue;

      if (entry.entity.parentEntity) {
        const canonical = slugRemapForClaims.get(entry.entity.parentEntity);
        if (canonical) {
          console.log(`  ${slug}: parentEntity ${entry.entity.parentEntity} → ${canonical}`);
          entry.entity.parentEntity = canonical;
          if (!dryRun) {
            fs.writeFileSync(entry.filePath, JSON.stringify(entry.entity, null, 2));
          }
        }
      }
    }
  }

  // ─── Phase 5: Delete entity files ───
  console.log('\nPhase 5: Deleting duplicate/noise entity files...');

  let deleteCount = 0;
  for (const [filePath, reason] of entitiesToDelete) {
    if (!dryRun) {
      fs.unlinkSync(filePath);
    }
    deleteCount++;
  }

  console.log(`  Deleted: ${deleteCount} entity files`);

  // ─── Summary ───
  console.log('\n' + '='.repeat(60));
  console.log('DEDUPLICATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`  Entities merged (slug variants):    ${stats.entitiesMerged}`);
  console.log(`  Entities deduped (cross-batch):     ${stats.entitiesKeptBestVersion}`);
  console.log(`  Noise entities removed:             ${stats.noiseRemoved}`);
  console.log(`  Total entity files deleted:         ${deleteCount}`);
  console.log(`  Claims updated (slug references):   ${stats.claimsUpdated}`);

  if (dryRun) {
    console.log('\n=== DRY RUN COMPLETE (no files were modified) ===');
    console.log('Run without --dry-run to apply changes.');
  } else {
    console.log('\nDeduplication complete!');
    console.log('\nNext steps:');
    console.log('  1. Review changes');
    console.log('  2. Run approve-drafts for each batch:');
    for (const batch of batches) {
      console.log(`     npm run approve-drafts -- --crawl ${batch} --force`);
    }
  }
}

// Run
main();
