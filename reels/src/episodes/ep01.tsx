import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Arrow, Blob, Cutout, EarTag, Em, EndCard, Hl, Lollipop, Loupe, Mark, mono, PaintCan, Paper, Piece, Ransom, Reveal, Row, Scene, SeriesTag, Sfx, Source, Stamp, Strawberry, T, Tape, type SceneDef } from '../kit';
import { C, SANS, SERIF } from '../theme';

/**
 * PAPEL PASSADO · Nº 01 · A vaca roxa era um morango
 * História real: o morango do amor (2025) e a marca registrada desde 2010.
 * Os tempos de cada cena seguem a narração (ver ROTEIROS.md).
 */

/* 1 · Gancho (0 a 4,2 s): "Em 2025, a vaca roxa do Brasil foi um morango." */
const S1: React.FC = () => (
  <Scene bg="cream" topo={0} seed={1} cam={[1.0, 1.05]} punch={[[30, 0.03]]}>
    <SeriesTag n="01" />
    <Piece x={64} y={456} seed={1} boil={0.4}>
      <T size={50} upper color={C.wine}>Em 2025,</T>
    </Piece>
    <Piece x={64} y={524} seed={2} boil={false}>
      <Ransom lines={['A VACA', 'ROXA']} size={138} at={0} stagger={1} seed={5} />
    </Piece>
    <Piece x={58} y={858} rot={-2} seed={3} enter={{ kind: 'stamp', at: 30 }} z={5}>
      <Paper w={900} h={110} color="wine" torn="r" seed={3} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <T size={51} upper>do Brasil foi um morango.</T>
      </Paper>
    </Piece>
    <Piece x={84} y={1036} rot={2.2} seed={4} enter={{ kind: 'slide', at: 6, from: 'bottom', dist: 1100, dur: 10 }}>
      <Paper w={700} h={360} color="kraft" torn="all" seed={4} />
    </Piece>
    <Piece x={104} y={1010} rot={-3.5} seed={6} enter={{ kind: 'slide', at: 10, from: 'right', dist: 1300, dur: 10 }}>
      <Cutout name="cow-wine" w={640} />
    </Piece>
    <Piece x={330} y={1032} rot={-9} seed={7} enter={{ kind: 'cut', at: 20 }} z={3}>
      <Tape w={160} h={46} color="cream" seed={7} />
    </Piece>
    <Piece x={736} y={1020} rot={12} seed={8} enter={{ kind: 'drop', at: 36, dur: 10 }} z={6} boil={1.4}>
      <Strawberry w={250} stick />
    </Piece>
    {[0, 2, 4, 6, 8].map((f) => <Sfx key={f} name="tack" at={f} vol={0.5} />)}
    <Sfx name="slide" at={6} vol={0.6} />
    <Sfx name="stamp" at={30} vol={0.9} />
    <Sfx name="place" at={44} vol={0.8} />
  </Scene>
);

const HERD: [number, number, number][] = [[70, 760, -2], [380, 740, 1.5], [690, 765, -1], [80, 990, 2], [385, 1000, -1.5], [695, 985, 1]];

/* 2 · A ideia (4,2 a 10,8 s): "num pasto de vacas iguais, só a diferente é lembrada." */
const S2: React.FC = () => (
  <Scene bg="wine" topo={1} seed={2} cam={[1.03, 1.0]} punch={[[96, 0.035]]}>
    <Piece x={64} y={376} seed={11} boil={0.4}>
      <T size={60} upper color={C.cream} w={900}>
        <Reveal at={0}>Num pasto de vacas <Mark at={14} color={C.kraft} seed={3}>iguais,</Mark></Reveal>
        <Reveal at={84}>só a diferente é <Em color={C.kraft}>lembrada.</Em></Reveal>
      </T>
    </Piece>
    <Piece x={36} y={690} rot={-1.2} seed={12} enter={{ kind: 'slide', at: 4, from: 'left', dist: 1200 }}>
      <Paper w={1008} h={540} color="cream" torn="all" seed={12} />
    </Piece>
    {HERD.map(([x, y, rot], i) => (
      <Piece key={i} x={x} y={y} rot={rot} seed={20 + i} enter={{ kind: 'pop', at: 14 + i * 5, dur: 6 }} exit={i === 4 ? { kind: 'cut', at: 96 } : undefined}>
        <Cutout name="cow" w={300} />
      </Piece>
    ))}
    {HERD.map((_, i) => <Sfx key={i} name="place" at={14 + i * 5} vol={0.5} />)}
    <Piece x={230} y={830} rot={3} seed={30} enter={{ kind: 'stamp', at: 96 }} z={5}>
      <Cutout name="cow-wine" w={610} />
    </Piece>
    <Source at={110} dark>A ideia é de Seth Godin, no livro A Vaca Roxa.</Source>
    <Sfx name="slide" at={4} vol={0.5} />
    <Sfx name="stamp" at={96} vol={0.9} />
  </Scene>
);

