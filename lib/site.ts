export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.grupovelmont.com').replace(/\/$/, '');
export const contact = { phone: '5541985084026', displayPhone: '(41) 98508-4026', email: 'contato@grupovelmont.com', instagram: 'https://www.instagram.com/velmontmarcas/' };
/** Canonical and social URLs may only point at this site's own origin, never at another domain. */
export function sameSiteUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).origin === new URL(siteUrl).origin ? url : null;
  } catch {
    return null;
  }
}
export const whatsappUrl = (message = 'Olá, Velmont! Gostaria de solicitar uma análise estratégica.') => `https://wa.me/${contact.phone}?text=${encodeURIComponent(message)}`;
export const organization = {
  '@context': 'https://schema.org', '@type': ['Organization', 'ProfessionalService'], '@id': `${siteUrl}/#organization`, name: 'Velmont', url: siteUrl,
  description: 'Consultoria estratégica em marcas, patentes, software e propriedade intelectual.',
  logo: `${siteUrl}/images/velmont-logo.webp`, email: contact.email, telephone: '+55-41-98508-4026',
  sameAs: [contact.instagram], address: { '@type': 'PostalAddress', streetAddress: 'Avenida Iguaçu, 2820, Água Verde', addressLocality: 'Curitiba', addressRegion: 'PR', postalCode: '80240-030', addressCountry: 'BR' },
  founder: [{ '@type': 'Person', name: 'Danielle Cubas de Azevedo' }, { '@type': 'Person', name: 'Lisandra Ferreira dos Santos' }],
};
