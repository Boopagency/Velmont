// Sound design for Relevo, synthesised with the Web Audio API and scheduled on
// the same cue table as the image. Nothing here is a loop of music: every
// sound is caused by something the voice says or something the image does.
// The same score renders in real time (FilmSound) and offline (for export).
import { narration } from './narration';
import { cues } from './cues';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// D minor while the business is being built; D major once it is seen.
const N = { D1: 26, D2: 38, F2: 41, G2: 43, A2: 45, Bb2: 46, C3: 48, D3: 50, E3: 52, F3: 53, Fs3: 54, G3: 55, A3: 57, Bb3: 58, B3: 59, C4: 60, Cs4: 61, D4: 62, E4: 64, F4: 65, Fs4: 66, G4: 67, A4: 69, B4: 71, Cs5: 73, D5: 74, E5: 76, Fs5: 78, A5: 81, B5: 83, D6: 86 };

type Keys = [number, number][];

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
function noiseBuffer(ctx: BaseAudioContext, seconds: number, kind: 'white' | 'brown', seed: number) {
  const rand = seeded(seed);
  const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = rand() * 2 - 1;
      if (kind === 'white') data[i] = white;
      else { last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5; }
    }
  }
  return buffer;
}
function impulse(ctx: BaseAudioContext, seconds = 3.2) {
  const rand = seeded(91);
  const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const x = i / data.length;
      data[i] = (rand() * 2 - 1) * Math.pow(1 - x, 3.2) * (i < ctx.sampleRate * 0.012 ? i / (ctx.sampleRate * 0.012) : 1);
    }
  }
  return buffer;
}

/**
 * Schedules the whole score from film time `from`, with film time `from`
 * sounding at context time `at0`. Returns the sources, so they can be stopped.
 */