const Tile: React.FC<{ at: number; seed: number }> = ({ at, seed }) => {
  const frame = useCurrentFrame();
  const on = frame >= at;
  const k = on ? (frame - at < 2 ? 1.18 : frame - at < 4 ? 0.95 : 1) : 0;
  return (
    <div style={{ width: 118, height: 118, background: C.kraft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {on && <div style={{ transform: `scale(${k}) rotate(${(seed % 5) * 6 - 12}deg)` }}><Strawberry w={62} shadow={false} seed={seed} /></div>}
    </div>
  );
};

/** Celular genérico de papel, com o feed tomado por morangos. */
const Feed: React.FC<{ at: number }> = ({ at }) => (
  <div style={{ width: 430, padding: 18, background: C.night, borderRadius: 46, boxShadow: '0 10px 12px rgba(10,2,6,0.3)' }}>
    <div style={{ background: C.cream, borderRadius: 30, padding: '20px 14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 44, height: 44, borderRadius: 22, background: C.wine }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, width: '62%', background: C.winedeep, opacity: 0.6 }} />
          <div style={{ height: 10, width: '38%', background: C.winedeep, opacity: 0.3, marginTop: 8 }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 118px)', gap: 6, justifyContent: 'center' }}>
        {Array.from({ length: 12 }, (_, i) => <Tile key={i} at={at + i * 4} seed={i + 1} />)}
      </div>
    </div>
  </div>
);

/* 3 · O morango (10,8 a 18,4 s): "Aí veio o morango do amor..." */
const S3: React.FC = () => (
  <Scene bg="kraft" topo={0} seed={3} cam={[1.0, 1.05]} punch={[[64, 0.03]]}>
    <Piece x={64} y={376} seed={40} boil={0.4}>
      <T size={64} upper color={C.wine} w={900}>
        <Reveal at={0}>Aí veio o</Reveal>
        <Reveal at={8}><Hl>morango do amor.</Hl></Reveal>
      </T>
    </Piece>
    <Piece x={66} y={566} rot={-2} seed={41} enter={{ kind: 'pop', at: 22 }}>
      <Paper w={270} h={54} color="white" seed={41} shadow="soft" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.wine }}>
        <span style={mono}>Julho de 2025</span>
      </Paper>
    </Piece>
    <Piece x={84} y={700} rot={-8} seed={42} enter={{ kind: 'drop', at: 10 }} boil={1.4}>
      <Strawberry w={300} stick />
    </Piece>
    <Piece x={520} y={600} rot={4} seed={43} enter={{ kind: 'slide', at: 64, from: 'right', dist: 900, dur: 8 }}>
      <Feed at={78} />
    </Piece>
    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => <Sfx key={i} name="pop" at={78 + i * 4} vol={0.3} />)}
    <Piece x={64} y={1130} rot={-5} seed={44} enter={{ kind: 'stamp', at: 132 }} z={5}>
      <Paper w={430} h={84} color="wine" torn="r" seed={44} style={{ display: 'flex', alignItems: 'center', paddingLeft: 24 }}>
        <T size={38} upper ls="0.02em">em toda vitrine</T>
      </Paper>
    </Piece>
    <Piece x={110} y={1244} rot={3} seed={45} enter={{ kind: 'stamp', at: 156 }} z={5}>
      <Paper w={370} h={84} color="white" torn="l" seed={45} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <T size={38} upper color={C.wine} ls="0.02em">em todo feed</T>
      </Paper>
    </Piece>
    <Sfx name="place" at={18} vol={0.8} />
    <Sfx name="slide" at={64} vol={0.55} />
    <Sfx name="stamp" at={132} vol={0.7} />
    <Sfx name="stamp" at={156} vol={0.7} />
  </Scene>
);

