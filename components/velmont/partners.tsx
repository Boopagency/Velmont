'use client';
import { Arrow, Icon } from './icons';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { partners } from '@/content/partners';
// Two rows drifting in opposite directions, each logo listed once.
const half = Math.ceil(partners.length / 2);
const rows = [partners.slice(0, half), partners.slice(half)];
export function Partners() {
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const section = useRef<HTMLElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    if (section.current) observer.observe(section.current);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const toggleAll = () => {
    if (expanded) {
      // Collapsing from the bottom of the grid brings the section back into view; focus returns to "Ver todos".
      if (section.current && section.current.getBoundingClientRect().top < 0) section.current.scrollIntoView();
      more.current?.focus({ preventScroll: true });
    }
    setExpanded(!expanded);
  };
  return <section className="partner-section" id="parceiros" aria-labelledby="partners-title" ref={section} data-paused={paused || !inView || !pageVisible} data-expanded={expanded}>
    <div className="partners-heading">
      <div><span className="eyebrow">RELAÇÕES QUE DEIXAM MARCA</span><h3 id="partners-title">Parceiros da nossa história.</h3></div>
      {/* While every logo is shown, the movement control becomes a second "Recolher" at the top of the grid. */}
      <button type="button" className="marquee-control" aria-controls="partner-marquee" aria-expanded={expanded ? true : undefined} onClick={expanded ? toggleAll : () => setPaused(!paused)}>
        {expanded ? <><Icon name="collapse" />Recolher</> : <><Icon name={paused ? 'play' : 'pause'} />{paused ? 'Retomar movimento' : 'Pausar movimento'}</>}
      </button>
    </div>
    <div className="partner-marquee" id="partner-marquee">
      {rows.map((row, r) => <div className="partner-row" key={r} style={{ '--partner-count': row.length } as CSSProperties}>
        {[0, 1].map(copy => <ul className="partner-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
          {row.map(({ name, src }) => <li key={src}><img src={src} alt={copy === 0 ? name : ''} width="640" height="360" loading="lazy" decoding="async" /></li>)}
        </ul>)}
      </div>)}
    </div>
    <div className="partners-more">
      <button type="button" className="text-link partners-toggle" ref={more} aria-expanded={expanded} aria-controls="partner-marquee" onClick={toggleAll}>
        {expanded ? 'Recolher' : 'Ver todos'} <Arrow direction={expanded ? 'up' : 'down'} />
      </button>
    </div>
  </section>;
}
