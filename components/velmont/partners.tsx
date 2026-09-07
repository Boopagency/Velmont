'use client';
import { Icon } from './icons';
import { useEffect, useRef, useState } from 'react';
const partners = [
  ['rfg', 'RFG Info Tech'], ['unimares', 'Unimares'],
  ['michelle-lima', 'Michelle Lima'], ['idmove', 'IDmove'],
  ['quimitec', 'Quimitec'], ['arte-em-foto', 'Arte em Foto — Denise Faria'],
];
export function Partners() {
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    if (section.current) observer.observe(section.current);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  return <section className="partner-section" id="parceiros" aria-labelledby="partners-title" ref={section} data-paused={paused || !inView || !pageVisible}>
    <div className="partners-heading">
      <div><span className="eyebrow">RELAÇÕES QUE DEIXAM MARCA</span><h3 id="partners-title">Parceiros da nossa história.</h3></div>
      <button type="button" className="marquee-control" aria-controls="partner-marquee" onClick={() => setPaused(!paused)}>
        <Icon name={paused ? 'play' : 'pause'} />{paused ? 'Retomar movimento' : 'Pausar movimento'}
      </button>
    </div>
    <div className="partner-marquee" id="partner-marquee">
      <div className="partner-track">
        {[0, 1].map(copy => <ul className="partner-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
          {partners.map(([file, name]) => <li key={file}><img src={`/images/partner-${file}.webp`} alt={copy === 0 ? name : ''} width="220" height="110" loading="lazy" decoding="async" /></li>)}
        </ul>)}
      </div>
    </div>
  </section>;
}
