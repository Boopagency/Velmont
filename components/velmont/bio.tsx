'use client';
import { useRef, useState, type MouseEvent } from 'react';
import { contact, whatsappUrl } from '@/lib/site';
import { publicEnv } from '@/lib/public-env';
import { prepareLeadProtection, submitLead } from '@/lib/lead-capture';
import { Arrow, Icon } from './icons';

// Link in the Instagram bio (/links). Two actions: each opens a two-question
// form; the answers go to /api/leads as source "link-bio" (Leads > Origem in the
// panel) and the conversation continues on WhatsApp. Without JavaScript the
// buttons open WhatsApp directly.

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
const message = (interest: Interest | null, name?: string, company?: string) =>
  [`Olá, Velmont! Vim pelo Instagram e ${phrase[interest || 'Preciso de orientação']}.`, ...(name ? [`Nome: ${name}`, `Empresa ou projeto: ${company || 'Ainda em estruturação'}`, `Interesse: ${interest || 'Preciso de orientação'}`] : [])].join('\n');
const text = (value: FormDataEntryValue | null) => (typeof value === 'string' ? value.trim() : '');

export function BioPage() {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [interest, setInterest] = useState<Interest | null>('Marcas');

  const open = (event: MouseEvent, value: Interest | null) => {
    event.preventDefault();
    setInterest(value);
    dialog.current?.showModal();
    // Turnstile starts while the person types, so the hand-off does not wait for it.
    if (form.current) prepareLeadProtection(form.current);
  };
  const action = (value: Interest | null, label: string, ghost = false) =>
    <a className={`bio-cta${ghost ? ' bio-cta-ghost' : ''}`} href={whatsappUrl(message(value))} target="_blank" rel="noopener noreferrer" onClick={(e) => open(e, value)}><span>{label}</span><span className="bio-cta-arrow"><Arrow /></span></a>;

  return <div className="bio">
    <a className="skip-link" href="#bio-conteudo">Pular para o conteúdo</a>
    <header className="bio-top">
      <img className="bio-mountain" src="/generated/velmont-hero-mountain-768.webp" width="768" height="512" alt="" fetchPriority="high" />
      <a className="bio-logo" href="/" aria-label="Velmont: conheça o site"><img src="/images/velmont-logo.webp" width="140" height="70" alt="Velmont Marcas e Patentes" /></a>
    </header>

    <main id="bio-conteudo" className="bio-main">
      <p className="bio-kicker">Marcas · Patentes · Software</p>
      <h1>Marca é <em>patrimônio.</em></h1>
      <p className="bio-lead">Proteja o que você está construindo, com estratégia e cada etapa explicada.</p>
      <div className="bio-actions">
        {action('Marcas', 'Quero registrar minha marca')}
        {action(null, 'Quero proteger outra criação', true)}
      </div>
      <p className="bio-note">Leva 30 segundos. A conversa segue no WhatsApp.</p>
      <ul className="bio-facts" aria-label="Sobre a Velmont">
        <li><strong>+11 anos</strong>da fundadora no setor</li>
        <li><strong>Curitiba</strong>presencial e digital</li>
      </ul>
    </main>

    <footer className="bio-footer"><a href={contact.instagram} target="_blank" rel="noopener noreferrer">@velmontmarcas</a><a href="/">Site</a><a href="/privacidade">Privacidade</a></footer>

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
          <button type="button" className="bio-close" aria-label="Fechar" onClick={() => dialog.current?.close()}><Icon name="close" /></button>
        </div>
        <label htmlFor="bio-name">Seu nome</label>
        <input id="bio-name" name="name" required maxLength={100} autoComplete="name" placeholder="Como podemos chamar você?" pattern=".*\S.*" />
        <label htmlFor="bio-company">Empresa ou projeto <span>(opcional)</span></label>
        <input id="bio-company" name="company" maxLength={150} autoComplete="organization" placeholder="O que você está construindo?" />
        <fieldset>
          <legend>O que você quer proteger?</legend>
          <div className="bio-chips">{interests.map((value) => <label key={value}><input type="radio" name="interest" value={value} required checked={interest === value} onChange={() => setInterest(value)} /><span>{chip[value]}</span></label>)}</div>
        </fieldset>
        {publicEnv.leadCapture && <div className="form-trap" aria-hidden="true"><label htmlFor="bio-website">Não preencha este campo</label><input id="bio-website" name="website" tabIndex={-1} autoComplete="off" /></div>}
        <button className="bio-cta bio-submit" type="submit"><span>Continuar no WhatsApp</span><span className="bio-cta-arrow"><Arrow /></span></button>
        <p className="bio-legal">O WhatsApp abre com sua mensagem pronta; você revisa e envia.{publicEnv.leadCapture && ' Registramos nome, empresa e interesse para dar sequência ao atendimento.'} <a href="/privacidade">Privacidade</a></p>
      </form>
    </dialog>
  </div>;
}
