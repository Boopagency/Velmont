import React from 'react';
import { Arrow, AU_CITY, auPoint, Burger, Doc, Em, EndCard, Ficha, Hl, Ladder, MapAU, mono, Pancakes, Paper, PaperPlane, Piece, Pin, Ransom, Reveal, Row, Scene, Scribble, SeriesTag, Sfx, Sign, Source, Stamp, T, type SceneDef } from '../kit';
import { C, SANS, SERIF } from '../theme';

/**
 * PAPEL PASSADO · Nº 07 · O Burger King sem nome
 * História real: Hungry Jack's, na Austrália (1971).
 * Os nomes aparecem só como texto, em tipografia da série: nenhum logo.
 */

/** Posição de uma cidade num mapa colocado em (mx, my), com largura mw. */
const city = (name: keyof typeof AU_CITY, mx: number, my: number, mw: number): [number, number] => {
  const [x, y] = auPoint(AU_CITY[name][0], AU_CITY[name][1], mw);
  return [mx + x, my + y];
};

/* 1 · Gancho: "Na Austrália, o Burger King não se chama Burger King." */
const S1: React.FC = () => (
  <Scene bg="cream" topo={0} seed={71} cam={[1.0, 1.05]} punch={[[30, 0.03]]}>
    <SeriesTag n="07" />
    <Piece x={64} y={456} seed={1} boil={0.4}>
      <T size={50} upper color={C.wine}>Na Austrália,</T>
    </Piece>
    <Piece x={64} y={524} seed={2} boil={false}>
      <Ransom lines={['O BURGER', 'KING']} size={120} at={0} seed={71} />
    </Piece>
    <Piece x={58} y={826} rot={-2} seed={3} enter={{ kind: 'stamp', at: 30 }} z={5}>
      <Paper w={920} h={108} color="wine" torn="r" seed={3} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <T size={47} upper>não se chama Burger King.</T>
      </Paper>
    </Piece>
    <Piece x={60} y={990} rot={-3} seed={4} enter={{ kind: 'slide', at: 6, from: 'bottom', dist: 1100, dur: 10 }}>
      <MapAU w={440} color={C.kraft} />
    </Piece>
    <Piece x={590} y={1010} rot={6} seed={5} enter={{ kind: 'drop', at: 14 }} boil={1.4}>
      <Burger w={370} />
    </Piece>
    {[0, 2, 4, 6, 8, 10].map((f) => <Sfx key={f} name="tack" at={f} vol={0.5} />)}
    <Sfx name="slide" at={6} vol={0.55} />
    <Sfx name="place" at={22} vol={0.8} />
    <Sfx name="stamp" at={30} vol={1} />
  </Scene>
);

