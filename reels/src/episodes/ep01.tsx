import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { Blob, Cutout, EarTag, Em, Flash, Hl, Mark, PaintCan, Paper, Piece, Ransom, Reveal, Scene, Scribble, Sfx, Stamp, T, Tape, type SceneDef } from '../kit';
import { C, SANS, SERIF, W } from '../theme';

/**
 * PAPEL PASSADO · Nº 01 · A vaca roxa
 * Fórmula: Ideia, Derrubada, Alternativa. Função: alcance (envio).
 */

export const SeriesTag: React.FC<{ n: string; at?: number; dark?: boolean }> = ({ n, at = 0, dark }) => (
  <Piece x={64} y={372} rot={-1.5} seed={90} enter={{ kind: 'slide', at, from: 'left', dist: 500, dur: 8 }}>
    <Paper w={372} h={58} color={dark ? 'kraft' : 'wine'} torn="r" seed={90} shadow="soft" style={{ display: 'flex', alignItems: 'center', paddingLeft: 18 }}>
      <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 21, letterSpacing: '0.16em' }}>PAPEL PASSADO · Nº {n}</span>
    </Paper>
  </Piece>
);

const S1: React.FC = () => (
  <Scene bg="cream" topo={0} seed={1} cam={[1.0, 1.05]} punch={[[26, 0.03]]}>
    <SeriesTag n="01" />
    <Piece x={64} y={470} seed={2} boil={false}>
      <Ransom lines={['A VACA', 'ROXA']} size={150} at={0} stagger={1} seed={5} />
    </Piece>
    <Piece x={58} y={832} rot={-2} seed={3} enter={{ kind: 'stamp', at: 26 }}>
      <Paper w={792} h={118} color="wine" torn="r" seed={3} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <T size={72} upper>tem um problema.</T>
      </Paper>
    </Piece>
    <Piece x={96} y={1000} rot={2.2} seed={4} enter={{ kind: 'slide', at: 6, from: 'bottom', dist: 1100, dur: 10 }}>
      <Paper w={860} h={380} color="kraft" torn="all" seed={4} />
    </Piece>
    <Piece x={130} y={960} rot={-3.5} seed={6} enter={{ kind: 'slide', at: 10, from: 'right', dist: 1300, dur: 10 }}>
      <Cutout name="cow-wine" w={740} />
    </Piece>
    <Piece x={400} y={990} rot={-9} seed={7} enter={{ kind: 'cut', at: 20 }} z={3}>
      <Tape w={170} h={48} color="cream" seed={7} />
    </Piece>
    <Piece x={548} y={1338} rot={3} seed={8} enter={{ kind: 'pop', at: 52 }} z={4}>
      <Paper w={430} h={84} color="white" seed={8} shadow="soft" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <T size={23} weight={700} color={C.wine} ls="0" align="center" lh={1.2}>(a nossa é vinho.<br />marca boa não sai da paleta.)</T>
      </Paper>
    </Piece>
    <Piece x={800} y={1210} rot={165} seed={9} boil={0.6} z={4}>
      <Scribble kind="arrow" w={100} h={110} at={58} dur={8} seed={9} stroke={6} />
    </Piece>
    <Sfx name="cowbell" at={0} vol={0.55} />
    {[0, 2, 4, 6, 8].map((f) => <Sfx key={f} name="tack" at={f} vol={0.5} />)}
    <Sfx name="slide" at={6} vol={0.6} />
    <Sfx name="whoosh" at={9} vol={0.5} />
    <Sfx name="tape" at={18} vol={0.4} />
    <Sfx name="stamp" at={26} vol={1} />
    <Sfx name="pop" at={52} vol={0.5} />
    <Sfx name="scribble" at={58} vol={0.5} />
  </Scene>
);

const HERD: [number, number, number][] = [[70, 760, -2], [380, 740, 1.5], [690, 765, -1], [80, 990, 2], [385, 1000, -1.5], [695, 985, 1]];