const PAINT: [number, number, number, number][] = [[30, 800, -2, 110], [355, 770, 2, 122], [20, 1010, 1.5, 134], [345, 1000, -1, 146], [670, 1020, 2.5, 158]];

const Painted: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  return <Cutout name={frame >= at ? 'cow-wine' : 'cow'} w={330} />;
};

/* 4 · A tinta (18,4 a 25,4 s): "o pasto inteiro comprou tinta." */
const S4: React.FC = () => (
  <Scene bg="cream" topo={1} seed={4} cam={[1.04, 1.0]} punch={[[70, 0.03]]}>
    <Piece x={64} y={376} seed={80} boil={0.4}>
      <T size={58} upper color={C.wine} w={900}>
        <Reveal at={0}>Quando uma vaca roxa</Reveal>
        <Reveal at={8}>dá <Mark at={18} seed={5}>certo,</Mark></Reveal>
      </T>
    </Piece>
    <Piece x={52} y={556} rot={-1.5} seed={81} enter={{ kind: 'stamp', at: 70 }} z={4}>
      <Paper w={930} h={156} color="wine" torn="b" seed={81} style={{ padding: '28px 34px' }}>
        <T size={54} upper lh={1.06}>o pasto inteiro compra <Em color={C.kraft}>tinta.</Em></T>
      </Paper>
    </Piece>
    {PAINT.map(([x, y, rot, at], i) => (
      <React.Fragment key={i}>
        <Piece x={x - 20} y={y - 20} seed={100 + i} rot={i * 40} enter={{ kind: 'pop', at, dur: 4 }}>
          <Blob w={370} h={240} color={C.wine} seed={i + 2} />
        </Piece>
        <Piece x={x} y={y} rot={rot} seed={90 + i} enter={{ kind: 'pop', at: 4 + i * 4, dur: 6 }} move={(f) => (f >= at && f < at + 4 ? { scale: 1.1, rot: 3 } : {})}>
          <Painted at={at} />
        </Piece>
        <Sfx name="place" at={4 + i * 4} vol={0.4} />
        <Sfx name="brush" at={at} vol={0.7} />
      </React.Fragment>
    ))}
    <Piece x={812} y={776} rot={8} seed={110} enter={{ kind: 'drop', at: 84 }} z={5}>
      <PaintCan w={200} />
    </Piece>
    <Piece x={290} y={1300} rot={-2.5} seed={111} enter={{ kind: 'pop', at: 176 }} z={6}>
      <Paper w={540} h={84} color="white" torn="l" seed={111} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <T size={36} upper color={C.wine} ls="0.01em">qual era a primeira?</T>
      </Paper>
    </Piece>
    <Sfx name="stamp" at={70} vol={0.9} />
    <Sfx name="thud" at={92} vol={0.5} />
    <Sfx name="pop" at={176} vol={0.5} />
  </Scene>
);