/* 2 · Contexto: "Em 1970, o empresário Jack Cowin comprou os direitos... o nome já tinha dono por lá." */
const S2: React.FC = () => (
  <Scene bg="kraft" topo={1} seed={72} cam={[1.03, 1.0]} punch={[[196, 0.03]]}>
    <Piece x={64} y={376} rot={-2} seed={10} enter={{ kind: 'pop', at: 0 }}>
      <Paper w={170} h={64} color="wine" seed={10} shadow="soft" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ ...mono, fontSize: 32 }}>1970</span>
      </Paper>
    </Piece>
    <Piece x={64} y={462} seed={11} boil={0.4}>
      <T size={50} upper color={C.wine} w={900}>
        <Reveal at={8}>Um empresário compra os</Reveal>
        <Reveal at={14}>direitos da rede pro país.</Reveal>
      </T>
    </Piece>
    <Piece x={150} y={640} rot={1} seed={12} enter={{ kind: 'slide', at: 10, from: 'right', dist: 1200 }}>
      <MapAU w={760} color={C.wine} />
    </Piece>
    <Piece x={70} y={650} rot={-6} seed={13} enter={{ kind: 'drop', at: 44 }} z={3}>
      <Doc w={400} h={250} title="Contrato" seed={13}>
        <Row k="Direitos" v="Austrália" kw={110} />
        <div style={{ marginTop: 8 }}><Scribble kind="loop" w={220} h={54} at={60} dur={8} seed={3} stroke={5} /></div>
      </Doc>
    </Piece>
    <Piece x={120} y={940} seed={14} z={4} enter={{ kind: 'cut', at: 70 }} exit={{ kind: 'cut', at: 124 }} boil={false} move={(f) => {
      const p = Math.max(0, Math.min(1, (Math.floor(f / 2) * 2 - 70) / 50));
      return { x: -260 + p * 900, y: -180 * Math.sin(p * Math.PI), rot: -14 + p * 24 };
    }}>
      <PaperPlane w={170} />
    </Piece>
    <Piece x={64} y={1020} rot={-1.5} seed={15} enter={{ kind: 'slide', at: 150, from: 'left', dist: 900, dur: 8 }} z={5}>
      <Paper w={520} h={76} color="white" torn="r" seed={15} style={{ display: 'flex', alignItems: 'center', paddingLeft: 24 }}>
        <T size={36} upper color={C.wine} ls="0.01em">só faltou um detalhe:</T>
      </Paper>
    </Piece>
    <Piece x={120} y={1116} rot={-2} seed={16} enter={{ kind: 'stamp', at: 196 }} z={6}>
      <Paper w={840} h={124} color="cream" torn="r" seed={16} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <T size={56} upper color={C.wine}>o nome já tinha <Em>dono.</Em></T>
      </Paper>
    </Piece>
    <Sfx name="slide" at={10} vol={0.5} />
    <Sfx name="place" at={52} vol={0.8} />
    <Sfx name="scribble" at={60} vol={0.4} />
    <Sfx name="whoosh" at={72} vol={0.5} />
    <Sfx name="slide" at={150} vol={0.5} />
    <Sfx name="stamp" at={196} vol={1} />
  </Scene>
);

/* 3 · Conflito: "Um drive-in de Adelaide usava Burger King desde 1962, com a marca registrada." */
const S3: React.FC = () => {
  const [ax, ay] = city('adelaide', 100, 600, 800);
  return (
    <Scene bg="winedeep" topo={0} seed={73} cam={[1.0, 1.05]} punch={[[44, 0.03]]}>
      <Piece x={64} y={376} seed={20} boil={0.4}>
        <T size={52} upper color={C.cream} w={900}>
          <Reveal at={0}>Um drive-in de Adelaide</Reveal>
          <Reveal at={6}>usava o nome desde <Em color={C.kraft}>1962.</Em></Reveal>
        </T>
      </Piece>
      <Piece x={100} y={600} seed={21} boil={0.6}>
        <MapAU w={800} color={C.cream} />
      </Piece>
      <Piece x={ax - 35} y={ay - 98} seed={22} enter={{ kind: 'drop', at: 36, dur: 8 }} z={5} origin="50% 100%" boil={false}>
        <Pin w={70} color={C.wine} />
      </Piece>
      <Piece x={110} y={640} rot={-4} seed={23} enter={{ kind: 'pop', at: 70 }} z={4}>
        <Sign text="Burger King" sub="drive-in · desde 1962" w={430} h={170} color="kraft" />
      </Piece>
      <Piece x={470} y={610} rot={-12} seed={24} enter={{ kind: 'stamp', at: 104 }} z={6}>
        <Stamp text="R" round size={60} color={C.cream} />
      </Piece>
      <Arrow from={[330, 824]} to={[ax - 10, ay - 106]} bend={-0.24} at={84} color={C.kraft} seed={4} />
      <Source at={50} dark>Fonte: verbete Hungry Jack&apos;s (Wikipédia). Marcas citadas pertencem às suas titulares, sem vínculo com a Velmont.</Source>
      <Sfx name="place" at={44} vol={0.9} />
      <Sfx name="pop" at={70} vol={0.5} />
      <Sfx name="scribble" at={84} vol={0.4} />
      <Sfx name="stamp" at={104} vol={1} />
    </Scene>
  );
};

const Line: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: 'relative', height: 92, display: 'flex', alignItems: 'center', borderBottom: `2px solid ${C.apoio}`, fontFamily: SANS, fontWeight: 800, fontSize: 44, color: C.winedeep, letterSpacing: '0.01em' }}>{children}</div>
);

