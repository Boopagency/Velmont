'use client';
import { useEffect, useRef, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { contact } from '@/lib/site';
import { InsightCards } from './insight-cards';
import { Partners } from './partners';
import { Testimonials } from './testimonials';
import { BrandPerimeter, PatentScene, SoftwareScene } from './service-scenes';
import { FounderMedia } from './founder-media';

import { Arrow, Icon } from './icons';
const Tag = ({ n, children }: { n: string; children: React.ReactNode }) => <div className="eyebrow"><span>{n}</span><span>{children}</span></div>;
const CTA = ({ children = 'Solicitar uma análise estratégica', className = '' }: { children?: React.ReactNode; className?: string }) => <a className={`cta ${className}`} href="#contato"><span>{children}</span><span className="cta-arrow"><Arrow /></span></a>;
import { faqs } from '@/content/faqs';

export function Header({ inner = false }: { inner?: boolean }) {
  const [menu, setMenu] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); toggle.current?.focus(); } };
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
  }, [menu]);
  const root = inner ? '/' : '';
  return <>{inner && <a className="skip-link" href="#inicio">Pular para o conteúdo</a>}<header className={`site-header ${inner ? 'inner-header' : ''}`}>
    <a href={inner ? '/' : '#inicio'} className="logo" aria-label="Velmont — início"><img src="/images/velmont-logo.webp" width="140" height="70" alt="Velmont Marcas e Patentes" /></a>
    <nav className="desktop-nav" aria-label="Navegação principal"><a href={`${root}#atuacao`}>Atuação</a><a href={`${root}#essencia`}>Nossa essência</a><a href={`${root}#processo`}>Como atuamos</a><a href={`${root}#insights`}>Insights</a></nav>
    <a className="header-contact" href={`${root}#contato`}>Vamos conversar <Arrow /></a>
    <button ref={toggle} className="menu-toggle" aria-expanded={menu} aria-controls="mobile-menu" onClick={() => setMenu(!menu)}>{menu ? 'Fechar' : 'Menu'}<Icon name={menu ? 'close' : 'menu'} /></button>
    {menu && <nav id="mobile-menu" className="mobile-menu" aria-label="Navegação mobile">{[['Atuação','atuacao'],['Nossa essência','essencia'],['Como atuamos','processo'],['Insights','insights'],['Solicitar análise','contato']].map(([label,id],i) => <a key={id} href={`${root}#${id}`} onClick={() => setMenu(false)}><small>0{i+1}</small>{label}<Arrow /></a>)}</nav>}
  </header></>;
}

function Motion() {
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    let cleanup = () => {};
    const setup = () => {
      cleanup();
      if (query.matches) { document.documentElement.removeAttribute('data-motion'); return; }
      document.documentElement.dataset.motion = 'ready';
      const nodes = document.querySelectorAll<HTMLElement>('[data-reveal], [data-scene]');
      const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed', 'scene-visible'); observer.unobserve(e.target); } }), { threshold: .12 });
      nodes.forEach(n => observer.observe(n));
      const hero = document.querySelector<HTMLElement>('.hero');
      const story = document.querySelector<HTMLElement>('.story');
      let ticking = false; let frame = 0;
      const update = () => {
        const y = window.scrollY;
        if (hero && y < hero.offsetHeight + 100 && innerWidth > 767) hero.style.setProperty('--parallax', `${Math.min(y * .14, 100)}px`);
        if (story) {
          const bounds = story.getBoundingClientRect();
          const progress = Math.max(0, Math.min(1, (innerHeight * .7 - bounds.top) / (bounds.height * .85)));
          story.style.setProperty('--progress', `${progress}`);
          story.querySelectorAll('[data-step]').forEach((node,i) => node.classList.toggle('active', progress >= i * .28));
        }
        ticking = false;
      };
      const scroll = () => { if (!ticking) { ticking = true; frame = requestAnimationFrame(update); } };
      window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', scroll); update();
      cleanup = () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll); hero?.style.removeProperty('--parallax'); };
    };
    setup(); query.addEventListener('change', setup);
    return () => { cleanup(); query.removeEventListener('change', setup); document.documentElement.removeAttribute('data-motion'); };
  }, []);
  return null;
}