/* 5 · A virada (25,4 a 35 s): "Morango do Amor já era marca registrada desde 2010..." */
const S5: React.FC = () => (
  <Scene bg="winedeep" topo={1} seed={5} cam={[1.0, 1.04]} punch={[[140, 0.03]]}>
    <Piece x={64} y={376} seed={120} boil={0.4}>
      <T size={60} upper color={C.cream} w={900}>
        <Reveal at={0}>Só que pouca gente</Reveal>
        <Reveal at={8}>olhou <Mark at={20} color={C.kraft} seed={6}>o nome.</Mark></Reveal>
      </T>
    </Piece>
    <Piece x={64} y={586} rot={-3} seed={121} enter={{ kind: 'slide', at: 14, from: 'left', dist: 1100, dur: 8 }}>
      <Paper w={600} h={132} color="kraft" torn="r" seed={121} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 84, color: C.winedeep, lineHeight: 1 }}>Morango do Amor</span>
      </Paper>
    </Piece>
    <Piece x={520} y={520} rot={-6} seed={122} enter={{ kind: 'slide', at: 34, from: 'right', dist: 900, dur: 8 }} exit={{ kind: 'slide', at: 92, to: 'right', dist: 900, dur: 6 }} z={4} boil={1.6}>
      <Loupe w={330} />
    </Piece>
    <Piece x={120} y={846} rot={1.5} seed={123} enter={{ kind: 'drop', at: 100, dur: 10 }} z={3}>
      <Paper w={820} h={440} color="cream" seed={123} style={{ padding: 22, color: C.winedeep }}>
        <div style={{ border: `3px double ${C.wine}`, height: '100%', boxSizing: 'border-box', padding: '20px 30px' }}>
          <div style={{ ...mono, color: C.wine, fontSize: 24 }}>Marca registrada</div>
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 82, lineHeight: 1.1, color: C.wine, marginBottom: 6 }}>Morango do Amor</div>
          <Row k="Desde" v="2010" />
          <Row k="Titular" v="Peccin, indústria de doces" />
          <Row k="Produto" v="um pirulito" />
        </div>
      </Paper>
    </Piece>
    <Arrow from={[250, 732]} to={[318, 842]} bend={-0.3} at={116} dur={8} color={C.kraft} seed={3} />
    <Piece x={770} y={872} rot={-12} seed={124} enter={{ kind: 'stamp', at: 140 }} z={6}>
      <Stamp text="R" round size={74} color={C.wine} />
    </Piece>
    <Piece x={846} y={1050} rot={14} seed={125} enter={{ kind: 'pop', at: 196 }} z={6} boil={1.4}>
      <Lollipop w={138} />
    </Piece>
    <Source at={110} dark>Fontes: Jornal Contábil, 4/8/2025, e Correio Braziliense. A marca citada pertence à sua titular, sem vínculo com a Velmont.</Source>
    <Sfx name="slide" at={14} vol={0.55} />
    <Sfx name="whoosh" at={34} vol={0.4} />
    <Sfx name="place" at={108} vol={0.8} />
    <Sfx name="scribble" at={116} vol={0.4} />
    <Sfx name="stamp" at={140} vol={1} />
    <Sfx name="pop" at={196} vol={0.5} />
  </Scene>
);

const Page: React.FC<{ year: string; name: React.ReactNode; seed: number; berry?: boolean }> = ({ year, name, seed, berry = true }) => (
  <Paper w={600} h={600} color="white" torn="t" seed={seed} rough={5} style={{ color: C.winedeep }}>
    <div style={{ background: C.wine, color: C.cream, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
      <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 104, letterSpacing: '0.02em' }}>{year}</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 430, gap: 14 }}>
      {berry && <Strawberry w={150} shadow={false} seed={seed} />}
      <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 76, lineHeight: 1, textAlign: 'center', color: C.wine }}>{name}</div>
    </div>
  </Paper>
);