/* 4 · Virada: "A rede precisou escolher outro nome numa lista. Saiu Hungry Jack's... 1971." */
const S4: React.FC = () => (
  <Scene bg="cream" topo={1} seed={74} cam={[1.04, 1.0]} punch={[[196, 0.03]]}>
    <Piece x={64} y={376} seed={30} boil={0.4}>
      <T size={52} upper color={C.wine} w={900}>
        <Reveal at={0}>A rede precisou escolher</Reveal>
        <Reveal at={6}>outro nome numa <Hl>lista.</Hl></Reveal>
      </T>
    </Piece>
    <Piece x={70} y={570} rot={-2} seed={31} enter={{ kind: 'slide', at: 10, from: 'left', dist: 1100, dur: 8 }}>
      <Paper w={600} h={500} color="white" torn="t" seed={31} rough={5} style={{ padding: '40px 36px 0' }}>
        <div style={{ ...mono, color: C.wine, fontSize: 22 }}>Nomes possíveis</div>
        <Line>
          BURGER KING
          <div style={{ position: 'absolute', left: -8, top: 30 }}><Scribble kind="strike" w={330} h={34} at={40} dur={6} seed={5} stroke={7} /></div>
        </Line>
        <Line><div style={{ width: 300, height: 18, background: C.winedeep, opacity: 0.2 }} /></Line>
        <Line><div style={{ width: 360, height: 18, background: C.winedeep, opacity: 0.2 }} /></Line>
        <Line>
          HUNGRY JACK&apos;S
          <div style={{ position: 'absolute', left: -40, top: 2 }}><Scribble kind="circle" w={476} h={88} at={96} dur={8} seed={6} stroke={7} /></div>
        </Line>
      </Paper>
    </Piece>
    <Piece x={736} y={590} rot={6} seed={32} enter={{ kind: 'pop', at: 128 }} boil={1.3}>
      <Pancakes w={250} />
    </Piece>
    <Arrow from={[850, 790]} to={[512, 1004]} bend={-0.28} at={140} seed={7} />
    <Piece x={690} y={1000} rot={3} seed={33} enter={{ kind: 'pop', at: 150 }} z={4}>
      <Paper w={320} h={130} color="kraft" seed={33} style={{ padding: '18px 20px' }}>
        <T size={27} weight={700} color={C.winedeep} ls="0" lh={1.16}>nome de uma mistura pra panqueca</T>
      </Paper>
    </Piece>
    <Piece x={70} y={1140} rot={-2} seed={34} enter={{ kind: 'stamp', at: 196 }} z={5}>
      <Paper w={560} h={100} color="wine" torn="r" seed={34} style={{ display: 'flex', alignItems: 'center', paddingLeft: 28 }}>
        <T size={42} upper>primeira loja: 1971</T>
      </Paper>
    </Piece>
    <Sfx name="slide" at={10} vol={0.55} />
    <Sfx name="scribble" at={40} vol={0.5} />
    <Sfx name="scribble" at={96} vol={0.5} />
    <Sfx name="pop" at={128} vol={0.5} />
    <Sfx name="scribble" at={140} vol={0.4} />
    <Sfx name="stamp" at={196} vol={1} />
  </Scene>
);

const HJ: (keyof typeof AU_CITY)[] = ['perth', 'adelaide', 'sydney', 'brisbane'];
const BK: { c: keyof typeof AU_CITY; dx: number; dy: number }[] = [{ c: 'melbourne', dx: -60, dy: 0 }, { c: 'darwin', dx: 40, dy: 60 }, { c: 'sydney', dx: -170, dy: -150 }];

