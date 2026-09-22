import type { AuthorKey } from './types';

// Only real people already presented on the site. The @id values match the
// Person entities published by lib/seo.ts.
export const authors: Record<AuthorKey, { name: string; url: string; person: boolean; schemaId: string }> = {
  velmont: { name: 'Velmont', url: '/#essencia', person: false, schemaId: 'organization' },
  danielle: { name: 'Danielle Cubas de Azevedo', url: '/#fundadoras', person: true, schemaId: 'danielle' },
  lisandra: { name: 'Lisandra Ferreira dos Santos', url: '/#fundadoras', person: true, schemaId: 'lisandra' },
};