/* 6 · A onda (35 a 40,4 s): "Em 2026, a onda trocou de nome: morango cravejado." */
const S6: React.FC = () => (
  <Scene bg="kraft" topo={0} seed={6} cam={[1.04, 1.0]}>
    <Piece x={64} y={376} seed={130} boil={0.4}>
      <T size={60} upper color={C.wine} w={900}>
        <Reveal at={0}>Em 2026, a onda</Reveal>
        <Reveal at={8}><Hl>trocou de nome.</Hl></Reveal>
      </T>
    </Piece>
    <Piece x={240} y={690} rot={2} seed={131}>
      <Page year="20__" name={<span style={{ fontSize: 220 }}>?</span>} seed={31} berry={false} />
    </Piece>
    <Piece x={240} y={690} rot={-1.5} seed={132} exit={{ kind: 'slide', at: 114, to: 'left', dist: 1300, dur: 8 }} z={2}>
      <Page year="2026" name="morango cravejado" seed={32} />
    </Piece>
    <Piece x={240} y={690} rot={1} seed={133} exit={{ kind: 'slide', at: 36, to: 'top', dist: 1500, dur: 8 }} z={3}>
      <Page year="2025" name="morango do amor" seed={33} />
    </Piece>
    <Source at={44}>Fonte: O Povo, 1/9/2026.</Source>
    <Sfx name="tear" at={34} vol={0.7} />
    <Sfx name="tear" at={112} vol={0.7} />
    <Sfx name="thud" at={122} vol={0.4} />
  </Scene>
);

/* 7a · Lição, parte 1 (40,4 a 45 s): "Antes de estampar o nome da moda na sua embalagem, pesquisa." */
const S7a: React.FC = () => (
  <Scene bg="wine" topo={0} seed={7} cam={[1.0, 1.04]} punch={[[66, 0.03]]}>
    <Piece x={64} y={376} seed={140} boil={0.4}>
      <T size={52} upper color={C.cream} w={900} lh={1.08}>
        <Reveal at={0}>Antes de estampar o nome</Reveal>
        <Reveal at={8}>da moda na embalagem:</Reveal>
      </T>
    </Piece>
    <Piece x={58} y={540} rot={-2} seed={141} enter={{ kind: 'stamp', at: 66 }} z={5}>
      <Paper w={520} h={150} color="kraft" torn="r" seed={141} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <T size={96} upper color={C.winedeep}>pesquisa.</T>
      </Paper>
    </Piece>
    <Piece x={150} y={830} rot={-3} seed={142} enter={{ kind: 'slide', at: 12, from: 'left', dist: 1100, dur: 8 }}>
      <Paper w={520} h={400} color="kraftdeep" seed={142}>
        <div style={{ height: 70, background: 'rgba(10,2,6,0.14)' }} />
        <div style={{ margin: '56px auto 0', width: 400, transform: 'rotate(-3deg)' }}>
          <Paper w={400} h={170} color="white" seed={43} shadow="soft" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.wine }}>
            <span style={{ ...mono, fontSize: 17, opacity: 0.7 }}>novidade</span>
            <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 62, lineHeight: 1.05 }}>o nome da moda</span>
          </Paper>
        </div>
      </Paper>
    </Piece>
    <Piece x={520} y={820} rot={-8} seed={143} enter={{ kind: 'slide', at: 40, from: 'right', dist: 900, dur: 8 }} z={4} boil={1.6}>
      <Loupe w={360} />
    </Piece>
    <Sfx name="slide" at={12} vol={0.55} />
    <Sfx name="whoosh" at={40} vol={0.4} />
    <Sfx name="stamp" at={66} vol={1} />
  </Scene>
);

