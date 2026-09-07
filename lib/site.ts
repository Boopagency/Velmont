export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://velmont-patrimonio.jabez-oliveira.chatgpt.site').replace(/\/$/, '');
export const contact = { phone: '5541985084026', displayPhone: '(41) 98508-4026', email: 'contato@grupovelmont.com', instagram: 'https://www.instagram.com/velmontmarcas/' };
export const organization = {
  '@context': 'https://schema.org', '@type': ['Organization', 'ProfessionalService'], '@id': `${siteUrl}/#organization`, name: 'Velmont', url: siteUrl,
  description: 'Consultoria estratégica em marcas, patentes, software e propriedade intelectual.',
  logo: `${siteUrl}/images/velmont-logo.webp`, email: contact.email, telephone: '+55-41-98508-4026',
  sameAs: [contact.instagram], address: { '@type': 'PostalAddress', streetAddress: 'Avenida Iguaçu, 2820, Água Verde', addressLocality: 'Curitiba', addressRegion: 'PR', postalCode: '80240-030', addressCountry: 'BR' },
  founder: [{ '@type': 'Person', name: 'Danielle Cubas de Azevedo' }, { '@type': 'Person', name: 'Lisandra Ferreira dos Santos' }],
};
