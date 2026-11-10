"""Sound design da série Papel Passado, todo gerado por código.

Uso: python3 tools/build_sfx.py
Nenhuma gravação de terceiros: cada som é ruído e senoides moldados em numpy.
Sai em public/sfx/*.wav (48 kHz, estéreo).
"""
from __future__ import annotations

import os
import wave

import numpy as np

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'sfx')
rng = np.random.default_rng(7)


def t(sec: float) -> np.ndarray:
    return np.arange(int(sec * SR)) / SR


def noise(sec: float) -> np.ndarray:
    return rng.normal(0, 1, int(sec * SR))


def band(x: np.ndarray, lo: float, hi: float, soft=0.25) -> np.ndarray:
    """Passa-faixa por FFT, com bordas suaves."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if lo > 0:
        g *= 1 / (1 + (lo / np.maximum(f, 1e-6)) ** (2 / soft))
    g *= 1 / (1 + (f / hi) ** (2 / soft))
    return np.fft.irfft(np.fft.rfft(x) * g, n)


def env(n: int, a: float, d: float, curve=4.0) -> np.ndarray:
    """Ataque linear (a s) e queda exponencial (d s)."""
    x = np.arange(n) / SR
    e = np.minimum(1, x / max(a, 1e-5)) * np.exp(-np.maximum(0, x - a) * curve / max(d, 1e-5))
    return e


def sweep(f0: float, f1: float, sec: float, curve=1.0) -> np.ndarray:
    x = t(sec)
    k = (x / sec) ** curve
    f = f0 + (f1 - f0) * k
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def pad(x: np.ndarray, sec: float) -> np.ndarray:
    n = int(sec * SR)
    return np.concatenate([x, np.zeros(max(0, n - len(x)))])[:max(n, len(x))]


def mix(*parts: tuple[np.ndarray, float]) -> np.ndarray:
    """Soma partes com atraso em segundos: (sinal, início)."""
    n = max(len(p) + int(s * SR) for p, s in parts)
    out = np.zeros(n)
    for p, s in parts:
        i = int(s * SR)
        out[i:i + len(p)] += p
    return out


def crackle(sec: float, rate: float, smooth=0.002) -> np.ndarray:
    """Envelope granulado: impulsos aleatórios, como fibra rasgando."""
    n = int(sec * SR)
    imp = (rng.random(n) < rate / SR).astype(float) * rng.uniform(0.4, 1.0, n)
    k = np.exp(-np.arange(int(smooth * 6 * SR)) / (smooth * SR))
    return np.convolve(imp, k)[:n]


def save(name: str, x: np.ndarray, peak=0.9, width=0.0) -> None:
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    fade = min(len(x) // 4, int(0.012 * SR))
    x[-fade:] *= np.linspace(1, 0, fade)
    if width > 0:  # largura estéreo: um canal um pouco atrasado
        d = int(width * SR)
        left, right = np.concatenate([x, np.zeros(d)]), np.concatenate([np.zeros(d), x])
    else:
        left = right = x
    st = np.stack([left, right], axis=1)
    data = (np.clip(st, -1, 1) * 32767).astype('<i2')
    os.makedirs(OUT, exist_ok=True)
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f'sfx {name:10s} {len(x) / SR:5.2f} s')


# ---------- efeitos ----------

def slide() -> np.ndarray:  # papel deslizando na mesa
    n = noise(0.26)
    lo = band(n, 500, 2500) * env(len(n), 0.09, 0.12, 3)
    hi = band(n, 2500, 9000) * np.roll(env(len(n), 0.12, 0.1, 3), int(0.03 * SR))
    tap = band(noise(0.05), 80, 900) * env(int(0.05 * SR), 0.002, 0.03)
    return mix((lo * 0.8 + hi * 0.6, 0), (tap * 0.9, 0.2))


def place() -> np.ndarray:  # papel assentando
    a = band(noise(0.06), 1200, 8000) * env(int(0.06 * SR), 0.001, 0.025)
    b = np.sin(2 * np.pi * 120 * t(0.09)) * env(int(0.09 * SR), 0.002, 0.05)
    return mix((a, 0), (b * 0.9, 0))


def tack() -> np.ndarray:  # letra colada
    a = band(noise(0.03), 2200, 9000) * env(int(0.03 * SR), 0.0006, 0.012)
    b = np.sin(2 * np.pi * 210 * t(0.04)) * env(int(0.04 * SR), 0.001, 0.02)
    return mix((a, 0), (b * 0.7, 0))


def stamp() -> np.ndarray:  # carimbo batendo
    sub = sweep(74, 46, 0.3, 0.5) * env(int(0.3 * SR), 0.003, 0.2, 3.2)
    body = np.sin(2 * np.pi * 150 * t(0.11)) * env(int(0.11 * SR), 0.001, 0.06)
    hit = band(noise(0.06), 250, 3800) * env(int(0.06 * SR), 0.0008, 0.03)
    rattle = band(noise(0.03), 900, 5000) * env(int(0.03 * SR), 0.001, 0.015)
    return mix((sub * 1.0, 0), (body * 0.7, 0), (hit * 0.85, 0), (rattle * 0.25, 0.07), (rattle * 0.14, 0.12))


def thud() -> np.ndarray:  # impacto grave para corte de cena
    sub = sweep(66, 40, 0.42, 0.5) * env(int(0.42 * SR), 0.004, 0.3, 3)
    click = band(noise(0.02), 400, 3000) * env(int(0.02 * SR), 0.0005, 0.01)
    return mix((sub, 0), (click * 0.35, 0))


def tape() -> np.ndarray:  # fita sendo puxada e colada
    n = int(0.34 * SR)
    g = crackle(0.34, 240, 0.0012) + 0.25
    body = band(noise(0.34), 1800, 9500) * g * np.minimum(1, np.arange(n) / (0.05 * SR)) * np.linspace(0.7, 1, n)
    snap = band(noise(0.03), 1500, 7000) * env(int(0.03 * SR), 0.0006, 0.015)
    return mix((body * 0.7, 0), (snap * 1.1, 0.33))


def tear() -> np.ndarray:  # papel rasgando
    n = int(0.6 * SR)
    g = crackle(0.6, 420, 0.0016) + 0.12
    lo = band(noise(0.6), 700, 3500) * np.linspace(1, 0.5, n)
    hi = band(noise(0.6), 3000, 11000) * np.linspace(0.4, 1, n)
    shape = np.minimum(1, np.arange(n) / (0.04 * SR)) * np.linspace(0.6, 1.0, n)
    return (lo + hi) * g * shape


def scribble() -> np.ndarray:  # lápis riscando
    n = int(0.46 * SR)
    strokes = np.abs(np.sin(2 * np.pi * (5.5 * t(0.46) + 0.6 * np.sin(2 * np.pi * 2.1 * t(0.46))))) ** 0.6
    return band(noise(0.46), 2400, 7500) * strokes * np.minimum(1, np.arange(n) / (0.02 * SR)) * (0.6 + 0.4 * crackle(0.46, 900, 0.0008))


def pop() -> np.ndarray:
    a = sweep(560, 250, 0.09, 0.4) * env(int(0.09 * SR), 0.001, 0.05)
    c = band(noise(0.012), 1500, 8000) * env(int(0.012 * SR), 0.0004, 0.006)
    return mix((a, 0), (c * 0.4, 0))


def tick() -> np.ndarray:
    a = np.sin(2 * np.pi * 2900 * t(0.03)) * env(int(0.03 * SR), 0.0004, 0.012)
    b = np.sin(2 * np.pi * 1150 * t(0.04)) * env(int(0.04 * SR), 0.0006, 0.02)
    return mix((a, 0), (b * 0.6, 0))


def shutter() -> np.ndarray:  # clique de câmera
    c1 = band(noise(0.03), 900, 6500) * env(int(0.03 * SR), 0.0005, 0.014)
    ping = np.sin(2 * np.pi * 2300 * t(0.05)) * env(int(0.05 * SR), 0.0005, 0.02)
    return mix((c1, 0), (ping * 0.25, 0), (c1 * 0.8, 0.055), (c1 * 0.3, 0.075))


def whoosh() -> np.ndarray:  # ar passando, para entradas grandes
    n = int(0.38 * SR)
    x = noise(0.38)
    lo = band(x, 250, 1400) * np.sin(np.pi * np.arange(n) / n) ** 2
    hi = band(x, 1400, 6000) * np.roll(np.sin(np.pi * np.arange(n) / n) ** 3, int(0.05 * SR))
    return lo * 0.9 + hi * 0.6


def riser() -> np.ndarray:  # ar crescendo antes de uma virada
    n = int(0.7 * SR)
    x = noise(0.7)
    k = (np.arange(n) / n) ** 2.4
    return (band(x, 400, 2200) * (1 - k * 0.5) + band(x, 2200, 9000) * k) * k


def ding() -> np.ndarray:  # sino de balcão
    x = t(1.1)
    parts = [(1318.5, 1.0, 0.7), (2640.0, 0.5, 0.45), (3975.0, 0.28, 0.3), (5290.0, 0.16, 0.2)]
    s = sum(a * np.sin(2 * np.pi * f * x) * np.exp(-x * 4.2 / d) for f, a, d in parts)
    strike = band(noise(0.01), 2500, 9000) * env(int(0.01 * SR), 0.0004, 0.005)
    return mix((s, 0), (strike * 0.5, 0))


def cowbell() -> np.ndarray:  # cowbell clássico: duas ondas quadradas num passa-faixa
    x = t(0.42)
    sq = np.sign(np.sin(2 * np.pi * 562 * x)) + np.sign(np.sin(2 * np.pi * 845 * x))
    return band(sq, 500, 4200, 0.4) * (0.75 * np.exp(-x * 22) + 0.25 * np.exp(-x * 7))


def brush() -> np.ndarray:  # pincelada
    n = int(0.36 * SR)
    return band(noise(0.36), 500, 3200) * np.sin(np.pi * np.arange(n) / n) ** 1.5 * (0.7 + 0.3 * crackle(0.36, 300, 0.003))


def snip() -> np.ndarray:  # tesoura
    a = band(noise(0.025), 2500, 9500) * env(int(0.025 * SR), 0.0005, 0.012)
    m = np.sin(2 * np.pi * 3400 * t(0.05)) * env(int(0.05 * SR), 0.0005, 0.02)
    return mix((a, 0), (m * 0.3, 0), (a * 0.9, 0.07), (m * 0.25, 0.07))


def register() -> np.ndarray:  # caixa registradora: mecanismo e sino
    c = band(noise(0.03), 700, 5000) * env(int(0.03 * SR), 0.0006, 0.015)
    return mix((c, 0), (c * 0.7, 0.06), (thud()[: int(0.2 * SR)] * 0.5, 0.1), (ding() * 0.8, 0.13))


def drawer() -> np.ndarray:  # gaveta abrindo
    n = int(0.3 * SR)
    roll = band(noise(0.3), 150, 1300) * np.linspace(0.3, 1, n) * (0.6 + 0.4 * crackle(0.3, 160, 0.004))
    stop = thud()[: int(0.18 * SR)]
    return mix((roll, 0), (stop * 0.8, 0.27))


# ---------- base rítmica, feita dos sons da mesa ----------

def bed() -> np.ndarray:
    bpm = 98.0
    beat = 60 / bpm
    bars = 4
    length = bars * 4 * beat
    out = np.zeros(int(length * SR) + SR)
    kick = thud()[: int(0.3 * SR)]
    tap = place()
    hat = tack() * 0.5
    sn = snip()
    swing = 0.14 * beat  # atraso das colcheias fracas

    def put(sig: np.ndarray, when: float, gain: float) -> None:
        i = int(when * SR)
        out[i:i + len(sig)] += sig * gain

    notes = [73.42, 73.42, 87.31, 65.41]  # ré, ré, fá, dó
    for b in range(bars):
        t0 = b * 4 * beat
        put(kick, t0, 0.9)
        put(kick, t0 + 2.5 * beat + swing, 0.6)
        put(sn, t0 + 1 * beat, 0.34)
        put(sn, t0 + 3 * beat, 0.4)
        for e in range(8):
            when = t0 + e * 0.5 * beat + (swing if e % 2 else 0)
            put(hat, when, 0.34 if e % 2 else 0.2)
        put(tap, t0 + 1.5 * beat + swing, 0.3)
        put(tap, t0 + 3.5 * beat + swing, 0.26)
        if b % 2 == 1:
            put(tap, t0 + 3.75 * beat, 0.22)
        # baixo: nota curta e redonda
        for when, dur in ((0.0, 1.4), (2.5 * beat + swing, 0.9)):
            x = t(dur * beat)
            f = notes[b]
            tone = (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * 2 * f * x)) * np.minimum(1, x / 0.012) * np.exp(-x * 3.2)
            put(tone, t0 + when, 0.5)
    n = int(length * SR)
    loop = out[:n]
    loop[: len(out) - n] += out[n:]  # a cauda volta para o começo, para emendar sem estalo
    return loop


if __name__ == '__main__':
    for name, fn, peak, width in [
        ('slide', slide, 0.7, 0.004), ('place', place, 0.7, 0), ('tack', tack, 0.6, 0), ('stamp', stamp, 0.95, 0),
        ('thud', thud, 0.9, 0), ('tape', tape, 0.6, 0.003), ('tear', tear, 0.75, 0.005), ('scribble', scribble, 0.5, 0.002),
        ('pop', pop, 0.7, 0), ('tick', tick, 0.6, 0), ('shutter', shutter, 0.7, 0), ('whoosh', whoosh, 0.7, 0.006),
        ('riser', riser, 0.6, 0.006), ('ding', ding, 0.6, 0.001), ('cowbell', cowbell, 0.7, 0), ('brush', brush, 0.6, 0.004),
        ('snip', snip, 0.6, 0), ('register', register, 0.75, 0.001), ('drawer', drawer, 0.7, 0.002),
    ]:
        save(name, fn(), peak, width)
    # a base não ganha largura estéreo nem fade: precisa emendar em loop
    x = bed()
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.8
    data = (np.stack([x, x], axis=1) * 32767).astype('<i2')
    with wave.open(os.path.join(OUT, 'bed.wav'), 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f'sfx bed        {len(x) / SR:5.2f} s (loop)')