/* 7b · Lição, parte 2 (45 a 50 s): "E quando a moda for criação sua, registra antes de a onda quebrar." */
const S7b: React.FC = () => (
  <Scene bg="winedeep" topo={1} seed={8} cam={[1.0, 1.04]} punch={[[70, 0.03]]}>
    <Piece x={64} y={376} seed={150} boil={0.4}>
      <T size={52} upper color={C.cream} w={900} lh={1.08}>
        <Reveal at={0}>E quando a moda</Reveal>
        <Reveal at={8}>for criação <Em color={C.kraft}>sua:</Em></Reveal>
      </T>
    </Piece>
    <Piece x={58} y={540} rot={-2} seed={151} enter={{ kind: 'stamp', at: 46 }} z={5}>
      <Paper w={560} h={128} color="cream" torn="r" seed={151} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <T size={84} upper color={C.wine}>registra</T>
      </Paper>
    </Piece>
    <Piece x={150} y={676} rot={1.5} seed={152} enter={{ kind: 'slide', at: 58, from: 'right', dist: 1100, dur: 8 }} z={5}>
      <Paper w={760} h={92} color="kraft" torn="l" seed={152} style={{ display: 'flex', alignItems: 'center', paddingLeft: 40 }}>
        <T size={46} upper color={C.winedeep}>antes de a onda quebrar.</T>
      </Paper>
    </Piece>
    <Piece x={90} y={860} rot={1.5} seed={153} enter={{ kind: 'slide', at: 10, from: 'left', dist: 1300 }}>
      <Cutout name="cow-wine" w={820} />
    </Piece>
    <Piece x={330} y={960} rot={-12} seed={154} enter={{ kind: 'stamp', at: 78 }} z={5}>
      <Stamp text="R" round size={112} color={C.cream} />
    </Piece>
    <Piece x={764} y={896} rot={10} seed={155} enter={{ kind: 'drop', at: 88, dur: 10 }} z={6} origin="50% 0%" move={(f) => ({ rot: Math.sin(Math.floor(f / 2) / 3) * 5 })}>
      <EarTag w={100} />
    </Piece>
    <Sfx name="slide" at={10} vol={0.55} />
    <Sfx name="stamp" at={46} vol={0.8} />
    <Sfx name="slide" at={58} vol={0.5} />
    <Sfx name="stamp" at={78} vol={1} />
    <Sfx name="ding" at={92} vol={0.3} />
  </Scene>
);

/* 8 · Pergunta e CTA (50 a 55,2 s): "Qual é a vaca roxa do seu negócio? Ela tem dono no papel?" */
const S8: React.FC = () => (
  <Scene bg="cream" topo={1} seed={9} cam={[1.04, 1.0]}>
    <Piece x={64} y={392} seed={160} boil={0.4}>
      <T size={58} upper color={C.wine} w={900}>
        <Reveal at={0}>Qual é a vaca roxa</Reveal>
        <Reveal at={8}>do seu negócio?</Reveal>
      </T>
    </Piece>
    <Piece x={60} y={580} seed={161} boil={0.5}>
      <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 138, lineHeight: 0.98, color: C.wine, letterSpacing: '-0.02em' }}>
        <Reveal at={52}>Ela tem dono</Reveal>
        <Reveal at={62}>no papel?</Reveal>
      </div>
    </Piece>
    <Piece x={520} y={900} rot={-3} seed={162} enter={{ kind: 'pop', at: 70 }}>
      <Cutout name="cow-wine" w={470} />
    </Piece>
    <Arrow from={[330, 880]} to={[528, 1010]} bend={0.28} at={78} dur={8} color={C.wine} seed={5} />
    <Piece x={64} y={1210} rot={-2} seed={163} enter={{ kind: 'slide', at: 96, from: 'left', dist: 1200, dur: 8 }} z={5}>
      <Paper w={800} h={160} color="wine" torn="r" seed={163} style={{ padding: '26px 30px' }}>
        <T size={41} upper lh={1.1}>Manda pra quem está surfando <Mark at={112} color={C.kraft} seed={6}>a onda</Mark> agora.</T>
      </Paper>
    </Piece>
    <Sfx name="thud" at={52} vol={0.5} />
    <Sfx name="pop" at={70} vol={0.5} />
    <Sfx name="scribble" at={78} vol={0.4} />
    <Sfx name="slide" at={96} vol={0.55} />
  </Scene>
);

export const EP01: SceneDef[] = [
  { id: 'gancho', dur: 126, el: <S1 /> },
  { id: 'ideia', dur: 198, el: <S2 /> },
  { id: 'morango', dur: 228, el: <S3 /> },
  { id: 'tinta', dur: 210, el: <S4 /> },
  { id: 'virada', dur: 288, el: <S5 /> },
  { id: 'onda', dur: 162, el: <S6 /> },
  { id: 'pesquisa', dur: 140, el: <S7a /> },
  { id: 'registra', dur: 148, el: <S7b /> },
  { id: 'pergunta', dur: 156, el: <S8 /> },
  { id: 'assinatura', dur: 72, el: <EndCard /> },
];
