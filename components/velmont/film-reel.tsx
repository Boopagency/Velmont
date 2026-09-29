import { useEffect, useRef, useState } from 'react';
import { whatsappUrl } from '@/lib/site';
import { narration } from './film/narration';
import { Arrow, Icon } from './icons';

// Relevo on the home page: the approved film file, played as it is. Scroll only
// moves the card (entrance, a short hold, exit); it never drives the film's time.
const film = {
  hd: '/film/relevo-1080p.mp4',
  sd: '/film/relevo-720p.mp4',
  poster: '/film/relevo-poster-1920.webp',
  posterSmall: '/film/relevo-poster-960.webp',
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);
const easeIn = (v: number) => v * v;

export function FilmReel() {
  const section = useRef<HTMLElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const userPaused = useRef(false);
  const heard = useRef(false);
  const visible = useRef(0);

  // Scroll choreography: two numbers for CSS, --reel-in (0 → 1 as the card rises
  // into place) and --reel-out (0 → 1 as it leaves). Off with reduced motion.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, queued = false;
    const update = () => {
      queued = false;
      if (reduce.matches) { el.style.removeProperty('--reel-in'); el.style.removeProperty('--reel-out'); return; }
      const r = el.getBoundingClientRect(), vh = innerHeight;
      if (r.bottom < -vh || r.top > vh * 2) return;
      const compact = innerWidth < 768;
      const into = clamp01((vh - r.top) / (compact ? vh * 0.7 : vh));
      const away = compact ? 0 : clamp01((vh - r.bottom) / (vh * 0.9));
      el.style.setProperty('--reel-in', easeOut(into).toFixed(4));
      el.style.setProperty('--reel-out', easeIn(away).toFixed(4));
    };
    const schedule = () => { if (!queued) { queued = true; frame = requestAnimationFrame(update); } };
    update();
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    reduce.addEventListener('change', schedule);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
      reduce.removeEventListener('change', schedule);
    };
  }, []);

  // Loading: nothing is fetched before the page has finished loading (the hero
  // keeps its bandwidth); then the file is attached as the section approaches.
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setAutoplay(!saveData && !reduce);
    let near: IntersectionObserver | null = null;
    const attach = () => {
      near = new IntersectionObserver(entries => {
        if (!entries.some(e => e.isIntersecting)) return;
        setSource(innerWidth <= 900 || saveData ? film.sd : film.hd);
        near?.disconnect();
      }, { rootMargin: '0px 0px 60% 0px' });
      near.observe(el);
    };
    if (document.readyState === 'complete') attach(); else addEventListener('load', attach, { once: true });
    return () => { removeEventListener('load', attach); near?.disconnect(); };
  }, []);

  useEffect(() => { if (source) video.current?.load(); }, [source]);
  // Muted before any play() call, whatever the server markup carried.
  useEffect(() => { if (video.current) video.current.muted = true; }, []);

  // Visibility: play (muted) when half the card is on screen, pause when it has
  // practically left, resume where it stopped when the visitor comes back.
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const io = new IntersectionObserver(entries => {
      const v = video.current;
      for (const entry of entries) {
        visible.current = entry.intersectionRatio;
        if (!v) continue;
        if (entry.intersectionRatio > 0 && v.preload !== 'auto') v.preload = 'auto';
        if (entry.intersectionRatio >= 0.5 && autoplay && !userPaused.current && !v.ended && v.paused && v.currentSrc) void v.play().catch(() => {});
        if (entry.intersectionRatio < 0.15 && !v.paused) v.pause();
      }
    }, { threshold: [0, 0.15, 0.5, 0.75] });
    io.observe(el);
    return () => io.disconnect();
  }, [autoplay, source]);

  const play = () => {
    const v = video.current;
    if (!v) return;
    userPaused.current = false;
    if (!v.currentSrc) setSource(innerWidth <= 900 ? film.sd : film.hd);
    void v.play().catch(() => {});
  };
  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) play(); else { userPaused.current = true; v.pause(); }
  };
  const replay = () => {
    const v = video.current;
    if (!v) return;
    v.currentTime = 0;
    setEnded(false);
    play();
  };
  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    if (!v.muted) { v.muted = true; setMuted(true); return; }
    v.muted = false;
    setMuted(false);
    // The first time the sound is turned on, the film starts over: its narration
    // only makes sense from the first line.
    if (!heard.current) {
      heard.current = true;
      if (v.currentTime > 4 || v.ended) v.currentTime = 0;
      setEnded(false);
    }
    if (v.paused) play();
  };

  return (
    <section ref={section} className="reel" aria-labelledby="reel-title">
      <div className="reel-stage">
        <div className="reel-frame">
          <div className="reel-meta">
            <span className="eyebrow" id="reel-title"><span>FILME</span>UM FILME SOBRE O QUE VOCÊ ESTÁ CONSTRUINDO</span>
            <span className="reel-length" aria-hidden="true">RELEVO · 1:20</span>
          </div>
          <div ref={card} className={`reel-card${started ? ' is-live' : ''}${playing ? ' is-playing' : ''}${ended ? ' is-ended' : ''}`}>
            <video
              ref={video}
              className="reel-video"
              muted={muted}
              playsInline
              preload={source ? 'metadata' : 'none'}
              disablePictureInPicture
              aria-label="Relevo, filme da Velmont"
              aria-describedby="reel-narration"
              onCanPlay={e => { const v = e.currentTarget; if (visible.current >= 0.5 && autoplay && !userPaused.current && v.paused && !v.ended) void v.play().catch(() => {}); }}
              onPlay={() => { setPlaying(true); setEnded(false); }}
              onPause={() => setPlaying(false)}
              onEnded={() => { setPlaying(false); setEnded(true); }}
              onTimeUpdate={e => {
                const v = e.currentTarget;
                if (!started && v.currentTime > 0.8) setStarted(true);
                if (bar.current && v.duration) bar.current.style.transform = `scaleX(${v.currentTime / v.duration})`;
              }}
            >
              {source && <source src={source} type="video/mp4" />}
              <track kind="captions" src="/film/relevo-pt.vtt" srcLang="pt-BR" label="Português" />
            </video>
            <img className="reel-poster" src={film.poster} srcSet={`${film.posterSmall} 960w, ${film.poster} 1920w`} sizes="(max-width: 767px) 100vw, 88vw" width="1920" height="1080" alt="" loading="lazy" decoding="async" />
            {!playing && !started && !autoplay && (
              <button type="button" className="reel-start" onClick={() => { heard.current = true; const v = video.current; if (v) { v.muted = false; setMuted(false); } play(); }}>
                <span className="reel-start-icon"><Icon name="play" /></span>Assistir ao filme
              </button>
            )}
            {ended && (
              <div className="reel-end">
                <button type="button" className="reel-again" onClick={replay}><Icon name="restart" />Assistir de novo</button>
                <a className="text-link" href={whatsappUrl('Olá, Velmont! Assisti ao filme e quero conversar sobre o que estou construindo.')} target="_blank" rel="noopener noreferrer">Vamos conversar <Arrow /></a>
              </div>
            )}
            <div className="reel-controls">
              <button type="button" className="reel-button" onClick={togglePlay} aria-label={playing ? 'Pausar o filme' : 'Reproduzir o filme'}><Icon name={playing ? 'pause' : 'play'} /></button>
              <button type="button" className={`reel-sound${muted ? ' is-muted' : ''}`} onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? 'Ativar o som do filme' : 'Desativar o som do filme'}>
                <Icon name={muted ? 'mute' : 'sound'} /><span aria-hidden="true">{muted ? 'Ativar som' : 'Som'}</span>
              </button>
            </div>
            <span className="reel-progress" aria-hidden="true"><span ref={bar} /></span>
          </div>
        </div>
      </div>
      <div className="sr-only" id="reel-narration">Narração: {narration.map(l => l.text).join(' ')}</div>
    </section>
  );
}