export function scheduleScore(ctx: BaseAudioContext, out: AudioNode, from: number, at0: number, voiceBuffer: AudioBuffer | null = null, voiceOffset = 0) {
  const { T, batches, found } = cues();
  const sources: AudioScheduledSourceNode[] = [];
  const when = (tf: number) => at0 + (tf - from);
  const end = T.end + 1;
  const white = noiseBuffer(ctx, 3, 'white', 3);
  const brown = noiseBuffer(ctx, 6, 'brown', 5);

  // ——— Buses ———
  const master = ctx.createGain(); master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25; comp.knee.value = 8;
  master.connect(comp).connect(out);
  const reverb = ctx.createConvolver(); reverb.buffer = impulse(ctx);
  const reverbReturn = ctx.createGain(); reverbReturn.gain.value = 0.32;
  reverb.connect(reverbReturn).connect(master);
  const music = ctx.createGain(); music.gain.value = 0.85;
  const duck = ctx.createGain();
  duck.connect(music); music.connect(master);
  const musicSend = ctx.createGain(); musicSend.gain.value = 0.55; music.connect(musicSend).connect(reverb);
  const sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
  const sfxSend = ctx.createGain(); sfxSend.gain.value = 0.4; sfx.connect(sfxSend).connect(reverb);
  const amb = ctx.createGain(); amb.connect(master);

  /** Applies an automation curve written in film time, starting correctly mid-way when seeking. */
  const automate = (param: AudioParam, keys: Keys, scale = 1) => {
    const valueAt = (tf: number) => {
      if (tf <= keys[0][0]) return keys[0][1];
      for (let i = 0; i < keys.length - 1; i++) if (tf <= keys[i + 1][0]) return keys[i][1] + ((keys[i + 1][1] - keys[i][1]) * (tf - keys[i][0])) / (keys[i + 1][0] - keys[i][0]);
      return keys[keys.length - 1][1];
    };
    param.setValueAtTime(valueAt(from) * scale, at0);
    for (const [tf, v] of keys) if (tf > from) param.linearRampToValueAtTime(v * scale, when(tf));
  };

  // The music gives way whenever the voice speaks.
  const duckKeys: Keys = [[0, 1]];
  for (const l of narration) duckKeys.push([l.start - 0.15, 1], [l.start, 0.66], [l.end, 0.66], [l.end + 0.35, 1]);
  automate(duck.gain, duckKeys);

  const noise = (buffer: AudioBuffer, t0: number, t1: number) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.loop = true;
    const start = Math.max(t0, from);
    if (t1 <= start) return null;
    src.start(when(start), (start * 0.37) % buffer.duration);
    src.stop(when(t1));
    sources.push(src);
    return src;
  };
  const panner = (pan: number | Keys) => {
    const p = ctx.createStereoPanner();
    if (typeof pan === 'number') p.pan.value = pan; else automate(p.pan, pan);
    return p;
  };

  // ——— Room tone: silence with a texture ———
  {
    const src = noise(brown, 0, end);
    if (src) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 340;
      const g = ctx.createGain();
      automate(g.gain, [[0, 0], [1.6, 1], [T.protegido + 0.3, 1], [T.protegido + 0.9, 0.35], [T.olhar - 0.1, 0.35], [T.olhar + 0.5, 0.85], [T.end - 1.6, 0.85], [T.end, 0]], 0.05);
      src.connect(lp).connect(g).connect(amb);
    }
    const air = noise(white, 0, end);
    if (air) {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5200;
      const g = ctx.createGain();
      automate(g.gain, [[0, 0], [T.olhar, 0], [T.olhar + 1, 0.5], [T.ativos, 0.3], [T.velmont, 0.6], [T.hoje, 0.6], [T.patrimonio + 1, 1], [T.assinaturaEnd + 1, 0.3], [T.end, 0]], 0.006);
      air.connect(hp).connect(g).connect(amb);
    }
  }

  // ——— Instruments ———
  const ping = (tf: number, gain = 1) => {
    if (tf < from) return;
    for (const [note, g, tau] of [[N.D6, 0.03, 1.4], [N.D5, 0.04, 2.2]] as const) {
      const o = ctx.createOscillator(); o.frequency.value = midi(note);
      const e = ctx.createGain(); e.gain.setValueAtTime(0, when(tf)); e.gain.linearRampToValueAtTime(g * gain, when(tf) + 0.012); e.gain.setTargetAtTime(0, when(tf) + 0.02, tau);
      o.connect(e).connect(sfx); o.start(when(tf)); o.stop(when(tf) + tau * 6); sources.push(o);
    }
  };
  const bell = (tf: number, note: number, gain: number, pan = 0) => {
    if (tf < from) return;
    const f = midi(note), s = when(tf);
    const car = ctx.createOscillator(); car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.frequency.value = f * 3.5;
    const depth = ctx.createGain(); depth.gain.setValueAtTime(f * 1.1, s); depth.gain.setTargetAtTime(0, s, 0.22);
    mod.connect(depth).connect(car.frequency);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, s); e.gain.linearRampToValueAtTime(gain, s + 0.006); e.gain.setTargetAtTime(0, s + 0.01, 1.1);
    car.connect(e).connect(panner(pan)).connect(sfx);
    car.start(s); mod.start(s); car.stop(s + 7); mod.stop(s + 7); sources.push(car, mod);
  };
  const pluck = (tf: number, note: number, gain: number, pan = 0) => {
    if (tf < from) return;
    const s = when(tf);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const e = ctx.createGain(); e.gain.setValueAtTime(0, s); e.gain.linearRampToValueAtTime(gain, s + 0.006); e.gain.setTargetAtTime(0, s + 0.01, 0.42);
    for (const [mult, type, g] of [[1, 'sine', 1], [2, 'triangle', 0.18]] as const) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = midi(note) * mult;
      const og = ctx.createGain(); og.gain.value = g;
      o.connect(og).connect(lp); o.start(s); o.stop(s + 3.5); sources.push(o);
    }
    lp.connect(e).connect(panner(pan)).connect(duck);
  };
  const click = (tf: number, gain: number, pan = 0) => {
    if (tf < from) return;
    const s = when(tf);
    const src = ctx.createBufferSource(); src.buffer = white;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const e = ctx.createGain(); e.gain.setValueAtTime(gain, s); e.gain.setTargetAtTime(0, s + 0.001, 0.006);
    src.connect(hp).connect(e).connect(panner(pan)).connect(sfx);
    src.start(s, (tf * 0.71) % 2); src.stop(s + 0.08); sources.push(src);
  };
  const boom = (tf: number, gain: number) => {
    if (tf < from) return;
    const s = when(tf);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(92, s); o.frequency.exponentialRampToValueAtTime(36, s + 1.4);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, s); e.gain.linearRampToValueAtTime(gain, s + 0.012); e.gain.setTargetAtTime(0, s + 0.02, 0.55);
    o.connect(e).connect(sfx); o.start(s); o.stop(s + 4); sources.push(o);
    const n = ctx.createBufferSource(); n.buffer = brown;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    const ne = ctx.createGain(); ne.gain.setValueAtTime(gain * 0.9, s); ne.gain.setTargetAtTime(0, s + 0.005, 0.18);
    n.connect(lp).connect(ne).connect(sfx); n.start(s); n.stop(s + 1.5); sources.push(n);
  };
  const thump = (tf: number, gain: number) => {
    if (tf < from) return;
    const s = when(tf);
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(62, s); o.frequency.exponentialRampToValueAtTime(44, s + 0.3);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, s); e.gain.linearRampToValueAtTime(gain, s + 0.008); e.gain.setTargetAtTime(0, s + 0.01, 0.12);
    o.connect(e).connect(sfx); o.start(s); o.stop(s + 1); sources.push(o);
  };
  /** Graphite on paper: band-limited noise whose grain follows the hand. */
  const pencil = (tf: number, dur: number, gain: number, pan: number | Keys = 0, freq = 3200) => {
    if (tf + dur < from) return;
    const src = noise(white, tf, tf + dur + 0.1);
    if (!src) return;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 0.9;
    const e = ctx.createGain();
    const rand = seeded(Math.floor(tf * 1000));
    const keys: Keys = [[tf, 0], [tf + 0.05, 1]];
    for (let x = tf + 0.08; x < tf + dur - 0.08; x += 0.035) keys.push([x, 0.45 + rand() * 0.55]);
    keys.push([tf + dur, 0]);
    automate(e.gain, keys, gain);
    src.connect(bp).connect(e).connect(panner(pan)).connect(sfx);
  };
  const whoosh = (tf: number, dur: number, gain: number, pan: Keys = [[tf, -0.3], [tf + dur, 0.3]]) => {
    if (tf + dur < from) return;
    const src = noise(white, tf, tf + dur + 0.1);
    if (!src) return;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
    automate(bp.frequency, [[tf, 240], [tf + dur * 0.6, 1500], [tf + dur, 500]]);
    const e = ctx.createGain();
    automate(e.gain, [[tf, 0], [tf + dur * 0.6, 1], [tf + dur, 0]], gain);
    src.connect(bp).connect(e).connect(panner(pan)).connect(sfx);
  };
  const breath = (tf: number, gain: number) => {
    if (tf + 2 < from) return;
    const src = noise(white, tf, tf + 2.2);
    if (!src) return;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1050; bp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const e = ctx.createGain();
    automate(e.gain, [[tf, 0], [tf + 0.9, 1], [tf + 2.1, 0]], gain);
    src.connect(bp).connect(lp).connect(e).connect(sfx);
  };
  /** A sustained chord: detuned voices through a slowly opening filter. */
  const pad = (t0: number, t1: number, notes: number[], gain: number, cut: [number, number], attack = 1.2, release = 1.4) => {
    if (t1 + release < from) return;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
    automate(lp.frequency, [[t0, cut[0]], [t1, cut[1]]]);
    const e = ctx.createGain();
    automate(e.gain, [[t0, 0], [t0 + attack, 1], [t1, 1], [t1 + release, 0]], gain / Math.sqrt(notes.length));
    lp.connect(e).connect(duck);
    const start = Math.max(t0, from);
    notes.forEach((note, i) => {
      const pan = ((i % 2 ? 1 : -1) * (0.15 + 0.5 * (i / notes.length)));
      const p = panner(pan); p.connect(lp);
      for (const detune of [-6, 6]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(note); o.detune.value = detune;
        const og = ctx.createGain(); og.gain.value = 0.5;
        o.connect(og).connect(p); o.start(when(start)); o.stop(when(t1 + release + 0.1)); sources.push(o);
      }
    });
  };
  const drone = (notes: number[], keys: Keys, gain: number) => {
    const e = ctx.createGain(); automate(e.gain, keys, gain); e.connect(duck);
    const t0 = keys[0][0], t1 = keys[keys.length - 1][0];
    const start = Math.max(t0, from);
    if (t1 <= start) return;
    for (const note of notes) {
      const o = ctx.createOscillator(); o.frequency.value = midi(note);
      o.connect(e); o.start(when(start)); o.stop(when(t1)); sources.push(o);
    }
  };

  // ——— I. A point ———
  breath(0.25, 0.05);
  ping(T.point);
  pencil(T.traco - 0.05, 0.9, 0.07, [[T.traco, 0], [T.traco + 0.9, 0.35]]);
  pencil(T.ideia - 0.1, 1.6, 0.065, [[T.ideia, 0.35], [T.ideia + 0.5, -0.1], [T.ideia + 1, -0.4], [T.ideia + 1.5, 0.3]], 2900);
  for (let i = 0; i < 7; i++) click(T.nome + i * 0.06, 0.035, -0.4 + i * 0.13);

  // ——— II. Layers: every layer adds a note; the chords climb with the business ———
  const arps = [[N.D3, N.A3], [N.D4, N.F4, N.A4], [N.Bb3, N.D4, N.F4, N.A4], [N.F3, N.A3, N.C4, N.E4], [N.C4, N.E4, N.G4, N.D5], [N.G3, N.Bb3, N.D4], [N.A3, N.Cs4, N.E4]];
  batches.forEach(([levels, at], b) => {
    thump(at - 0.02, b === 0 ? 0.14 : 0.2);
    levels.forEach((level, i) => pluck(at + i * 0.16, arps[b][i % arps[b].length], 0.085, level % 2 ? 0.35 : -0.35));
  });
  const chords: [number, number[], [number, number]][] = [
    [T.trabalho, [N.D3, N.A3, N.F4], [380, 650]],
    [T.forma, [N.D3, N.A3, N.E4, N.F4], [650, 900]],
    [T.produto, [N.Bb2, N.F3, N.A3, N.D4], [900, 1150]],
    [T.clientes, [N.F2, N.C3, N.A3, N.E4], [1150, 1400]],
    [T.usuarios, [N.C3, N.G3, N.D4, N.E4], [1400, 1700]],
    [T.reputacao, [N.G2, N.D3, N.Bb3, N.A4], [1700, 2000]],
    [T.valor, [N.A2, N.E3, N.Cs4, N.E4], [2000, 2400]],
  ];
  chords.forEach(([at, notes, cut], i) => pad(at, i < chords.length - 1 ? chords[i + 1][0] + 0.5 : T.valorEnd + 0.3, notes, 0.07, cut, i ? 0.7 : 2.4, i < chords.length - 1 ? 0.8 : 1.3));
  drone([N.D2, N.A2], [[T.trabalho, 0], [T.trabalho + 3, 0.6], [T.valor, 1], [T.valorEnd, 0.9], [T.valorEnd + 1.1, 0]], 0.05);
  whoosh(T.balanco - 0.6, 2.2, 0.05);
  pencil(T.balanco - 0.3, 1.5, 0.03, [[T.balanco - 0.3, -0.8], [T.balanco + 1.2, 0.8]], 5200);

  // ——— III. The question, then silence ———
  {
    const o = ctx.createOscillator(); o.frequency.value = midi(N.A4);
    const e = ctx.createGain(); automate(e.gain, [[T.pergunta - 0.4, 0], [T.protegido, 1], [T.protegido + 0.3, 1], [T.protegido + 0.34, 0]], 0.018);
    const start = Math.max(T.pergunta - 0.4, from);
    if (start < T.protegido + 0.4) { o.connect(e).connect(duck); o.start(when(start)); o.stop(when(T.protegido + 0.4)); sources.push(o); }
    const riser = noise(white, T.pergunta - 0.4, T.protegido + 0.4);
    if (riser) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
      automate(bp.frequency, [[T.pergunta - 0.4, 500], [T.protegido + 0.3, 3600]]);
      const g = ctx.createGain(); automate(g.gain, [[T.pergunta - 0.4, 0], [T.protegido + 0.3, 1], [T.protegido + 0.34, 0]], 0.03);
      riser.connect(bp).connect(g).connect(sfx);
    }
  }
  breath(T.olhar - 1.6, 0.035);

  // ——— IV. The second look ———
  boom(T.olhar - 0.03, 0.34);
  ping(T.olhar + 0.02, 0.5);
  pad(T.olhar, T.ativos, [N.D2, N.A2, N.D3, N.E4, N.Fs4, N.A4], 0.06, [600, 2100], 1.6, 0.9);
  {
    const src = ctx.createOscillator(); src.frequency.value = midi(N.A5);
    const trem = ctx.createOscillator(); trem.frequency.value = 3.1;
    const depth = ctx.createGain(); depth.gain.value = 0.35;
    const e = ctx.createGain();
    automate(e.gain, [[T.olhar + 0.2, 0], [T.olhar + 1.5, 0.006], [T.ativos - 0.4, 0.006], [T.ativos, 0]]);
    const tremGain = ctx.createGain(); tremGain.gain.value = 1;
    trem.connect(depth).connect(tremGain.gain);
    const start = Math.max(T.olhar + 0.2, from);
    if (start < T.ativos) { src.connect(tremGain).connect(e).connect(duck); src.start(when(start)); trem.start(when(start)); src.stop(when(T.ativos)); trem.stop(when(T.ativos)); sources.push(src, trem); }
  }
  const foundNotes = [N.D5, N.E5, N.Fs5, N.A5, N.B5, N.D6];
  found.forEach((f, i) => { click(f.at - 0.01, 0.07, f.side * 0.55); bell(f.at, foundNotes[i], 0.045, f.side * 0.55); });
  boom(T.ativos - 0.05, 0.24);
  pad(T.ativos, T.velmont + 0.6, [N.D2, N.G3, N.B3, N.D4, N.A4], 0.06, [1800, 1800], 0.5, 0.9);

  // ——— V. Clarity ———
  pad(T.velmont, T.jornada + 0.4, [N.D2, N.A2, N.Fs3, N.Cs4, N.E4, N.A4], 0.085, [1400, 2400], 0.9, 1);
  const clarity = [N.D4, N.Fs4, N.A4, N.Cs5, N.E5, N.Fs5];
  found.forEach((f, i) => pluck(T.identifica + i * 0.13 + 0.25, clarity[i], 0.06, f.side * 0.5));
  for (let i = 0; i < 6; i++) pencil(T.riscos + i * 0.15, 0.1, 0.05, -0.35, 4300);
  pluck(T.riscos, N.B3, 0.05, -0.3);
  [-0.6, 0.6, 0].forEach((pan, i) => pencil(T.caminhos + i * 0.35, 2, 0.04, pan, 3000));

  // ——— VI. The journey widens ———
  whoosh(T.velmontEnd, 2.8, 0.045, [[T.velmontEnd, 0], [T.velmontEnd + 2.8, 0]]);
  pad(T.jornada, T.hoje + 0.4, [N.D2, N.G3, N.B3, N.Fs4, N.A4], 0.08, [2000, 2300], 1, 1.2);
  bell(T.jornada + 0.2, N.D5, 0.04, 0);
  pencil(T.conecta - 0.2, 1.3, 0.025, [[T.conecta, 0], [T.conecta + 1.3, -0.7]], 5200);
  pencil(T.conecta - 0.2, 1.3, 0.025, [[T.conecta, 0], [T.conecta + 1.3, 0.7]], 5000);
  bell(T.estruturar - 0.2, N.A4, 0.042, -0.75);
  bell(T.crescer - 0.2, N.Fs5, 0.042, 0.75);

  // ——— VII. Heritage ———
  whoosh(T.jornadaEnd, T.patrimonio - T.jornadaEnd, 0.05, [[T.jornadaEnd, 0], [T.patrimonio, 0]]);
  pad(T.hoje, T.patrimonio, [N.A2, N.D3, N.E3, N.A3, N.D4], 0.05, [900, 1600], 1, 0.8);
  {
    const swell = noise(white, T.patrimonio - 1.4, T.patrimonio + 0.3);
    if (swell) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      automate(lp.frequency, [[T.patrimonio - 1.4, 300], [T.patrimonio + 0.2, 6000]]);
      const g = ctx.createGain(); automate(g.gain, [[T.patrimonio - 1.4, 0], [T.patrimonio + 0.15, 1], [T.patrimonio + 0.3, 0]], 0.03);
      swell.connect(lp).connect(g).connect(sfx);
    }
  }
  pad(T.patrimonio, T.assinaturaEnd + 0.8, [N.D2, N.A2, N.D3, N.Fs3, N.A3, N.D4, N.Fs4, N.A4, N.D5], 0.085, [1200, 2600], 1.6, 2.6);
  drone([N.D1, N.D2], [[T.hoje, 0], [T.patrimonio + 1.5, 1], [T.assinatura + 1, 0.7], [T.assinaturaEnd + 2, 0]], 0.07);
  bell(T.assinatura, N.D5, 0.05, 0);
  thump(T.assinatura - 0.02, 0.16);
  ping(T.assinaturaEnd + 1.3, 0.9);

  // ——— Voice ———
  if (voiceBuffer) {
    const v = ctx.createBufferSource(); v.buffer = voiceBuffer;
    const vg = ctx.createGain(); vg.gain.value = 1;
    const vs = ctx.createGain(); vs.gain.value = 0.06;
    v.connect(vg).connect(master); vg.connect(vs).connect(reverb);
    const offset = from - voiceOffset;
    if (offset < 0) v.start(when(voiceOffset)); else if (offset < voiceBuffer.duration) v.start(at0, offset);
    sources.push(v);
  }

  return { sources, master };
}

