// The calls to action on the site that open the contact form. The API accepts
// only these values (server/leads.ts) and the database constraint
// leads_cta_source_check lists the same ones: arbitrary text never reaches a lead.
export const ctaSources = ['header', 'hero', 'mobile-menu', 'marcas', 'patentes', 'software', 'outros-servicos', 'processo', 'insights', 'artigo', 'footer', 'contact-phone', 'contact-section'] as const;
export type CtaSource = (typeof ctaSources)[number];

/** How the panel names each one ("Origem no site"). */
export const ctaLabels: Record<CtaSource, string> = {
  header: 'Cabeçalho',
  hero: 'Abertura da página',
  'mobile-menu': 'Menu do celular',
  marcas: 'Seção Marcas',
  patentes: 'Seção Patentes',
  software: 'Seção Software',
  'outros-servicos': 'Outras frentes de atuação',
  processo: 'Seção Como atuamos',
  insights: 'Insights',
  artigo: 'Artigo do blog',
  footer: 'Rodapé (WhatsApp)',
  'contact-phone': 'Seção de contato (WhatsApp)',
  'contact-section': 'Formulário de contato',
};
