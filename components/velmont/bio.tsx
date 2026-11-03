'use client';
import { useRef, useState, type MouseEvent } from 'react';
import { contact, whatsappUrl } from '@/lib/site';
import { publicEnv } from '@/lib/public-env';
import { prepareLeadProtection, submitLead } from '@/lib/lead-capture';
import { Arrow, Icon } from './icons';

// Link in the Instagram bio (/links). Two actions: each opens a two-question
// form; the answers go to /api/leads as source "link-bio" (Leads > Origem in the
// panel) and the conversation continues on WhatsApp. Without JavaScript the
// buttons open WhatsApp directly and "Privacidade" opens /privacidade.

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
const chip: Record<Interest, string> = { Marcas: 'Marca', Patentes: 'Invenção ou design', Software: 'Software', 'Outros ativos': 'Outro', 'Preciso de orientação': 'Ainda não sei' };
const message = (interest: Interest | null, name?: string, company?: string) =>
  [`Olá, Velmont! Vim pelo Instagram e ${phrase[interest || 'Preciso de orientação']}.`, ...(name ? [`Nome: ${name}`, `Empresa ou projeto: ${company || 'Ainda em estruturação'}`, `Interesse: ${interest || 'Preciso de orientação'}`] : [])].join('\n');
const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');
const steps = [
  ['Você conta o que quer proteger', 'Uma conversa rápida pelo WhatsApp para entender o seu negócio.'],
  ['Pesquisa de viabilidade', 'Verificamos se a marca pode ser registrada e quais riscos existem.'],
  ['Pedido e acompanhamento', 'Fazemos o pedido no INPI e acompanhamos cada etapa com você.'],
];