const S2: React.FC = () => (
  <Scene bg="wine" topo={1} seed={2} cam={[1.03, 1.0]} punch={[[88, 0.035]]}>
    <Piece x={64} y={376} seed={11} boil={0.4}>
      <T size={62} upper color={C.cream} w={900}>
        <Reveal at={0}>Num pasto de vacas <Mark at={14} color={C.kraft} seed={3}>iguais,</Mark></Reveal>
        <Reveal at={8}>ninguém olha duas vezes.</Reveal>
      </T>
    </Piece>
    <Piece x={36} y={690} rot={-1.2} seed={12} enter={{ kind: 'slide', at: 4, from: 'left', dist: 1200 }}>
      <Paper w={1008} h={540} color="cream" torn="all" seed={12} />
    </Piece>
    {HERD.map(([x, y, rot], i) => (
      <Piece key={i} x={x} y={y} rot={rot} seed={20 + i} enter={{ kind: 'pop', at: 14 + i * 5, dur: 6 }} exit={i === 4 ? { kind: 'cut', at: 90 } : undefined}>
        <Cutout name="cow" w={300} />
      </Piece>
    ))}
    {HERD.map((_, i) => <Sfx key={i} name="place" at={14 + i * 5} vol={0.55} />)}
    <Piece x={230} y={830} rot={3} seed={30} enter={{ kind: 'stamp', at: 90 }} z={5}>
      <Cutout name="cow-wine" w={610} />
    </Piece>
    <Piece x={64} y={1262} rot={-2} seed={32} enter={{ kind: 'slide', at: 100, from: 'left', dist: 900, dur: 8 }} z={6}>
      <Paper w={640} h={104} color="kraft" torn="r" seed={32} style={{ display: 'flex', alignItems: 'center', paddingLeft: 26 }}>
        <T size={52} upper color={C.wine}>aí aparece <Em>uma roxa.</Em></T>
      </Paper>
    </Piece>
    <Piece x={64} y={1396} seed={33} boil={false} enter={{ kind: 'cut', at: 112 }}>
      <T size={21} weight={500} color={C.cream} ls="0" style={{ opacity: 0.72 }}>A ideia é de Seth Godin, no livro A Vaca Roxa.</T>
    </Piece>
    <Sfx name="slide" at={4} vol={0.5} />
    <Sfx name="cowbell" at={90} vol={0.6} />
    <Sfx name="stamp" at={90} vol={0.9} />
    <Sfx name="slide" at={100} vol={0.5} />
  </Scene>
);

const TAGS: { x: number; y: number; rot: number; at: number; text: string; color: 'kraft' | 'wine' | 'white'; w: number }[] = [
  { x: 560, y: 600, rot: 5, at: 40, text: 'ME PASSA O @', color: 'white', w: 330 },
  { x: 70, y: 1210, rot: -5, at: 52, text: 'OLHA ISSO', color: 'kraft', w: 280 },
  { x: 420, y: 1290, rot: 3, at: 64, text: 'QUE MARCA É ESSA?', color: 'wine', w: 470 },
];

const S3: React.FC = () => (
  <Scene bg="cream" topo={1} seed={3} cam={[1.0, 1.06]}>
    <Piece x={64} y={376} seed={40} boil={0.4}>
      <T size={78} upper color={C.wine} w={900}>
        <Reveal at={0}>O pasto inteiro</Reveal>
        <Reveal at={6}><Hl>para pra olhar.</Hl></Reveal>
      </T>
    </Piece>
    <Piece x={110} y={720} rot={-2} seed={41} boil={1.4}>
      <Cutout name="cow-wine" w={860} />
    </Piece>
    {[[70, 640, 220, 10], [800, 700, 190, 18], [760, 1130, 230, 26], [40, 1040, 170, 34]].map(([x, y, s, at], i) => (
      <React.Fragment key={i}>
        <Piece x={x} y={y} seed={50 + i} rot={i * 17} enter={{ kind: 'pop', at, dur: 4 }} exit={{ kind: 'cut', at: at + 14 }} z={4}>
          <Flash size={s} seed={i + 1} />
        </Piece>
        <Sfx name="shutter" at={at} vol={0.6} />
      </React.Fragment>
    ))}
    {TAGS.map((t, i) => (
      <React.Fragment key={i}>
        <Piece x={t.x} y={t.y} rot={t.rot} seed={60 + i} enter={{ kind: 'pop', at: t.at }} z={5}>
          <Paper w={t.w} h={78} color={t.color} torn={i === 1 ? 'r' : 'l'} seed={60 + i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <T size={34} upper ls="0.02em">{t.text}</T>
          </Paper>
        </Piece>
        <Sfx name="pop" at={t.at} vol={0.55} />
      </React.Fragment>
    ))}
    <Piece x={270} y={1150} rot={-20} seed={70} boil={0.6} z={5}>
      <Scribble kind="arrow" w={120} h={100} at={56} seed={2} stroke={6} />
    </Piece>
    <Sfx name="thud" at={0} vol={0.5} />
  </Scene>
);

const PAINT: [number, number, number, number][] = [[30, 900, -2, 118], [355, 870, 2, 130], [20, 1110, 1.5, 142], [345, 1100, -1, 154], [670, 1120, 2.5, 166]];

const Painted: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  return <Cutout name={frame >= at ? 'cow-wine' : 'cow'} w={330} />;
};