/* 5a · Desfecho: "a matriz tentou entrar com lojas próprias, perdeu uma briga na Justiça e foi embora." */
const S5a: React.FC = () => (
  <Scene bg="wine" topo={0} seed={75} cam={[1.0, 1.04]} punch={[[124, 0.03]]}>
    <Piece x={64} y={376} seed={40} boil={0.4}>
      <T size={48} upper color={C.cream} w={900}>
        <Reveal at={0}>Anos depois, a matriz tentou</Reveal>
        <Reveal at={6}>entrar com lojas próprias.</Reveal>
      </T>
    </Piece>
    <Piece x={130} y={590} seed={41} boil={0.6}>
      <MapAU w={760} color={C.kraft} />
    </Piece>
    {HJ.map((c, i) => {
      const [x, y] = city(c, 130, 590, 760);
      return (
        <Piece key={c} x={x - 105} y={y - 76} rot={(i % 2 ? 3 : -3)} seed={50 + i} z={3}>
          <Sign text="Hungry Jack's" w={210} h={70} size={22} color="cream" />
        </Piece>
      );
    })}
    {BK.map((b, i) => {
      const [x, y] = city(b.c, 130, 590, 760);
      return (
        <React.Fragment key={i}>
          <Piece x={x - 100 + b.dx} y={y - 76 + b.dy} rot={i % 2 ? -4 : 4} seed={60 + i} z={4} enter={{ kind: 'drop', at: 46 + i * 12, dur: 8 }} exit={{ kind: 'slide', at: 176 + i * 10, to: 'top', dist: 1500, dur: 8 }}>
            <Sign text="Burger King" w={200} h={70} size={22} color="wine" />
          </Piece>
          <Sfx name="place" at={54 + i * 12} vol={0.7} />
          <Sfx name="whoosh" at={176 + i * 10} vol={0.35} />
        </React.Fragment>
      );
    })}
    <Piece x={150} y={1150} rot={-3} seed={70} enter={{ kind: 'stamp', at: 124 }} z={6}>
      <Paper w={720} h={140} color="cream" torn="r" seed={70} style={{ padding: '18px 30px', color: C.wine }}>
        <div style={{ ...mono, fontSize: 20, opacity: 0.75 }}>2001</div>
        <T size={54} upper color={C.wine}>perdeu na Justiça.</T>
      </Paper>
    </Piece>
    <Sfx name="stamp" at={124} vol={1} />
  </Scene>
);

/* 5b · "Hoje são mais de quatrocentas lojas. Nenhuma se chama Burger King." */
const S5b: React.FC = () => (
  <Scene bg="kraft" topo={1} seed={76} cam={[1.04, 1.0]} punch={[[52, 0.03]]}>
    <Piece x={64} y={392} seed={80} boil={false}>
      <Ransom lines={['+400']} size={190} at={0} seed={76} palette={['cream', 'wine', 'white', 'winedeep']} />
    </Piece>
    <Piece x={64} y={626} seed={81} boil={0.4}>
      <T size={60} upper color={C.wine}><Reveal at={14}>lojas no país.</Reveal></T>
    </Piece>
    <Piece x={58} y={730} rot={-2} seed={82} enter={{ kind: 'stamp', at: 52 }} z={5}>
      <Paper w={920} h={110} color="wine" torn="r" seed={82} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <T size={44} upper>Nenhuma se chama Burger King.</T>
      </Paper>
    </Piece>
    {Array.from({ length: 9 }, (_, i) => (
      <React.Fragment key={i}>
        <Piece x={70 + (i % 3) * 318} y={920 + Math.floor(i / 3) * 124} rot={(i % 4) - 1.5} seed={90 + i} enter={{ kind: 'pop', at: 20 + i * 4, dur: 6 }}>
          <Sign text="Hungry Jack's" w={290} h={96} size={30} color={i % 2 ? 'white' : 'cream'} />
        </Piece>
        <Sfx name="tack" at={20 + i * 4} vol={0.5} />
      </React.Fragment>
    ))}
    <Sfx name="stamp" at={52} vol={1} />
  </Scene>
);

const STEPS = ['Segunda unidade', 'Marketplace', 'Outro estado'];

