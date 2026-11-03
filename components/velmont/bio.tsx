'use client';
import { useRef, useState } from 'react';
import { contact, whatsappUrl } from '@/lib/site';
import { publicEnv } from '@/lib/public-env';
import { prepareLeadProtection, submitLead } from '@/lib/lead-capture';
import { googleReviewsUrl, testimonials } from '@/content/testimonials';
import { partners } from '@/content/partners';
import { postPath, type BlogSummary } from '@/lib/blog/types';
import { Arrow, Icon } from './icons';

// Link in the Instagram bio (/links). Each intent opens a two-question form; the
// answers go to /api/leads as source "link-bio" (Leads > Origem in the panel) and
// the conversation continues on WhatsApp. Without JavaScript the links open WhatsApp.

// Values match the interest enum of public.leads.
const interests = ['Marcas', 'Patentes', 'Software', 'Outros ativos', 'Preciso de orientação'] as const;
type Interest = (typeof interests)[number];
const phrase: Record<Interest, string> = {
  Marcas: 'quero registrar minha marca',
  Patentes: 'quero proteger uma invenção ou um design',
  Software: 'quero registrar meu software',
  'Outros ativos': 'quero proteger um ativo do meu negócio',
  'Preciso de orientação': 'quero entender o que proteger no meu negócio',
};
const chip: Record<Interest, string> = { Marcas: 'Marca', Patentes: 'Invenção ou design', Software: 'Software', 'Outros ativos': 'Outro ativo', 'Preciso de orientação': 'Ainda não sei' };
const intents: { interest: Interest; title: string; hint: string }[] = [
  { interest: 'Marcas', title: 'Quero registrar minha marca', hint: 'Pesquisa de viabilidade, pedido e acompanhamento no INPI' },
  { interest: 'Patentes', title: 'Tenho uma invenção ou um design', hint: 'Patente, modelo de utilidade e desenho industrial' },
  { interest: 'Software', title: 'Quero proteger meu software', hint: 'Registro, autoria e titularidade do código' },
  { interest: 'Preciso de orientação', title: 'Ainda não sei o que proteger', hint: 'Uma conversa para entender o seu momento' },
];
const message = (interest: Interest, name?: string, company?: string) =>
  [`Olá, Velmont! Vim pelo Instagram e ${phrase[interest]}.`, ...(name ? [`Nome: ${name}`, `Empresa ou projeto: ${company || 'Ainda em estruturação'}`, `Interesse: ${interest}`] : [])].join('\n');
const quote = testimonials.find((t) => t.id === 'fernanda-reis') ?? testimonials[0];
const logos = partners.slice(0, 6);
const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=Avenida+Igua%C3%A7u%2C+2820%2C+%C3%81gua+Verde%2C+Curitiba+PR';