function ContactForm() {
  const [interest, setInterest] = useState<string | null>('Marcas');
  const [ready, setReady] = useState(false);
  const [url, setUrl] = useState('');
  return <form className="contact-form" onChange={() => setReady(false)} onSubmit={e => {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    const message = `Olá, Velmont! Gostaria de solicitar uma análise estratégica.\nNome: ${(data.get('name') as string).trim()}\nEmpresa ou projeto: ${((data.get('company') as string) || 'Ainda em estruturação').trim()}\nInteresse: ${interest || 'Preciso de orientação'}`;
    setUrl(`https://wa.me/${contact.phone}?text=${encodeURIComponent(message)}`); setReady(true);
  }}>
    <div className="form-title">Conte um pouco sobre o seu momento.</div>
    <label htmlFor="name">Seu nome <span>(obrigatório)</span></label><input id="name" name="name" required maxLength={100} autoComplete="name" placeholder="Como podemos chamar você?" pattern=".*\S.*" />
    <label htmlFor="company">Empresa ou projeto <span>(opcional)</span></label><input id="company" name="company" maxLength={150} autoComplete="organization" placeholder="O que você está construindo?" />
    <label id="interest-label" htmlFor="interest">O que você quer proteger?</label><Select value={interest} onValueChange={v => { setInterest(v); setReady(false); }}><SelectTrigger id="interest" aria-labelledby="interest-label" className="interest-select"><SelectValue /></SelectTrigger><SelectContent>{['Marcas','Patentes','Software','Outros ativos','Preciso de orientação'].map(v => <SelectItem value={v} key={v}>{v}</SelectItem>)}</SelectContent></Select>
    <p className="form-privacy">Os dados preparam sua mensagem. Você revisa e envia no WhatsApp. Nenhuma informação é enviada por este formulário. <a href="/privacidade">Privacidade</a></p>
    <button className="cta form-submit" type="submit"><span>Preparar minha conversa</span><span className="cta-arrow"><Arrow /></span></button>
    {ready && <output className="form-result" aria-live="polite"><p>Sua mensagem está pronta. Abra o WhatsApp, revise e envie para iniciar o atendimento.</p><a className="text-link" href={url} target="_blank" rel="noopener noreferrer">Continuar no WhatsApp <Arrow /></a></output>}
    <p className="form-alternative">Prefere e-mail? <a href={`mailto:${contact.email}`}>{contact.email}</a></p>
  </form>;
}

export function Footer() { return <footer className="footer wrap"><div className="footer-top"><a className="footer-logo" href="/" aria-label="Velmont início"><img src="/images/velmont-logo.webp" alt="Velmont" width="220" height="110" loading="lazy" /></a><p>Protegendo ideias.<br />Estruturando negócios.</p><div><a href={`mailto:${contact.email}`}>{contact.email}</a><a href={`https://wa.me/${contact.phone}`} target="_blank" rel="noopener noreferrer">{contact.displayPhone} <Arrow /></a><a href={contact.instagram} target="_blank" rel="noopener noreferrer">Instagram <Arrow /></a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Velmont. Todos os direitos reservados.</span><span>Curitiba, PR · Atendimento presencial e digital</span><a href="/privacidade">Privacidade</a><a href="#inicio">Voltar ao topo <Arrow direction="up" /></a></div></footer>; }

