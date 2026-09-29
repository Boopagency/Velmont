import { useEffect, useRef, useState } from 'react';
import { whatsappUrl } from '@/lib/site';
import { captionAt } from './film/captions';
import { narration } from './film/narration';
import { Arrow, Icon } from './icons';

// Relevo on the home page: the approved film file, played as it is. Scroll only
// moves the card (entrance, a short hold, exit); it never drives the film's time.
const film = {
  hd: '/film/relevo-1080p.mp4',
  sd: '/film/relevo-720p.mp4',
  poster: '/film/relevo-poster-1920.webp',
  posterSmall: '/film/relevo-poster-960.webp',
  captions: '/film/relevo-pt.vtt',
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);
const easeIn = (v: number) => v * v;

type WebkitDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => void };
type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitDisplayingFullscreen?: boolean };
type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

export function FilmReel() {
  const section = useRef<HTMLElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const seekbar = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  // Autoplay is silent, so captions start on; the first "Ativar som" turns them off.
  const [captions, setCaptions] = useState(true);
  const [caption, setCaption] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [autoplay, setAutoplay] = useState(true);
  const [full, setFull] = useState(false);
  const [active, setActive] = useState(false);
  const [flash, setFlash] = useState<{ icon: 'play' | 'pause'; n: number } | null>(null);
  const userPaused = useRef(false);
  const heard = useRef(false);
  const visible = useRef(0);
  const dragging = useRef(false);
  const captionsOn = useRef(captions);
  useEffect(() => { captionsOn.current = captions; }, [captions]);

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
  // Muted before any play() call, whatever the server markup carried; the text
  // track is drawn by the player itself (native display only in iPhone fullscreen).
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = true;
    const track = v.textTracks[0];
    if (track) track.mode = 'hidden';
  }, []);

  // Visibility: play (muted) when half the card is on screen, pause when it has
  // practically left, resume where it stopped when the visitor comes back —
  // unless the visitor paused it.
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

  // Progress and captions follow the film's own clock, every frame while it plays.
  const sync = () => {
    const v = video.current;
    if (!v) return;
    const d = v.duration || 0;
    if (bar.current && d) bar.current.style.transform = `scaleX(${v.currentTime / d})`;
    if (seekbar.current && !dragging.current) seekbar.current.value = String(v.currentTime);
    const cue = captionAt(v.currentTime)?.text ?? null;
    setCaption(prev => (prev === cue ? prev : cue));
  };
  useEffect(() => {
    if (!playing) { sync(); return; }
    let frame = 0;
    const tick = () => { sync(); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  // Fullscreen: the card itself (controls and captions stay ours); on iPhone,
  // where only the video element can go fullscreen, the native player takes
  // over with the same file, the same time and the same captions.
  useEffect(() => {
    const doc = document as WebkitDocument;
    const v = video.current as WebkitVideo | null;
    const change = () => {
      const on = (doc.fullscreenElement ?? doc.webkitFullscreenElement) === card.current;
      setFull(on);
      if (!on) screen.orientation?.unlock?.();
    };
    const nativeIn = () => { const t = v?.textTracks[0]; if (t) t.mode = captionsOn.current ? 'showing' : 'hidden'; };
    const nativeOut = () => {
      const t = v?.textTracks[0];
      if (t) { if (t.mode === 'showing') setCaptions(true); t.mode = 'hidden'; }
      if (v) { setMuted(v.muted); setPlaying(!v.paused); }
    };
    doc.addEventListener('fullscreenchange', change);
    doc.addEventListener('webkitfullscreenchange', change);
    v?.addEventListener('webkitbeginfullscreen', nativeIn);
    v?.addEventListener('webkitendfullscreen', nativeOut);
    return () => {
      doc.removeEventListener('fullscreenchange', change);
      doc.removeEventListener('webkitfullscreenchange', change);
      v?.removeEventListener('webkitbeginfullscreen', nativeIn);
      v?.removeEventListener('webkitendfullscreen', nativeOut);
    };
  }, []);

  const play = () => {
    const v = video.current;
    if (!v) return;
    userPaused.current = false;
    if (!v.currentSrc) setSource(innerWidth <= 900 ? film.sd : film.hd);
    void v.play().catch(() => {});
  };
  const pause = () => {
    const v = video.current;
    if (!v) return;
    userPaused.current = true;
    v.pause();
  };
  const togglePlay = () => { if (video.current?.paused) play(); else pause(); };
  const replay = () => {
    const v = video.current;
    if (!v) return;
    v.currentTime = 0;
    setEnded(false);
    play();
  };
  // The whole picture is the play/pause button; a brief sign confirms the action.
  const onSurface = () => {
    const v = video.current;
    if (!v) return;
    if (ended || v.ended) { replay(); return; }
    const willPlay = v.paused;
    if (willPlay) play(); else pause();
    setFlash(prev => ({ icon: willPlay ? 'play' : 'pause', n: (prev?.n ?? 0) + 1 }));
  };
  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    // Captions follow the sound: muted brings them on, sound takes them away.
    // The CC button still overrides until the next sound change.
    if (!v.muted) { v.muted = true; setMuted(true); setCaptions(true); return; }
    v.muted = false;
    setMuted(false);
    setCaptions(false);
    // The first time the sound is turned on, the film starts over: its narration
    // only makes sense from the first line. After that, nothing restarts.
    if (!heard.current) {
      heard.current = true;
      v.currentTime = 0;
      setEnded(false);
      play();
      return;
    }
    if (v.paused && !userPaused.current) play();
  };
  const startWithSound = () => {
    const v = video.current;
    if (!v) return;
    heard.current = true;
    v.muted = false;
    setMuted(false);
    setCaptions(false);
    play();
  };
  const toggleFull = () => {
    const doc = document as WebkitDocument;
    const el = card.current as WebkitElement | null;
    const v = video.current as WebkitVideo | null;
    if (!el || !v) return;
    if (doc.fullscreenElement ?? doc.webkitFullscreenElement) { void (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.()); return; }
    if (el.requestFullscreen) {
      void el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
        if (matchMedia('(pointer: coarse)').matches) void (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape').catch(() => {});
      }).catch(() => {});
    } else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (v.webkitEnterFullscreen) {
      if (!v.currentSrc) setSource(film.sd);
      v.webkitEnterFullscreen();
    }
  };
  const seek = (value: number) => {
    const v = video.current;
    if (!v || !v.duration) return;
    v.currentTime = Math.min(value, v.duration - 0.05);
    if (ended && value < v.duration - 0.1) setEnded(false);
    sync();
  };

  // Controls gain presence on any pointer activity (mouse or touch), then recede.
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    let timer = 0;
    const wake = () => { setActive(true); clearTimeout(timer); timer = window.setTimeout(() => setActive(false), 2600); };
    const keys = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const actions: Record<string, () => void> = { k: togglePlay, m: toggleSound, c: () => setCaptions(c => !c), f: toggleFull };
      const action = actions[e.key.toLowerCase()];
      if (action) { e.preventDefault(); action(); }
      wake();
    };
    el.addEventListener('pointermove', wake);
    el.addEventListener('pointerdown', wake);
    el.addEventListener('keydown', keys);
    return () => { clearTimeout(timer); el.removeEventListener('pointermove', wake); el.removeEventListener('pointerdown', wake); el.removeEventListener('keydown', keys); };
  });

  const cls = ['reel-card', started && 'is-live', playing && 'is-playing', ended && 'is-ended', full && 'is-full', active && 'is-active'].filter(Boolean).join(' ');
  return (
    <section ref={section} className="reel" aria-labelledby="reel-title">
      <div className="reel-stage">
        <div className="reel-frame">
          <div className="reel-meta">
            <span className="eyebrow" id="reel-title"><span>FILME</span>O QUE VOCÊ ESTÁ CONSTRUINDO</span>
            <span className="reel-length" aria-hidden="true">RELEVO · 1:20</span>
          </div>
          <div ref={card} className={cls}>
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
              onVolumeChange={e => setMuted(e.currentTarget.muted)}
              onSeeked={sync}
              onLoadedMetadata={e => { if (seekbar.current) seekbar.current.max = String(e.currentTarget.duration); }}
              onTimeUpdate={e => { if (!started && e.currentTarget.currentTime > 0.8) setStarted(true); }}
            >
              {source && <source src={source} type="video/mp4" />}
              <track kind="captions" src={film.captions} srcLang="pt-BR" label="Português" />
            </video>
            <img className="reel-poster" src={film.poster} srcSet={`${film.posterSmall} 960w, ${film.poster} 1920w`} sizes="(max-width: 767px) 100vw, 88vw" width="1920" height="1080" alt="" loading="lazy" decoding="async" />
            {captions && caption && <p key={caption} className="reel-caption" aria-hidden="true">{caption}</p>}
            {/* Mouse and touch surface; keyboard users have the play button and the K key. */}
            <button type="button" className="reel-surface" tabIndex={-1} aria-hidden="true" onClick={onSurface} />
            {flash && <span key={flash.n} className={`reel-flash reel-flash-${flash.icon}`} aria-hidden="true"><Icon name={flash.icon} /></span>}
            {!playing && !started && !autoplay && (
              <button type="button" className="reel-start" onClick={startWithSound}>
                <span className="reel-start-icon"><Icon name="play" /></span>Assistir ao filme
              </button>
            )}
            {ended && (
              <div className="reel-end">
                <button type="button" className="reel-again" onClick={replay}><Icon name="restart" />Assistir de novo</button>
                <a className="reel-talk" href={whatsappUrl('Olá, Velmont! Assisti ao filme e quero conversar sobre o que estou construindo.')} target="_blank" rel="noopener noreferrer">Vamos conversar <Arrow /></a>
              </div>
            )}
            <div className="reel-controls">
              <button type="button" className="reel-button" onClick={togglePlay} aria-label={playing ? 'Pausar o filme' : 'Reproduzir o filme'}><Icon name={playing ? 'pause' : 'play'} /></button>
              <div className="reel-controls-end">
                <button type="button" className="reel-button reel-cc" onClick={() => setCaptions(c => !c)} aria-pressed={captions} aria-label={captions ? 'Desativar legendas' : 'Ativar legendas'}><Icon name="captions" /></button>
                <button type="button" className={`reel-sound${muted ? ' is-muted' : ''}`} onClick={toggleSound} aria-pressed={!muted} aria-label={muted ? 'Ativar o som do filme' : 'Desativar o som do filme'}>
                  <Icon name={muted ? 'mute' : 'sound'} /><span aria-hidden="true">{muted ? 'Ativar som' : 'Som'}</span>
                </button>
                <button type="button" className="reel-button" onClick={toggleFull} aria-label={full ? 'Sair da tela cheia' : 'Assistir em tela cheia'}><Icon name={full ? 'collapse' : 'expand'} /></button>
              </div>
            </div>
            <div className="reel-progress">
              <span className="reel-progress-line" aria-hidden="true"><span ref={bar} /></span>
              <input
                ref={seekbar} type="range" min={0} max={80} step={1} defaultValue={0} aria-label="Posição no filme"
                onPointerDown={() => { dragging.current = true; }}
                onPointerUp={() => { dragging.current = false; }}
                onPointerCancel={() => { dragging.current = false; }}
                onInput={e => seek(Number(e.currentTarget.value))}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="sr-only" id="reel-narration">Narração: {narration.map(l => l.text).join(' ')}</div>
    </section>
  );
}
