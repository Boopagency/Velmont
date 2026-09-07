'use client';
import { useRef, useState } from 'react';
import { testimonials, googleReviewsUrl } from '@/content/testimonials';
import { Arrow, Icon } from './icons';
export function Testimonials() {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  function goTo(index: number) {
    const el = track.current;
    const card = el?.children[index] as HTMLElement | undefined;
    if (!el || !card) return;
    el.scrollTo({ left: card.offsetLeft - (el.children[0] as HTMLElement).offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    setActive(index);
  }
  return <div className="testimonials-block">
    <div className="testimonial-track" id="testimonial-cards" ref={track} onScroll={() => {
      const el = track.current;
      if (!el) return;
      const first = el.children[0] as HTMLElement;
      const second = el.children[1] as HTMLElement | undefined;
      if (second) setActive(Math.max(0, Math.min(testimonials.length - 1, Math.round(el.scrollLeft / (second.offsetLeft - first.offsetLeft)))));
    }}>
      {testimonials.map(item => <article className="testimonial-card" key={item.id} aria-label={`Depoimento de ${item.name}`}>
        <div className="testimonial-surface">
          <div className="testimonial-card-top"><svg className="testimonial-quote" viewBox="0 0 48 40" width="48" height="40" aria-hidden="true"><path d="M3 36V20C3 9 8 3 19 2v8c-5 1-7 4-7 8h9v18H3zm26 0V20C29 9 34 3 45 2v8c-5 1-7 4-7 8h9v18H29z" fill="currentColor" /></svg><span className="testimonial-stars"><span className="sr-only">{item.rating} de 5 estrelas</span>{Array.from({ length: item.rating }, (_, i) => <Icon name="star" key={i} />)}</span></div>
          <blockquote>{item.quote}</blockquote>
        </div>
        <div className="testimonial-person"><span className="testimonial-avatar" aria-hidden="true">{item.name.split(' ').map(word => word[0]).slice(0,2).join('')}</span><div><strong>{item.name}</strong><span>Avaliação no Google</span></div></div>
      </article>)}
    </div>
    <div className="testimonial-pagination" aria-label="Escolher depoimento">{testimonials.map((item,index) => <button key={item.id} type="button" aria-label={`Mostrar depoimento de ${item.name}`} aria-current={index === active ? 'true' : undefined} aria-controls="testimonial-cards" onClick={() => goTo(index)}><span /></button>)}</div>
    <div className="reviews-source"><a className="text-link" href={googleReviewsUrl} target="_blank" rel="noopener noreferrer">Ver avaliações no Google <Arrow /></a></div>
  </div>;
}
