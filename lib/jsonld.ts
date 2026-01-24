import { Claim, Source, Entity, Topic } from './schemas';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://missing.link';

// Claim as Schema.org Claim/CreativeWork
export function claimToJsonLd(claim: Claim, sources: Source[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Claim',
    '@id': `${BASE_URL}/claims/${claim.id}`,
    name: claim.title,
    description: claim.statement,
    dateCreated: claim.provenance.createdAt,
    dateModified: claim.provenance.updatedAt,
    author: {
      '@type': 'Organization',
      name: claim.provenance.author,
    },
    claimReviewed: claim.statement,
    appearance: sources.map(source => ({
      '@type': 'CreativeWork',
      '@id': `${BASE_URL}/sources/${source.id}`,
      name: source.title,
      url: source.url,
      publisher: {
        '@type': 'Organization',
        name: source.publisher,
      },
    })),
    reviewRating: {
      '@type': 'Rating',
      ratingValue: claim.status === 'asserted' ? 5 :
                   claim.status === 'disputed' ? 3 :
                   claim.status === 'corrected' ? 2 : 1,
      bestRating: 5,
      worstRating: 1,
      ratingExplanation: `Claim status: ${claim.status}`,
    },
  };
}

// Source as Schema.org CreativeWork
export function sourceToJsonLd(source: Source): object {
  const typeMap: Record<string, string> = {
    'webpage': 'WebPage',
    'pdf': 'DigitalDocument',
    'academic-paper': 'ScholarlyArticle',
    'press-release': 'NewsArticle',
    'news-article': 'NewsArticle',
    'government-document': 'GovernmentDocument',
    'social-media': 'SocialMediaPosting',
    'video': 'VideoObject',
    'podcast': 'PodcastEpisode',
    'book': 'Book',
    'report': 'Report',
    'other': 'CreativeWork',
  };

  return {
    '@context': 'https://schema.org',
    '@type': typeMap[source.type] || 'CreativeWork',
    '@id': `${BASE_URL}/sources/${source.id}`,
    name: source.title,
    url: source.url,
    dateAccessed: source.accessDate,
    datePublished: source.publishedDate,
    publisher: {
      '@type': 'Organization',
      name: source.publisher,
    },
    ...(source.author && {
      author: {
        '@type': 'Person',
        name: source.author,
      },
    }),
    ...(source.excerpt && {
      description: source.excerpt,
    }),
  };
}

// Entity as Schema.org Organization/Person/Thing
export function entityToJsonLd(entity: Entity): object {
  const typeMap: Record<string, string> = {
    'organization': 'Organization',
    'person': 'Person',
    'product': 'Product',
    'project': 'Project',
    'event': 'Event',
    'place': 'Place',
    'concept': 'Thing',
    'other': 'Thing',
  };

  return {
    '@context': 'https://schema.org',
    '@type': typeMap[entity.type] || 'Thing',
    '@id': `${BASE_URL}/entities/${entity.slug}`,
    name: entity.name,
    description: entity.description,
    ...(entity.links?.officialSite && { url: entity.links.officialSite }),
    sameAs: [
      entity.links?.wikipedia,
      entity.links?.linkedin,
      entity.links?.twitter,
      entity.links?.crunchbase,
    ].filter(Boolean),
  };
}

// Topic as Schema.org DefinedTerm
export function topicToJsonLd(topic: Topic): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': `${BASE_URL}/topics/${topic.slug}`,
    name: topic.name,
    description: topic.description,
  };
}

// Website structured data for homepage
export function websiteJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': BASE_URL,
    name: 'missing.link',
    description: 'A machine-first knowledge substrate for AI citation. Verified claims with transparent provenance.',
    url: BASE_URL,
    publisher: {
      '@type': 'Organization',
      name: 'missing.link',
    },
  };
}

// Helper to render JSON-LD script tag content
export function jsonLdScript(data: object): string {
  return JSON.stringify(data, null, 0);
}