export function BioPage() {
  const dialog = useRef<HTMLDialogElement>(null);
  const privacy = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [interest, setInterest] = useState<Interest | null>('Marcas');

  const open = (event: MouseEvent, value: Interest | null) => {
    event.preventDefault();
    setInterest(value);
    dialog.current?.showModal();
    // Turnstile starts while the person types, so the hand-off does not wait for it.
    if (form.current) prepareLeadProtection(form.current);
  };
  const openPrivacy = (event: MouseEvent) => {
    event.preventDefault();
    privacy.current?.showModal();
  };
  const action = (value: Interest | null, label: string, ghost = false) =>
    <a className={`bio-cta${ghost ? ' bio-cta-ghost' : ''}`} href={whatsappUrl(message(value))} target="_blank" rel="noopener noreferrer" onClick={(e) => open(e, value)}><span>{label}</span><span className="bio-cta-arrow"><Arrow /></span></a>;
  const close = (ref: typeof dialog) => <button type="button" className="bio-close" aria-label="Fechar" onClick={() => ref.current?.close()}><Icon name="close" /></button>;

  return <div className="bio">
    <a className="skip-link" href="#bio-conteudo">Pular para o conteúdo</a>
    <header className="bio-top">
      <picture className="bio-mountain"><source media="(min-width: 1024px)" srcSet="/generated/velmont-hero-mountain-1536.webp" /><img src="/generated/velmont-hero-mountain-768.webp" width="768" height="512" alt="" fetchPriority="high" /></picture>
      <a className="bio-logo" href="/" aria-label="Velmont: conheça o site"><img src="/images/velmont-logo.webp" width="140" height="70" alt="Velmont Marcas e Patentes" /></a>
      <p className="bio-place">Curitiba, PR · Atendimento presencial e digital</p>
    </header>

    <main id="bio-conteudo" className="bio-main">
      <p className="bio-kicker">Marca é patrimônio</p>
      <h1>Registre sua marca. <em>Proteja seu negócio.</em></h1>
      <p className="bio-lead">A Velmont cuida do registro da sua marca no INPI, da pesquisa inicial ao acompanhamento do pedido. Também protegemos invenções, design e software.</p>
      <div className="bio-actions">
        {action('Marcas', 'Quero registrar minha marca')}
        {action(null, 'Patente, design ou software', true)}
      </div>
      <p className="bio-note">Duas perguntas e a conversa segue no WhatsApp.</p>

      <section className="bio-steps" aria-labelledby="bio-steps-title">
        <h2 id="bio-steps-title" className="bio-kicker">Como funciona</h2>
        <ol>{steps.map(([title, body], i) => <li key={title}><span>0{i + 1}</span><div><strong>{title}</strong><p>{body}</p></div></li>)}</ol>
        <p className="bio-honest">Todo pedido passa pela análise do INPI. Você entende os riscos antes de decidir.</p>
      </section>

      <section className="bio-founder" aria-labelledby="bio-founder-title">
        <h2 id="bio-founder-title" className="bio-kicker">Quem está à frente</h2>
        <p className="bio-founder-name">Danielle Cubas de Azevedo</p>
        <p>Fundadora da Velmont. Economista, pós-graduada em Propriedade Intelectual e Direito Digital, com mais de 11 anos no setor.</p>
      </section>
    </main>

    <footer className="bio-footer"><a href={contact.instagram} target="_blank" rel="noopener noreferrer">@velmontmarcas</a><a href="/">Site</a><a href="/privacidade" onClick={openPrivacy}>Privacidade</a></footer>

    <dialog className="bio-dialog" ref={dialog} aria-labelledby="bio-form-title">
      <form ref={form} onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const name = text(data.get('name'));
        const company = text(data.get('company'));
        if (publicEnv.leadCapture) await submitLead({ name, company, interest, website: data.get('website'), source: 'link-bio' });
        window.location.assign(whatsappUrl(message(interest, name, company)));
      }}>
        <span className="bio-grip" aria-hidden="true" />
        <div className="bio-form-head">
          <h2 id="bio-form-title">Antes do WhatsApp, <em>só duas perguntas.</em></h2>
          {close(dialog)}
        </div>
        <label htmlFor="bio-name">Seu nome</label>
        <input id="bio-name" name="name" required maxLength={100} autoComplete="name" placeholder="Como podemos chamar você?" pattern=".*\S.*" />
        <label htmlFor="bio-company">Empresa ou projeto <span>(opcional)</span></label>
        <input id="bio-company" name="company" maxLength={150} autoComplete="organization" placeholder="Nome da sua empresa ou marca" />
        <fieldset>
          <legend>O que você quer proteger?</legend>
          <div className="bio-chips">{interests.map((value) => <label key={value}><input type="radio" name="interest" value={value} required checked={interest === value} onChange={() => setInterest(value)} /><span>{chip[value]}</span></label>)}</div>
        </fieldset>
        {publicEnv.leadCapture && <div className="form-trap" aria-hidden="true"><label htmlFor="bio-website">Não preencha este campo</label><input id="bio-website" name="website" tabIndex={-1} autoComplete="off" /></div>}
        <label className="bio-consent"><input type="checkbox" name="consent" required /><span>Autorizo a Velmont a usar esses dados para falar comigo, conforme a <a href="/privacidade" onClick={openPrivacy}>política de privacidade</a>.</span></label>
        <button className="bio-cta bio-submit" type="submit"><span>Continuar no WhatsApp</span><span className="bio-cta-arrow"><Arrow /></span></button>
        <p className="bio-legal">O WhatsApp abre com sua mensagem pronta. Você revisa e envia.</p>
      </form>
    </dialog>

    {/* Same facts as /privacidade, in the format of the bio page. */}
    <dialog className="bio-dialog bio-privacy" ref={privacy} aria-labelledby="bio-privacy-title">
      <div className="bio-privacy-body">
        <span className="bio-grip" aria-hidden="true" />
        <div className="bio-form-head">
          <h2 id="bio-privacy-title">Política de <em>privacidade.</em></h2>
          {close(privacy)}
        </div>
        <h3>Quem cuida dos seus dados</h3>
        <p>Velmont, Curitiba/PR. Contato: {contact.email} ou WhatsApp <span className="bio-nowrap">{contact.displayPhone}</span>.</p>
        <h3>O que coletamos</h3>
        <p>Quando você preenche o formulário: seu nome, a empresa ou o projeto (se informar) e o que você quer proteger. Também registramos de onde você chegou, como o Instagram, e os parâmetros de campanha do link, quando houver. Não guardamos seu endereço IP no cadastro.</p>
        <h3>Para quê</h3>
        <p>Responder você e dar sequência ao atendimento. Não usamos seus dados para publicidade e não vendemos nem repassamos a terceiros.</p>
        <h3>Onde ficam</h3>
        <p>{publicEnv.leadCapture ? 'Em um banco de dados protegido, acessível apenas à equipe da Velmont, e na conversa do WhatsApp, que segue as políticas do próprio WhatsApp.' : 'Apenas na conversa do WhatsApp, que segue as políticas do próprio WhatsApp. Esta página não guarda o que você preenche.'}{publicEnv.turnstileSiteKey && ' Para barrar envios automáticos, o formulário usa o Cloudflare Turnstile.'}</p>
        <h3>Cookies</h3>
        <p>Esta página não usa cookies de publicidade nem pixels de rastreamento. Durante a visita, o navegador guarda apenas de onde você chegou.</p>
        <h3>Seus direitos</h3>
        <p>Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento, pelo e-mail {contact.email}.</p>
        <a className="bio-privacy-more" href="/privacidade">Ver a política completa <Arrow /></a>
      </div>
    </dialog>
  </div>;
}