/* 6 · Lição: "Agora traz pra sua escala... O nome que funciona na sua rua está livre lá?" */
const S6: React.FC = () => (
  <Scene bg="cream" topo={0} seed={77} cam={[1.0, 1.04]} punch={[[214, 0.03]]}>
    <Piece x={64} y={376} seed={100} boil={0.4}>
      <T size={56} upper color={C.wine} w={900}>
        <Reveal at={0}>Agora traz pra</Reveal>
        <Reveal at={6}><Hl>sua escala.</Hl></Reveal>
      </T>
    </Piece>
    {STEPS.map((s, i) => (
      <React.Fragment key={s}>
        <Piece x={64 + i * 150} y={580 + i * 160} rot={i === 1 ? 2 : -2} seed={110 + i} enter={{ kind: 'slide', at: 50 + i * 50, from: i % 2 ? 'right' : 'left', dist: 1100, dur: 8 }} z={2 + i}>
          <Ficha w={560} h={116} tab={`${i + 1}`} seed={110 + i} color={i === 1 ? 'white' : 'kraft'}>
            <T size={44} upper color={C.wine}>{s}</T>
          </Ficha>
        </Piece>
        <Sfx name="slide" at={50 + i * 50} vol={0.55} />
      </React.Fragment>
    ))}
    <Piece x={58} y={1110} rot={-2} seed={120} enter={{ kind: 'stamp', at: 214 }} z={6}>
      <Paper w={920} h={210} color="wine" torn="r" seed={120} style={{ padding: '26px 30px' }}>
        <T size={40} upper lh={1.1}>O nome que funciona na sua rua</T>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 92, lineHeight: 1.05, color: C.kraft }}>está livre lá?</div>
      </Paper>
    </Piece>
    <Sfx name="stamp" at={214} vol={1} />
  </Scene>
);

/* 7 · Fecho e CTA: "O registro no INPI vale no país inteiro. E quanto maior o negócio, mais caro trocar a placa." */
const S7: React.FC = () => (
  <Scene bg="winedeep" topo={1} seed={78} cam={[1.04, 1.0]}>
    <Piece x={64} y={376} seed={130} boil={0.4}>
      <T size={54} upper color={C.cream} w={900}>
        <Reveal at={0}>O registro no INPI vale</Reveal>
        <Reveal at={6}><Hl bg={C.kraft} color={C.winedeep}>no país inteiro.</Hl></Reveal>
      </T>
    </Piece>
    <Piece x={64} y={584} seed={131} boil={0.4}>
      <T size={42} upper color={C.cream} w={900} lh={1.1}>
        <Reveal at={84}>Quanto maior o negócio,</Reveal>
        <Reveal at={90}>mais caro <Em color={C.kraft}>trocar a placa.</Em></Reveal>
      </T>
    </Piece>
    <Piece x={690} y={760} rot={4} seed={132} enter={{ kind: 'slide', at: 20, from: 'bottom', dist: 900, dur: 8 }}>
      <Ladder w={140} />
    </Piece>
    <Piece x={150} y={790} rot={-9} seed={133} enter={{ kind: 'drop', at: 30 }} z={4} origin="100% 0%" move={(f) => ({ rot: Math.sin(Math.floor(f / 2) / 3) * 3 })}>
      <Sign text="seu nome" sub="desde sempre" w={520} h={190} color="cream" />
    </Piece>
    <Piece x={64} y={1160} rot={-2} seed={134} enter={{ kind: 'slide', at: 132, from: 'left', dist: 1200, dur: 8 }} z={6}>
      <Paper w={880} h={118} color="kraft" torn="r" seed={134} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <T size={39} upper color={C.winedeep}>Chama a Velmont antes de crescer.</T>
      </Paper>
    </Piece>
    <Source at={20} dark>Lei 9.279/96, art. 129.</Source>
    <Sfx name="slide" at={20} vol={0.5} />
    <Sfx name="place" at={38} vol={0.8} />
    <Sfx name="slide" at={132} vol={0.55} />
  </Scene>
);

export const EP07: SceneDef[] = [
  { id: 'gancho', dur: 120, el: <S1 /> },
  { id: 'contexto', dur: 260, el: <S2 /> },
  { id: 'conflito', dur: 154, el: <S3 /> },
  { id: 'virada', dur: 250, el: <S4 /> },
  { id: 'desfecho', dur: 240, el: <S5a /> },
  { id: 'hoje', dur: 138, el: <S5b /> },
  { id: 'licao', dur: 310, el: <S6 /> },
  { id: 'fecho', dur: 205, el: <S7 /> },
  { id: 'assinatura', dur: 66, el: <EndCard /> },
];