export function Home() {
  return <><a className="skip-link" href="#conteudo">Pular para o conteúdo</a><Motion />
    <section className="hero" id="inicio" aria-label="Velmont: marcas, patentes e software"><Header />
      <div className="hero-kicker">PROPRIEDADE INTELECTUAL · VISÃO ESTRATÉGICA</div>
      <h1 className="sr-only">Marca é patrimônio. Registro de marcas, patentes e software com a Velmont.</h1>
      <div className="hero-back" aria-hidden="true">MARCA É</div>
      <picture className="hero-mountain"><source media="(max-width: 767px)" srcSet="/generated/velmont-hero-mountain-768.webp" /><img src="/generated/velmont-hero-mountain-1536.webp" width="1536" height="1024" alt="" fetchPriority="high" /></picture>
      <div className="hero-shade" /><div className="hero-front" aria-hidden="true">PATRIMÔNIO<span className="hero-period">.</span></div>
      <p className="hero-side hero-side-left">MARCAS<br />PATENTES<br />SOFTWARE</p><p className="hero-side hero-side-right">Estratégia que protege<br />o que sua empresa<br />constrói.</p>
      <div className="hero-conversion"><p>Grandes ideias merecem<br />um futuro bem protegido.</p><CTA>Solicitar análise estratégica</CTA></div>
      <div className="hero-bottom"><a href="#conteudo" className="scroll-cue"><span className="scroll-cue-icon"><Arrow direction="down" /></span> Explore a Velmont</a><div className="hero-evidence"><strong>+11</strong><span>anos de experiência<br />da fundadora no setor</span><i /><span>Clareza para decidir.<br />Estratégia para crescer.</span></div></div>
    </section>
    <main id="conteudo">
      <section className="manifesto wrap" id="essencia"><Tag n="01">A ESSÊNCIA VELMONT</Tag><div className="manifesto-main"><h2 data-reveal>Você cria valor.<br />Nós pensamos em<br /><em>como protegê-lo.</em></h2><div className="manifesto-copy" data-reveal><span className="small-line" /><p>Por trás de uma marca, uma invenção ou um software, existe algo que levou tempo para ser construído.</p><p>A Velmont é uma consultoria em propriedade intelectual com base em Curitiba e atendimento presencial e digital. Orientamos empresas e empreendedores no registro de marcas, patentes e software, com análise de riscos e acompanhamento de cada etapa.</p><a className="text-link" href="#atuacao">Conheça nossa atuação <Arrow /></a></div></div></section>
      <section className="story wrap" aria-labelledby="story-title"><div className="story-intro"><span className="eyebrow">UM OUTRO OLHAR SOBRE O SEU NEGÓCIO</span><h2 id="story-title">O que começa como ideia<br />pode se tornar seu maior ativo.</h2></div><div className="story-words"><span data-step>IDEIA<span>01 / O ponto de partida</span></span><b aria-hidden="true"><Arrow /></b><span data-step>ESTRATÉGIA<span>02 / O caminho consciente</span></span><b aria-hidden="true"><Arrow /></b><span data-step>PATRIMÔNIO<span>03 / O valor que permanece</span></span></div><div className="story-track" aria-hidden="true"><span /></div></section>
      <section id="atuacao" className="services wrap"><div className="section-heading"><Tag n="02">O QUE PROTEGEMOS</Tag><h2 data-reveal>Seu próximo passo.<br /><em>Nossa visão estratégica.</em></h2></div>
        <article className="service service-brand" id="marcas"><div className="service-art" data-scene><BrandPerimeter /><img src="/generated/velmont-trademark-ownership-1000.webp" srcSet="/generated/velmont-trademark-ownership-640.webp 640w, /generated/velmont-trademark-ownership-1000.webp 1000w" sizes="(max-width: 767px) 100vw, 50vw" width="1000" height="1000" alt="Objeto de marca delimitado por um perímetro de propriedade, representação de proteção e exclusividade" loading="lazy" /><span className="art-caption">SUA MARCA. UM ATIVO A PROTEGER.</span><span className="art-number" aria-hidden="true">01</span></div><div className="service-copy" data-reveal><span className="eyebrow">MARCAS</span><h3>O nome é seu.<br /><em>E o direito de usá-lo?</em></h3><p>Sua marca carrega reputação, investimento e história. O primeiro passo é entender o que pode ser protegido e quais riscos precisam ser considerados.</p><ul className="service-list"><li>Pesquisa de anterioridade e viabilidade</li><li>Registro e estratégia de proteção</li><li>Monitoramento e acompanhamento</li></ul><CTA>Vamos falar sobre sua marca</CTA><a className="service-related" href="/insights/antes-de-registrar-sua-marca">Leia: o que analisar antes de registrar uma marca</a><p className="service-note">Toda solicitação está sujeita à análise do INPI. Clareza desde o início.</p></div></article>
        <article className="service service-patent" id="patentes"><div className="service-copy" data-reveal><span className="eyebrow">PATENTES & DESENHO INDUSTRIAL</span><h3>Você vê uma invenção.<br /><em>Nós vemos um ativo.</em></h3><p>Uma solução técnica ou um design podem representar uma vantagem importante para o negócio. Investigamos possibilidades de proteção antes de traçar o caminho.</p><ul className="service-list"><li>Patentes de invenção e modelos de utilidade</li><li>Busca de anterioridade e análise patentária</li><li>Desenho industrial e estratégia de proteção</li></ul><a className="text-link" href="#contato">Converse sobre sua criação <Arrow /></a><a className="service-related" href="/insights/inovacao-e-patente">Leia: da inovação à proteção por patente</a></div><PatentScene /></article>
        <article className="software" id="software"><div className="software-top"><span className="eyebrow">03 / SOFTWARE & TECNOLOGIA</span><span className="software-tag">O DIGITAL TAMBÉM É PATRIMÔNIO.</span></div><div className="software-grid"><h3>Não é só código.<br />É <em>valor construído.</em></h3><div><p>Seu software reúne conhecimento, tempo e investimento. A proteção também passa por autoria, titularidade e pelas relações de quem cria com você.</p><a className="text-link" href="#contato">Proteja seu ativo digital <Arrow /></a><a className="service-related" href="/insights/software-tambem-e-patrimonio">Leia: registro de software, autoria e titularidade</a></div></div><div className="software-asset"><SoftwareScene /><div className="software-layers" aria-label="Frentes de proteção do software"><div><span>01</span><strong>Código</strong><p>Registro de programa de computador</p></div><div><span>02</span><strong>Autoria</strong><p>Documentação de quem desenvolve</p></div><div><span>03</span><strong>Titularidade</strong><p>Contratos, cessão e licenciamento</p></div></div></div></article>
        <div className="other-services"><span>UM OLHAR INTEGRADO</span><p>Direitos autorais <i>/</i> Contratos e titularidade <i>/</i> Consultoria empresarial <i>/</i> Naming & identidade visual</p><a href="#contato" aria-label="Conversar sobre outras frentes de atuação"><Arrow /></a></div>
      </section>
      <section className="transparency" id="transparencia"><div className="wrap"><Tag n="03">NOSSO PRINCIPAL COMPROMISSO</Tag><div className="transparency-heading"><h2 data-reveal>Transparência.<br /><em>Antes de qualquer<br />promessa.</em></h2><div className="transparency-copy" data-reveal><span className="large-asterisk" aria-hidden="true">*</span><p>Não prometemos aprovação.<br />Construímos uma estratégia.</p><p>Você precisa entender os riscos, as etapas e as possibilidades reais. Inclusive quando a orientação mais responsável é repensar o caminho.</p><span className="signed">É ASSIM QUE A CONFIANÇA COMEÇA.</span></div></div><div className="transparency-principles"><span>Riscos explicados.</span><span>Decisões conscientes.</span><span>Acompanhamento próximo.</span></div></div></section>
      <section className="process wrap" id="processo"><div className="process-heading"><Tag n="04">COMO ATUAMOS</Tag><h2>Você entende<br /><em>cada próximo passo.</em></h2><p>Do primeiro diagnóstico ao acompanhamento, estratégia e clareza caminham juntas.</p><CTA>Começar uma conversa</CTA></div><ol className="process-list">{[['Escutar o seu negócio','Entendemos seu momento, seus objetivos e o que você já construiu.'],['Analisar o cenário','Pesquisamos possibilidades e identificamos os riscos que merecem atenção.'],['Definir a estratégia','Alinhamos prioridades, escopo e caminhos possíveis com você.'],['Conduzir os próximos passos','Organizamos a execução de acordo com a estratégia e o serviço contratado.'],['Acompanhar a evolução','Mantemos a proximidade e orientamos as decisões ao longo do caminho.']].map(([title,text],i) => <li key={title} data-reveal><span>0{i+1}</span><div><h3>{title}</h3><p>{text}</p></div><Arrow /></li>)}</ol></section>
      <section className="trust wrap" id="depoimentos"><div className="section-heading trust-heading"><Tag n="05">RELAÇÕES CONSTRUÍDAS</Tag><h2>Confiança não se vende.<br /><em>Se constrói.</em></h2></div><Testimonials /><Partners /></section>
      <section className="founders wrap" id="fundadoras"><div className="section-heading"><Tag n="06">QUEM ESTÁ AO SEU LADO</Tag><h2>Duas trajetórias.<br /><em>Um mesmo inconformismo.</em></h2><p>A Velmont nasceu para fazer diferente: menos promessas genéricas, mais cuidado com o que importa para você.</p></div><div className="founders-grid"><article className="founder" data-reveal><div className="portrait portrait-danielle"><img src="/images/danielle-velmont-1024.webp" srcSet="/images/danielle-velmont-640.webp 640w, /images/danielle-velmont-1024.webp 1024w" sizes="(max-width: 767px) 100vw, 45vw" alt="Danielle Cubas de Azevedo, cofundadora da Velmont" width="1024" height="1536" loading="lazy" /><span>ESTRATÉGIA & VISÃO DE NEGÓCIO</span></div><div className="founder-title"><h3>Danielle Cubas<br />de Azevedo</h3><span>FOUNDER & CEO</span></div><p>Economista, com pós-graduação em Propriedade Intelectual e Direito Digital e mais de 11 anos de atuação no setor. Clareza, responsabilidade e visão de negócio em cada orientação.</p></article><article className="founder founder-lisandra" data-reveal><div className="portrait portrait-lisandra"><img src="/images/lisandra-velmont-1024.webp" srcSet="/images/lisandra-velmont-640.webp 640w, /images/lisandra-velmont-1024.webp 1024w" sizes="(max-width: 767px) 100vw, 45vw" alt="Lisandra Ferreira dos Santos, cofundadora da Velmont" width="1024" height="1536" loading="lazy" /><span>PROPRIEDADE INTELECTUAL & SEGURANÇA JURÍDICA</span></div><div className="founder-title"><h3>Lisandra Ferreira<br />dos Santos</h3><span>FOUNDER & CEO</span></div><p>Advogada e especialista em Propriedade Industrial e Intelectual. Uma atuação orientada por segurança jurídica, gestão responsável e pelo cuidado real com cada cliente.</p></article></div><FounderMedia /></section>
      <section id="insights" className="insights wrap"><div className="section-heading"><Tag n="07">CONHECIMENTO PARA DECIDIR</Tag><h2>Clareza também<br /><em>é uma forma de proteção.</em></h2><a href="/insights" className="text-link">Todos os insights <Arrow /></a></div><InsightCards /></section>
      <section className="faq wrap" id="perguntas"><div><Tag n="08">SEM JURIDIQUÊS</Tag><h2>Perguntas reais.<br /><em>Respostas claras.</em></h2></div><Accordion className="faq-list" multiple={false} keepMounted>{faqs.map(([q,a],i) => <AccordionItem value={`faq-${i}`} key={q}><AccordionTrigger id={`faq-question-${i}`} aria-controls={`faq-answer-${i}`}>{q}</AccordionTrigger><AccordionContent id={`faq-answer-${i}`} aria-labelledby={`faq-question-${i}`}><p>{a}</p></AccordionContent></AccordionItem>)}</Accordion></section>
      <section id="contato" className="contact"><div className="wrap contact-grid"><div><Tag n="09">O PRÓXIMO PASSO É SEU</Tag><h2>Vamos proteger<br />o que você<br /><em>está construindo?</em></h2><p className="contact-intro">Tudo começa com uma conversa.<br />Sem promessas prontas. Com atenção ao seu negócio.</p><div className="contact-details"><span>FALE COM A VELMONT</span><a href={`https://wa.me/${contact.phone}`} target="_blank" rel="noopener noreferrer">{contact.displayPhone} <Arrow /></a><p>Av. Iguaçu, 2820 · Água Verde<br />Curitiba, PR · Atendimento com agendamento</p></div></div><ContactForm /><noscript><style>{".contact-form{display:none}.menu-toggle{display:none}"}</style><p>Para solicitar sua análise, <a className="text-link" href={`https://wa.me/${contact.phone}`}>converse com a Velmont no WhatsApp <Arrow /></a>.</p></noscript></div></section>
    </main><Footer /></>;
}
