// Copy of the Instagram bio page (/links), shared by the prerendered page and
// its small browser script (components/velmont/bio-client.ts).

// Values match the interest enum of public.leads.
export const interests = ['Marcas', 'Patentes', 'Software', 'Outros ativos', 'Preciso de orientação'] as const;
export type Interest = (typeof interests)[number];

const phrase: Record<Interest, string> = {
  Marcas: 'quero registrar minha marca',
  Patentes: 'quero proteger uma invenção ou um design',
  Software: 'quero registrar meu software',
  'Outros ativos': 'quero proteger um ativo do meu negócio',
  'Preciso de orientação': 'quero entender o que proteger no meu negócio',
};

export const chip: Record<Interest, string> = { Marcas: 'Marca', Patentes: 'Invenção ou design', Software: 'Software', 'Outros ativos': 'Outro', 'Preciso de orientação': 'Ainda não sei' };

/** The WhatsApp message: only the intent before the form, the answers after it. */
export const bioMessage = (interest: Interest | null, name?: string, company?: string) =>
  [`Olá, Velmont! Vim pelo Instagram e ${phrase[interest || 'Preciso de orientação']}.`, ...(name ? [`Nome: ${name}`, `Empresa ou projeto: ${company || 'Ainda em estruturação'}`, `Interesse: ${interest || 'Preciso de orientação'}`] : [])].join('\n');

export const steps = [
  ['Você conta o que quer proteger', 'Uma conversa rápida pelo WhatsApp para entender o seu negócio.'],
  ['Pesquisa de viabilidade', 'Verificamos se a marca pode ser registrada e quais riscos existem.'],
  ['Pedido e acompanhamento', 'Fazemos o pedido no INPI e acompanhamos cada etapa com você.'],
] as const;