/** Real-time playback; its clock is the film's clock. */
export class FilmSound {
  ctx: AudioContext;
  private voiceBuffer: AudioBuffer | null = null;
  private running: { sources: AudioScheduledSourceNode[]; master: GainNode } | null = null;
  private from = 0;
  private at0 = 0;
  private muted = false;
  private out: GainNode;

  constructor() {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx({ latencyHint: 'playback' });
    this.out = this.ctx.createGain();
    this.out.connect(this.ctx.destination);
  }
  async loadVoice(src: string | null) {
    if (!src || this.voiceBuffer) return;
    const res = await fetch(src);
    if (!res.ok) throw new Error(`voice ${res.status}`);
    this.voiceBuffer = await this.ctx.decodeAudioData(await res.arrayBuffer());
  }
  get hasVoice() { return !!this.voiceBuffer; }
  async start(from: number, voiceOffset = 0) {
    this.stop();
    if (this.ctx.state !== 'running') await this.ctx.resume();
    this.from = from;
    this.at0 = this.ctx.currentTime + 0.06;
    this.out.gain.value = this.muted ? 0 : 1;
    this.running = scheduleScore(this.ctx, this.out, from, this.at0, this.voiceBuffer, voiceOffset);
  }
  stop() {
    if (!this.running) return;
    for (const s of this.running.sources) { try { s.stop(); } catch { /* not started yet */ } }
    this.running.master.disconnect();
    this.running = null;
  }
  now() { return this.from + Math.max(0, this.ctx.currentTime - this.at0); }
  setMuted(muted: boolean) {
    this.muted = muted;
    this.out.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.03);
  }
  close() { this.stop(); void this.ctx.close(); }
}