const S4: React.FC = () => (
  <Scene bg="kraft" topo={0} seed={4} cam={[1.04, 1.0]} punch={[[66, 0.03]]}>
    <Piece x={64} y={376} seed={80} boil={0.4}>
      <T size={64} upper color={C.wine} w={900}>
        <Reveal at={0}>Só que a história</Reveal>
        <Reveal at={6}>não conta <Mark at={16} seed={5}>o resto.</Mark></Reveal>
      </T>
    </Piece>
    <Piece x={52} y={590} rot={-1.5} seed={81} enter={{ kind: 'stamp', at: 66 }}>
      <Paper w={930} h={236} color="wine" torn="b" seed={81} style={{ padding: '30px 34px' }}>
        <T size={55} upper lh={1.08}>Quando a vaca roxa dá certo, todo mundo compra <Em color={C.kraft}>tinta.</Em></T>
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
        <Sfx name="pop" at={at} vol={0.35} />
      </React.Fragment>
    ))}
    <Piece x={690} y={820} rot={8} seed={110} enter={{ kind: 'drop', at: 84 }} z={5}>
      <PaintCan w={230} />
    </Piece>
    <Piece x={300} y={1340} rot={-2.5} seed={111} enter={{ kind: 'pop', at: 182 }} z={6}>
      <Paper w={520} h={84} color="white" torn="l" seed={111} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <T size={36} upper color={C.wine} ls="0.01em">e agora, qual é a sua?</T>
      </Paper>
    </Piece>
    <Sfx name="stamp" at={66} vol={0.9} />
    <Sfx name="thud" at={92} vol={0.6} />
    <Sfx name="pop" at={182} vol={0.5} />
  </Scene>
);

const S5: React.FC = () => (
  <Scene bg="winedeep" topo={1} seed={5} cam={[1.0, 1.03]} punch={[[104, 0.03]]}>
    <Piece x={64} y={376} seed={120} boil={0.4}>
      <T size={60} upper color={C.cream} w={900}>
        <Reveal at={0}>Ser diferente faz você</Reveal>
        <Reveal at={6}>ser <Em color={C.kraft}>lembrado.</Em></Reveal>
      </T>
    </Piece>
    <Piece x={64} y={560} seed={121} boil={0.4}>
      <T size={60} upper color={C.cream} w={900}>
        <Reveal at={62}>O que mantém o nome</Reveal>
        <Reveal at={68}>com você é o <Hl bg={C.kraft} color={C.winedeep}>registro.</Hl></Reveal>
      </T>
    </Piece>
    <Piece x={84} y={800} rot={1.5} seed={122} enter={{ kind: 'slide', at: 8, from: 'left', dist: 1300 }}>
      <Cutout name="cow-wine" w={860} />
    </Piece>
    <Piece x={330} y={900} rot={-12} seed={123} enter={{ kind: 'stamp', at: 104 }} z={5}>
      <Stamp text="R" round size={120} color={C.cream} />
    </Piece>
    <Piece x={792} y={836} rot={10} seed={124} enter={{ kind: 'drop', at: 114, dur: 10 }} z={6} origin="50% 0%" move={(f) => ({ rot: Math.sin(Math.floor(f / 2) / 3) * 5 })}>
      <EarTag w={104} />
    </Piece>
    <Piece x={64} y={1226} rot={-1} seed={125} enter={{ kind: 'slide', at: 150, from: 'bottom', dist: 700, dur: 8 }} z={7}>
      <Paper w={900} h={168} color="cream" torn="t" seed={125} style={{ padding: '38px 30px 0' }}>
        <T size={33} weight={700} color={C.winedeep} ls="-0.01em" lh={1.22}>Fazendeiro já marcava o gado pra provar de quem era. Hoje esse ferro se chama <Mark at={168} seed={8}>registro de marca.</Mark></T>
      </Paper>
    </Piece>
    <Sfx name="slide" at={8} vol={0.55} />
    <Sfx name="stamp" at={104} vol={1} />
    <Sfx name="ding" at={116} vol={0.35} />
    <Sfx name="slide" at={150} vol={0.5} />
    <Sfx name="scribble" at={168} vol={0.4} />
  </Scene>
);

