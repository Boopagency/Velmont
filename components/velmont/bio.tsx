import { contact, whatsappUrl } from '@/lib/site';
import { publicEnv } from '@/lib/public-env';
import { bioMessage, chip, interests, steps, type Interest } from '@/content/bio';
import { googleReviewsUrl, testimonials } from '@/content/testimonials';
import { partners } from '@/content/partners';
import { Arrow, Icon } from './icons';

// Link in the Instagram bio (/links). Prerendered without React on the client:
// bio-client.ts opens the form and the privacy sheet, records the lead as
// source "link-bio" (Leads > Origem in the panel) and continues on WhatsApp.
// Without JavaScript the buttons open WhatsApp and "Privacidade" opens /privacidade.

const review = testimonials.find((t) => t.id === 'fernanda-reis')!;
// Small copies of the partner marks (public/images/clients/sm, 240 px wide).
const logos = partners.slice(0, 8).map((p) => ({ ...p, src: p.src.replace('/clients/', '/clients/sm/') }));

const action = (value: Interest | null, label: string, ghost = false) =>
  <a className={`bio-cta${ghost ? ' bio-cta-ghost' : ''}`} href={whatsappUrl(bioMessage(value))} target="_blank" rel="noopener noreferrer" data-interest={value ?? ''}><span>{label}</span><span className="bio-cta-arrow"><Arrow /></span></a>;
const close = <button type="button" className="bio-close" aria-label="Fechar" data-close><Icon name="close" /></button>;

export function BioPage() {
  return <div className="bio">
    <a className="skip-link" href="#bio-conteudo">Pular para o conteúdo</a>
    <header className="bio-top">
      <picture className="bio-mountain">
        <source media="(min-width: 1024px)" srcSet="/generated/velmont-hero-mountain-768.webp 768w, /generated/velmont-hero-mountain-1536.webp 1536w" sizes="50vw" />
        <img src="/generated/velmont-hero-mountain-720.webp" width="720" height="480" alt="" fetchPriority="high" />
      </picture>
      <a className="bio-logo" href="/" aria-label="Velmont: conheça o site"><img src="/images/velmont-logo-240.webp" srcSet="/images/velmont-logo-240.webp 240w, /images/velmont-logo-320.webp 320w" sizes="(min-width: 1024px) 150px, 112px" width="240" height="120" alt="Velmont Marcas e Patentes" /></a>
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

      <figure className="bio-review">
        <span className="bio-stars"><span className="sr-only">{review.rating} de 5 estrelas</span>{Array.from({ length: review.rating }, (_, i) => <Icon name="star" key={i} />)}</span>
        <blockquote>{review.quote}</blockquote>
        <figcaption><strong>{review.name}</strong> · Avaliação no Google</figcaption>
        <a href={googleReviewsUrl} target="_blank" rel="noopener noreferrer">Ver avaliações no Google <Arrow /></a>
      </figure>

      <section className="bio-founder" aria-labelledby="bio-founder-title">
        <h2 id="bio-founder-title" className="bio-kicker">Quem está à frente</h2>
        <p className="bio-founder-name">Danielle Cubas de Azevedo</p>
        <p>Fundadora da Velmont. Economista, pós-graduada em Propriedade Intelectual e Direito Digital, com mais de 11 anos no setor.</p>
      </section>

      <section className="bio-clients" aria-labelledby="bio-clients-title">
        <h2 id="bio-clients-title" className="bio-kicker">Parceiros da nossa história</h2>
        <div className="bio-marquee">
          {[0, 1].map((copy) => <ul key={copy} aria-hidden={copy === 1 || undefined}>{logos.map(({ name, src }) => <li key={src}><img src={src} alt={copy ? '' : name} width="240" height="135" loading="lazy" decoding="async" /></li>)}</ul>)}
        </div>
      </section>
    </main>

    <footer className="bio-footer"><a href={contact.instagram} target="_blank" rel="noopener noreferrer">@velmontmarcas</a><a href="/">Site da Velmont</a><a href="/privacidade" data-privacy>Privacidade</a></footer>

    <dialog className="bio-dialog" id="bio-lead" aria-labelledby="bio-form-title">
      <form>
        <span className="bio-grip" aria-hidden="true" />
        <div className="bio-form-head"><h2 id="bio-form-title">Antes do WhatsApp, <em>só duas perguntas.</em></h2>{close}</div>
        <label htmlFor="bio-name">Seu nome</label>
        <input id="bio-name" name="name" required maxLength={100} autoComplete="name" placeholder="Como podemos chamar você?" pattern=".*\S.*" />
        <label htmlFor="bio-company">Empresa ou projeto <span>(opcional)</span></label>
        <input id="bio-company" name="company" maxLength={150} autoComplete="organization" placeholder="Nome da sua empresa ou marca" />
        <fieldset>
          <legend>O que você quer proteger?</legend>
          <div className="bio-chips">{interests.map((value) => <label key={value}><input type="radio" name="interest" value={value} required /><span>{chip[value]}</span></label>)}</div>
        </fieldset>
        {publicEnv.leadCapture && <div className="form-trap" aria-hidden="true"><label htmlFor="bio-website">Não preencha este campo</label><input id="bio-website" name="website" tabIndex={-1} autoComplete="off" /></div>}
        <label className="bio-consent"><input type="checkbox" name="consent" required /><span>Autorizo a Velmont a usar esses dados para falar comigo, conforme a <a href="/privacidade" data-privacy>política de privacidade</a>.</span></label>
        <button className="bio-cta bio-submit" type="submit"><span>Continuar no WhatsApp</span><span className="bio-cta-arrow"><Arrow /></span></button>
        <p className="bio-legal">O WhatsApp abre com sua mensagem pronta. Você revisa e envia.</p>
      </form>
    </dialog>

    {/* Same facts as /privacidade, in the format of the bio page. */}
    <dialog className="bio-dialog bio-privacy" id="bio-privacy" aria-labelledby="bio-privacy-title">
      <div className="bio-privacy-body">
        <span className="bio-grip" aria-hidden="true" />
        <div className="bio-form-head"><h2 id="bio-privacy-title">Política de <em>privacidade.</em></h2>{close}</div>
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