export function BioPage({ posts }: { posts: BlogSummary[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [interest, setInterest] = useState<Interest>('Marcas');

  const open = (event: React.MouseEvent, value: Interest) => {
    event.preventDefault();
    setInterest(value);
    dialog.current?.showModal();
    // Turnstile starts while the person types, so the hand-off does not wait for it.
    if (form.current) prepareLeadProtection(form.current);
  };

  return <div className="bio">
    <a className="skip-link" href="#bio-conteudo">Pular para o conteúdo</a>
    <header className="bio-top">
      <img className="bio-mountain" src="/generated/velmont-hero-mountain-768.webp" width="768" height="512" alt="" fetchPriority="high" />
      <a className="bio-logo" href="/" aria-label="Velmont: conheça o site"><img src="/images/velmont-logo.webp" width="140" height="70" alt="Velmont Marcas e Patentes" /></a>
      <p className="bio-place">Curitiba, PR<br />Presencial e digital</p>
    </header>

    <main id="bio-conteudo">
      <section className="bio-hero" aria-labelledby="bio-title">
        <p className="eyebrow">MARCAS · PATENTES · SOFTWARE</p>
        <h1 id="bio-title">Marca é <em>patrimônio.</em></h1>
        <p className="bio-lead">Consultoria em propriedade intelectual. Você entende os riscos, as etapas e as possibilidades reais antes de decidir.</p>
      </section>

      <section className="bio-intents" aria-labelledby="bio-intents-title">
        <h2 id="bio-intents-title" className="eyebrow">O QUE VOCÊ QUER PROTEGER?</h2>
        <ul>
          {intents.map((item, i) => <li key={item.interest}>
            <a className={`bio-intent${i === 0 ? ' bio-intent-main' : ''}`} href={whatsappUrl(message(item.interest))} target="_blank" rel="noopener noreferrer" onClick={(e) => open(e, item.interest)}>
              <span><strong>{item.title}</strong><small>{item.hint}</small></span>
              <span className="cta-arrow"><Arrow /></span>
            </a>
          </li>)}
        </ul>
        <p className="bio-note">Duas perguntas rápidas e a conversa segue no WhatsApp.</p>
      </section>

      <section className="bio-proof" aria-labelledby="bio-proof-title">
        <h2 id="bio-proof-title" className="sr-only">Quem atende você</h2>
        <div className="bio-founder">
          <img src="/images/danielle-velmont-640.webp" width="640" height="960" alt="Danielle Cubas de Azevedo, fundadora da Velmont" loading="lazy" decoding="async" />
          <div>
            <strong>Danielle Cubas de Azevedo</strong>
            <span>FOUNDER & CEO</span>
            <p>Economista, pós-graduada em Propriedade Intelectual e Direito Digital, com mais de 11 anos no setor.</p>
          </div>
        </div>
        <p className="bio-promise"><em>Não prometemos aprovação.</em> Construímos uma estratégia, com cada etapa explicada.</p>
        <figure className="bio-quote">
          <span className="testimonial-stars"><span className="sr-only">{quote.rating} de 5 estrelas</span>{Array.from({ length: quote.rating }, (_, i) => <Icon name="star" key={i} />)}</span>
          <blockquote>{quote.quote}</blockquote>
          <figcaption>{quote.name} · Avaliação no Google</figcaption>
          <a className="text-link" href={googleReviewsUrl} target="_blank" rel="noopener noreferrer">Ver avaliações no Google <Arrow /></a>
        </figure>
        <div className="bio-clients">
          <p className="eyebrow">PARCEIROS DA NOSSA HISTÓRIA</p>
          <ul>{logos.map(({ name, src }) => <li key={src}><img src={src} alt={name} width="640" height="360" loading="lazy" decoding="async" /></li>)}</ul>
        </div>
      </section>

      <nav className="bio-links" aria-label="Mais da Velmont">
        <a href="/">Conheça a Velmont <Arrow /></a>
        <a href="/filme">Assista ao filme Relevo <Arrow /></a>
        {posts.slice(0, 2).map((post) => <a href={postPath(post.slug)} key={post.slug}><span><small>LEIA</small>{post.title}</span> <Arrow /></a>)}
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"><span><small>COMO CHEGAR</small>Av. Iguaçu, 2820 · Água Verde</span> <Arrow /></a>
        <a href={`mailto:${contact.email}`}><span><small>E-MAIL</small>{contact.email}</span> <Arrow /></a>
      </nav>
    </main>

    <footer className="bio-footer"><span>© {new Date().getFullYear()} Velmont</span><a href="/privacidade">Privacidade</a></footer>

    <dialog className="bio-dialog" ref={dialog} aria-labelledby="bio-form-title">
      <form ref={form} onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const name = text(data.get('name'));
        const company = text(data.get('company'));
        if (publicEnv.leadCapture) await submitLead({ name, company, interest, website: data.get('website'), source: 'link-bio' });
        window.location.assign(whatsappUrl(message(interest, name, company)));
      }}>
        <div className="bio-form-head">
          <h2 id="bio-form-title">Antes do WhatsApp, <em>só duas perguntas.</em></h2>
          <button type="button" className="bio-close" aria-label="Fechar" onClick={() => dialog.current?.close()}><Icon name="close" /></button>
        </div>
        <label htmlFor="bio-name">Seu nome</label>
        <input id="bio-name" name="name" required maxLength={100} autoComplete="name" placeholder="Como podemos chamar você?" pattern=".*\S.*" />
        <label htmlFor="bio-company">Empresa ou projeto <span>(opcional)</span></label>
        <input id="bio-company" name="company" maxLength={150} autoComplete="organization" placeholder="O que você está construindo?" />
        <fieldset>
          <legend>O que você quer proteger?</legend>
          <div className="bio-chips">{interests.map((value) => <label key={value}><input type="radio" name="interest" value={value} checked={interest === value} onChange={() => setInterest(value)} /><span>{chip[value]}</span></label>)}</div>
        </fieldset>
        {publicEnv.leadCapture && <div className="form-trap" aria-hidden="true"><label htmlFor="bio-website">Não preencha este campo</label><input id="bio-website" name="website" tabIndex={-1} autoComplete="off" /></div>}
        <button className="cta bio-submit" type="submit"><span>Continuar no WhatsApp</span><span className="cta-arrow"><Arrow /></span></button>
        <p className="bio-legal">O WhatsApp abre com sua mensagem pronta; você revisa e envia.{publicEnv.leadCapture && ' Registramos nome, empresa e interesse para dar sequência ao atendimento.'} <a href="/privacidade">Privacidade</a></p>
      </form>
    </dialog>
  </div>;
}