const S6: React.FC = () => (
  <Scene bg="wine" topo={0} seed={6} cam={[1.05, 1.0]}>
    <Piece x={64} y={396} seed={130} boil={0.4}>
      <T size={62} upper color={C.cream} w={900}>
        <Reveal at={0}>A sua vaca já</Reveal>
        <Reveal at={6}>chamou atenção.</Reveal>
      </T>
    </Piece>
    <Piece x={60} y={610} seed={131} boil={0.5}>
      <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 148, lineHeight: 0.98, color: C.kraft, letterSpacing: '-0.02em' }}>
        <Reveal at={44}>E no papel,</Reveal>
        <Reveal at={56}>ela tem dono?</Reveal>
      </div>
    </Piece>
    <Piece x={64} y={1020} rot={-2} seed={132} enter={{ kind: 'slide', at: 104, from: 'left', dist: 1200 }}>
      <Paper w={760} h={226} color="cream" torn="r" seed={132} style={{ padding: '34px 30px' }}>
        <T size={47} upper color={C.wine} lh={1.08}>Manda pra quem tá <Mark at={122} seed={6}>pintando a vaca</Mark> agora.</T>
      </Paper>
    </Piece>
    <Piece x={800} y={1150} rot={62} seed={133} boil={0.8}>
      <Scribble kind="arrow" w={150} h={130} at={126} color={C.kraft} stroke={8} seed={7} />
    </Piece>
    <Piece x={640} y={920} rot={12} seed={134} enter={{ kind: 'pop', at: 112 }}>
      <Cutout name="cow-wine" w={300} />
    </Piece>
    <Sfx name="thud" at={44} vol={0.5} />
    <Sfx name="slide" at={104} vol={0.55} />
    <Sfx name="cowbell" at={112} vol={0.4} />
    <Sfx name="scribble" at={126} vol={0.5} />
  </Scene>
);

/** Cartão final da série: logo, assinatura e @. Reaproveitado em todos os episódios. */
export const EndCard: React.FC<{ line?: React.ReactNode }> = ({ line }) => (
  <Scene bg="winedeep" topo={1} seed={9} cam={[1.04, 1.0]} logo={false}>
    <Piece x={(W - 620) / 2} y={620} seed={140} boil={0.5} enter={{ kind: 'stamp', at: 4 }}>
      <Img src={staticFile('brand/logo-kraft.png')} style={{ display: 'block', width: 620, height: 'auto' }} />
    </Piece>
      <Piece x={(W - 560) / 2} y={980} rot={-2} seed={141} enter={{ kind: 'slide', at: 14, from: 'left', dist: 1100, dur: 8 }}>
        <Paper w={560} h={92} color="kraft" torn="lr" seed={141} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 34, letterSpacing: '0.2em', color: C.winedeep }}>PAPEL PASSADO</span>
        </Paper>
      </Piece>
      <AbsoluteFill style={{ top: 1110, height: 200, alignItems: 'center' }}>
        <Reveal at={24}>
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 58, color: C.cream, textAlign: 'center', lineHeight: 1.1 }}>{line ?? <>O que é seu, de papel passado.</>}</div>
        </Reveal>
      </AbsoluteFill>
    <Sfx name="stamp" at={4} vol={0.9} />
    <Sfx name="slide" at={14} vol={0.5} />
  </Scene>
);

export const EP01: SceneDef[] = [
  { id: 'gancho', dur: 102, el: <S1 /> },
  { id: 'ideia', dur: 180, el: <S2 /> },
  { id: 'pasto', dur: 120, el: <S3 /> },
  { id: 'derrubada', dur: 210, el: <S4 /> },
  { id: 'alternativa', dur: 240, el: <S5 /> },
  { id: 'cta', dur: 186, el: <S6 /> },
  { id: 'assinatura', dur: 72, el: <EndCard /> },
];
