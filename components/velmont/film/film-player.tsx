import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/velmont/icons';
import { whatsappUrl } from '@/lib/site';
import { captionAt, filmDuration, partnerLogos, voice } from './narration';
import type { FilmAssets, FrameOptions } from './render';
import type { FilmSound } from './sound';

type Status = 'loading' | 'ready' | 'playing' | 'paused' | 'ended';
type Engine = { drawFrame: typeof import('./render').drawFrame; Sound: typeof FilmSound; assets: FilmAssets };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const POSTER = 21.6;

function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Relevo: the brand film, drawn live in the browser around its narration. */
export function FilmPlayer() {
  const duration = filmDuration();
  const stage = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const caption = useRef<HTMLParagraphElement>(null);
  const bar = useRef<HTMLInputElement>(null);
  const toggleButton = useRef<HTMLButtonElement>(null);
  const focusControls = useRef(false);
  const elapsed = useRef<HTMLSpanElement>(null);
  const engine = useRef<Engine | null>(null);
  const sound = useRef<FilmSound | null>(null);
  const time = useRef(0);
  const frame = useRef(0);
  const fallbackStart = useRef<[number, number] | null>(null);
  const onPoster = useRef(true);
  const [status, setStatus] = useState<Status>('loading');
  const [captions, setCaptions] = useState(!voice.src);
  const [muted, setMuted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [voiceMissing, setVoiceMissing] = useState(false);
  const options = useRef<FrameOptions>({});
  const captionsOn = useRef(captions);
  useEffect(() => { options.current = { reduced }; captionsOn.current = captions; }, [reduced, captions]);

  const paint = useCallback((t: number) => {
    const e = engine.current, c = canvas.current;
    if (!e || !c) return;
    const rect = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(320, Math.round(rect.width * dpr)), h = Math.round((w * 9) / 16);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const ctx = c.getContext('2d');
    if (ctx) e.drawFrame(ctx, t, w, h, e.assets, options.current);
    const line = captionAt(t);
    if (caption.current) caption.current.textContent = captionsOn.current && line ? line.text : '';
    if (bar.current) {
      bar.current.value = String(t);
      bar.current.style.setProperty('--progress', `${(t / duration) * 100}%`);
      bar.current.setAttribute('aria-valuetext', `${clock(t)} de ${clock(duration)}`);
    }
    if (elapsed.current) elapsed.current.textContent = clock(t);
  }, [duration]);

  // Load the drawing engine, fonts and images after the page is interactive.
  useEffect(() => {
    let alive = true;
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    void (async () => {
      const [render, audio, mountain, logo, bwise, boop] = await Promise.all([
        import('./render'),
        import('./sound'),
        loadImage('/generated/velmont-hero-mountain-1536.webp'),
        loadImage('/images/velmont-logo.webp'),
        loadImage(partnerLogos.bwise?.src ?? null),
        loadImage(partnerLogos.boop?.src ?? null),
        ...['300 40px Manrope', '400 40px Manrope', '500 40px Manrope', '600 40px Manrope', '400 40px Instrument'].map(f => document.fonts.load(f).catch(() => [])),
      ]);
      if (!alive) return;
      engine.current = { drawFrame: render.drawFrame, Sound: audio.FilmSound, assets: { mountain, logo, bwise, boop } };
      const params = new URLSearchParams(location.search);
      const at = Number(params.get('t'));
      onPoster.current = !(Number.isFinite(at) && at > 0);
      time.current = onPoster.current ? POSTER : Math.min(at, duration);
      if (params.has('export')) {
        // Frame-accurate export (scripts/film-render.mjs).
        (window as unknown as { __relevo: unknown }).__relevo = {
          duration,
          frame(t: number, w: number, h: number, withCaptions: boolean, quality = 0.95) {
            const c = document.createElement('canvas'); c.width = w; c.height = h;
            render.drawFrame(c.getContext('2d')!, t, w, h, engine.current!.assets, { captions: withCaptions });
            return c.toDataURL('image/jpeg', quality);
          },
          /** The full mix (score and, when present, voice) as a 16-bit stereo WAV, base64. */
          async audio(rate = 48000, stem: 'mix' | 'voice' | 'score' = 'mix') {
            const ctx = new OfflineAudioContext(2, Math.ceil(duration * rate), rate);
            let voiceBuffer: AudioBuffer | null = null;
            if (voice.src) voiceBuffer = await ctx.decodeAudioData(await (await fetch(voice.src)).arrayBuffer());
            audio.scheduleScore(ctx, ctx.destination, 0, 0, voiceBuffer, voice.clips, stem);
            const out = await ctx.startRendering();
            const frames = out.length, bytes = new DataView(new ArrayBuffer(44 + frames * 4));
            const str = (o: number, v: string) => { for (let i = 0; i < v.length; i++) bytes.setUint8(o + i, v.charCodeAt(i)); };
            str(0, 'RIFF'); bytes.setUint32(4, 36 + frames * 4, true); str(8, 'WAVEfmt '); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 2, true);
            bytes.setUint32(24, rate, true); bytes.setUint32(28, rate * 4, true); bytes.setUint16(32, 4, true); bytes.setUint16(34, 16, true); str(36, 'data'); bytes.setUint32(40, frames * 4, true);
            const l = out.getChannelData(0), r = out.getChannelData(1);
            let peak = 0;
            for (let i = 0; i < frames; i++) {
              peak = Math.max(peak, Math.abs(l[i]), Math.abs(r[i]));
              bytes.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l[i])) * 32767, true);
              bytes.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r[i])) * 32767, true);
            }
            let bin = '';
            const u8 = new Uint8Array(bytes.buffer);
            for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
            return { wav: btoa(bin), peak };
          },
        };
      }
      setStatus('ready');
      paint(time.current);
    })();
    const observer = new ResizeObserver(() => { if (engine.current) paint(time.current); });
    if (stage.current) observer.observe(stage.current);
    return () => {
      alive = false;
      query.removeEventListener('change', sync);
      observer.disconnect();
      cancelAnimationFrame(frame.current);
      sound.current?.close();
    };
  }, [duration, paint]);

  useEffect(() => { if (status !== 'playing') paint(time.current); }, [captions, reduced, status, paint]);

  const now = () => {
    if (sound.current) return sound.current.now();
    const [t0, p0] = fallbackStart.current || [time.current, performance.now()];
    return t0 + (performance.now() - p0) / 1000;
  };

  const loop = () => {
    const t = now();
    if (t >= duration) {
      time.current = duration;
      paint(duration);
      sound.current?.stop();
      setStatus('ended');
      return;
    }
    time.current = t;
    paint(t);
    frame.current = requestAnimationFrame(loop);
  };

  const startAt = async (t: number) => {
    const e = engine.current;
    if (!e) return;
    cancelAnimationFrame(frame.current);
    time.current = t;
    try {
      if (!sound.current) {
        sound.current = new e.Sound();
        try { await sound.current.loadVoice(voice.src); } catch { setVoiceMissing(true); }
      }
      sound.current.setMuted(muted);
      await sound.current.start(t, voice.clips);
    } catch {
      sound.current = null; // No Web Audio: the image still plays, on the page clock.
      fallbackStart.current = [t, performance.now()];
    }
    setStatus('playing');
    frame.current = requestAnimationFrame(loop);
  };

  const play = () => {
    // The poster button disappears on play; keep keyboard focus inside the player.
    if (status === 'ready' || status === 'ended') focusControls.current = true;
    const from = status === 'ended' || onPoster.current ? 0 : time.current;
    onPoster.current = false;
    void startAt(from);
  };
  const pause = () => {
    time.current = now();
    cancelAnimationFrame(frame.current);
    sound.current?.stop();
    fallbackStart.current = null;
    setStatus('paused');
    paint(time.current);
  };
  const toggle = () => (status === 'playing' ? pause() : play());
  const seek = (t: number) => {
    const target = Math.max(0, Math.min(duration - 0.05, t));
    time.current = target;
    if (status === 'playing') void startAt(target);
    else { onPoster.current = false; if (status === 'ended' || status === 'ready') setStatus('paused'); paint(target); }
  };
  const toggleMute = () => { const next = !muted; setMuted(next); sound.current?.setMuted(next); };
  const fullscreen = () => {
    const el = stage.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => {});
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' && e.key.startsWith('Arrow')) return;
    const actions: Record<string, () => void> = {
      ' ': toggle, k: toggle, ArrowLeft: () => seek(time.current - 5), ArrowRight: () => seek(time.current + 5),
      c: () => setCaptions(v => !v), m: toggleMute, f: fullscreen, Home: () => seek(0),
    };
    const action = actions[e.key];
    if (!action || (e.target as HTMLElement).tagName === 'BUTTON' && (e.key === ' ')) return;
    e.preventDefault();
    action();
  };

  useEffect(() => {
    if (status === 'playing' && focusControls.current) { focusControls.current = false; toggleButton.current?.focus(); }
  }, [status]);

  // Keyboard shortcuts while focus is inside the player.
  const keys = useRef(onKey);
  useEffect(() => { keys.current = onKey; });
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => keys.current(e);
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, []);

  const idle = status === 'ready' || status === 'loading';
  return (
    <section ref={stage} className={`film-stage is-${status}`} aria-label="Filme Relevo, da Velmont">
      <canvas ref={canvas} className="film-canvas" aria-hidden="true" />
      <p ref={caption} className="film-caption" aria-hidden="true" />
      {idle && (
        <div className="film-poster">
          <button type="button" className="film-start" onClick={play} disabled={status === 'loading'}>
            <span className="film-start-icon"><Icon name="play" /></span>
            <span><strong>Assistir ao filme</strong><small>{clock(duration)} · com som</small></span>
          </button>
          {!voice.src && <p className="film-note">Prévia sem locução gravada. O tempo das cenas segue a estimativa do roteiro e as legendas mostram a narração.</p>}
        </div>
      )}
      {status === 'ended' && (
        <div className="film-end">
          <a className="cta" href={whatsappUrl('Olá, Velmont! Assisti ao filme e quero conversar sobre o que estou construindo.')} target="_blank" rel="noopener noreferrer">Conversar com a Velmont<span className="cta-arrow"><Icon name="arrow" /></span></a>
          <button type="button" className="film-again" onClick={() => { focusControls.current = true; void startAt(0); }}><Icon name="restart" />Assistir de novo</button>
        </div>
      )}
      {!idle && (
        <div className="film-controls">
          <button ref={toggleButton} type="button" onClick={toggle} aria-label={status === 'playing' ? 'Pausar' : 'Reproduzir'}><Icon name={status === 'playing' ? 'pause' : 'play'} /></button>
          <span className="film-time"><span ref={elapsed}>0:00</span> / {clock(duration)}</span>
          <input ref={bar} type="range" min={0} max={duration} step={0.1} defaultValue={0} aria-label="Posição no filme" onChange={e => seek(Number(e.currentTarget.value))} />
          <button type="button" onClick={() => setCaptions(v => !v)} aria-pressed={captions} aria-label="Legendas"><Icon name="captions" /></button>
          <button type="button" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? 'Ativar som' : 'Silenciar'}><Icon name={muted ? 'mute' : 'sound'} /></button>
          <button type="button" onClick={fullscreen} aria-label="Tela cheia"><Icon name="expand" /></button>
        </div>
      )}
      {voiceMissing && <output className="film-note film-note-inline">A locução não pôde ser carregada; o filme segue com legendas.</output>}
    </section>
  );
}
