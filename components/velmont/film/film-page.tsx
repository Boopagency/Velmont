import { Header, Footer } from '@/components/velmont/home';
import { Breadcrumbs } from '@/components/velmont/breadcrumbs';
import { Arrow } from '@/components/velmont/icons';
import { whatsappUrl } from '@/lib/site';
import { closingLine, narration } from './narration';
import { FilmPlayer } from './film-player';

export function FilmPage() {
  return <>
    <Header inner />
    <main className="film-page" id="inicio">
      <div className="wrap">
        <Breadcrumbs current="Filme" />
        <div className="film-head">
          <span className="eyebrow">FILME</span>
          <h1>Relevo</h1>
          <p>Um filme curto sobre aquilo que um negócio constrói, e sobre o que nem sempre aparece à primeira vista.</p>
        </div>
      </div>
      <div className="film-frame">
        <FilmPlayer />
        <noscript><p className="film-note">O filme é desenhado no navegador e precisa de JavaScript. A narração completa está logo abaixo.</p></noscript>
      </div>
      <div className="wrap film-after">
        <section className="film-transcript" aria-labelledby="narracao">
          <h2 id="narracao" className="eyebrow">NARRAÇÃO</h2>
          <div>{narration.map(line => <p key={line.id}>{line.text}</p>)}</div>
        </section>
        <aside className="film-cta">
          <p>{closingLine}</p>
          <a className="text-link" href={whatsappUrl('Olá, Velmont! Assisti ao filme e quero conversar sobre o que estou construindo.')} target="_blank" rel="noopener noreferrer">Conversar com a Velmont <Arrow /></a>
        </aside>
      </div>
    </main>
    <Footer />
  </>;
}
