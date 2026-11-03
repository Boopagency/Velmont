'use client';
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { contact, whatsappUrl } from '@/lib/site';
import { publicEnv } from '@/lib/public-env';
import { prepareLeadProtection, submitLead } from '@/lib/lead-capture';
import { Arrow, Icon } from './icons';

// Link in the Instagram bio (/links). One or two actions at most: each opens a
// two-question form; the answers go to /api/leads as source "link-bio" (Leads >
// Origem in the panel) and the conversation continues on WhatsApp. Without
// JavaScript the buttons open WhatsApp directly.

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

export type BioVariant = 'a' | 'b' | 'c';

export function BioPage({ variant = 'a' }: { variant?: BioVariant }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [interest, setInterest] = useState<Interest | null>('Marcas');
  const [tab, setTab] = useState<'marca' | 'criacao'>('marca');
  // A fixed button keeps the main action on screen until the page's own buttons are in view.
  const [dock, setDock] = useState(false);
  useEffect(() => {
    if (variant === 'c') return;
    const observer = new IntersectionObserver(() => setDock(![...document.querySelectorAll('.bio-content .bio-actions')].some((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.top < innerHeight && r.bottom > 0; })));
    document.querySelectorAll('.bio-content .bio-actions').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [variant, tab]);

  const open = (event: MouseEvent, value: Interest | null) => {
    event.preventDefault();
    setInterest(value);
    dialog.current?.showModal();
    // Turnstile starts while the person types, so the hand-off does not wait for it.
    if (form.current) prepareLeadProtection(form.current);
  };
  const action = (value: Interest | null, label: string, line = false) =>
    <a className={`cta bio-cta${line ? ' bio-cta-line' : ''}`} href={whatsappUrl(message(value))} target="_blank" rel="noopener noreferrer" onClick={(e) => open(e, value)}><span>{label}</span><span className="cta-arrow"><Arrow /></span></a>;
  const tabKeys = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = tab === 'marca' ? 'criacao' : 'marca';
    setTab(next);
    document.getElementById(`bio-tab-${next}`)?.focus();
  };

  return <div className={`bio bio-${variant}`}>
    <a className="skip-link" href="#bio-conteudo">Pular para o conteúdo</a>
    <header className="bio-media">
      <img className="bio-photo" src="/images/danielle.webp" width="876" height="1600" alt="Danielle Cubas de Azevedo, fundadora da Velmont" fetchPriority="high" />
      <span className="bio-frame" aria-hidden="true" />
      <p className="bio-sign"><span>Danielle Cubas<br />de Azevedo</span><small>FOUNDER &amp; CEO · VELMONT</small></p>
    </header>

    <main id="bio-conteudo" className="bio-content">
      <div className="bio-row"><span>Marcas · Patentes · Software</span><img src="/images/velmont-logo.webp" width="140" height="70" alt="Velmont" /></div>

      {variant === 'a' && <>
        <h1>Sua marca é <em>patrimônio.</em></h1>
        <p className="bio-lead">Registro de marcas, patentes e software com estratégia: você entende os riscos e cada etapa antes de decidir.</p>
        <div className="bio-actions">{action('Marcas', 'Quero registrar minha marca')}{action(null, 'Quero proteger outra criação', true)}</div>
      </>}

      {variant === 'b' && <>
        <h1 className="sr-only">Velmont: registro de marcas, patentes e software</h1>
        <ul className="bio-stats" aria-label="A Velmont em números">
          <li><strong>+11</strong><span>anos da fundadora no setor</span></li>
          <li><strong>3</strong><span>frentes: marca, patente e software</span></li>
          <li><strong>Curitiba</strong><span>presencial e digital</span></li>
        </ul>
        <div className="bio-switch" role="tablist" aria-label="O que você quer proteger" data-tab={tab}>
          <span className="bio-switch-thumb" aria-hidden="true" />
          {([['marca', 'Tenho uma marca'], ['criacao', 'Tenho uma criação']] as const).map(([id, label]) => <button key={id} type="button" role="tab" id={`bio-tab-${id}`} aria-controls={`bio-panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={tabKeys}>{label}</button>)}
        </div>
        <section className="bio-panel" role="tabpanel" id="bio-panel-marca" aria-labelledby="bio-tab-marca" hidden={tab !== 'marca'}>
          <h2>O nome é seu. <em>E o direito de usá-lo?</em></h2>
          <p className="bio-lead">Antes do pedido, a pesquisa de viabilidade mostra o que pode ser protegido e quais riscos considerar.</p>
          <div className="bio-actions">{action('Marcas', 'Quero registrar minha marca')}</div>
        </section>
        <section className="bio-panel" role="tabpanel" id="bio-panel-criacao" aria-labelledby="bio-tab-criacao" hidden={tab !== 'criacao'}>
          <h2>Você vê uma invenção. <em>Nós vemos um ativo.</em></h2>
          <p className="bio-lead">Patente, desenho industrial ou software: primeiro entendemos o que proteger, depois traçamos o caminho.</p>
          <div className="bio-actions">{action(null, 'Quero proteger minha criação')}</div>
        </section>
      </>}

      {variant === 'c' && <>
        <h1>Sua marca é <em>patrimônio.</em></h1>
        <div className="bio-actions">{action('Marcas', 'Quero proteger minha marca')}<a className="bio-more" href="/">Ou conheça a Velmont <Arrow /></a></div>
      </>}

      <p className="bio-note">Leva menos de 30 segundos. Depois a conversa segue no WhatsApp.</p>
    </main>

    {variant !== 'c' && <div className="bio-dock" data-show={dock} inert={!dock}>{tab === 'criacao' ? action(null, 'Quero proteger minha criação') : action('Marcas', 'Quero registrar minha marca')}</div>}

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
        <button className="cta bio-submit" type="submit"><span>Continuar no WhatsApp</span><span className="cta-arrow"><Arrow /></span></button>
        <p className="bio-legal">O WhatsApp abre com sua mensagem pronta; você revisa e envia.{publicEnv.leadCapture && ' Registramos nome, empresa e interesse para dar sequência ao atendimento.'} <a href="/privacidade">Privacidade</a></p>
      </form>
    </dialog>
  </div>;
}
