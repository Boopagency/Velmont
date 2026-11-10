import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Arrow, Cap, Clip, Cutout, Doc, Em, EndCard, Ficha, Hl, Key, mono, Notebooks, Paper, Piece, Ransom, Reveal, Row, Scene, Scribble, SeriesTag, Sfx, Sneaker, Source, Stamp, T, Tape, Tee, Watch, type SceneDef } from '../kit';
import { C, SERIF } from '../theme';

/**
 * PAPEL PASSADO · Nº 08 · A marca que não parou
 * História real: o licenciamento da marca Senna.
 * Sem imagem do piloto, sem capacete e sem o logo: só texto e objetos genéricos.
 */

const CHECKER: React.CSSProperties = { backgroundImage: `repeating-conic-gradient(${C.winedeep} 0% 25%, ${C.cream} 0% 50%)`, backgroundSize: '112px 112px', backgroundPosition: '0 0' };

/* 1 · Gancho: "Ayrton Senna deixou as pistas em 1994. A marca dele nunca parou de correr." */
const S1: React.FC = () => (
  <Scene bg="winedeep" topo={0} seed={81} cam={[1.0, 1.05]} punch={[[96, 0.03]]}>
    <SeriesTag n="08" dark />
    <Piece x={64} y={456} seed={1} boil={0.4}>
      <T size={44} upper color={C.cream} w={900} lh={1.1}>Ayrton Senna deixou<br />as pistas em 1994.</T>
    </Piece>
    <Piece x={64} y={576} seed={2} boil={false}>
      <Ransom lines={['A MARCA', 'NUNCA']} size={132} at={10} seed={81} palette={['cream', 'kraft', 'white', 'kraftdeep', 'apoio']} />
    </Piece>
    <Piece x={58} y={884} rot={-2} seed={3} enter={{ kind: 'stamp', at: 96 }} z={5}>
      <Paper w={780} h={110} color="kraft" torn="r" seed={3} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <T size={56} upper color={C.winedeep}>parou de correr.</T>
      </Paper>
    </Piece>
    <Piece x={36} y={1050} rot={-4} seed={4} enter={{ kind: 'slide', at: 6, from: 'left', dist: 1100, dur: 10 }}>
      <Paper w={560} h={290} color="cream" torn="all" seed={4} style={CHECKER} />
    </Piece>
    <Piece x={620} y={970} rot={8} seed={5} enter={{ kind: 'drop', at: 22 }} z={4} boil={1.4}>
      <Cutout name="stopwatch" w={340} srcW={740} />
    </Piece>
    {[10, 12, 14, 16, 18, 20, 22].map((f) => <Sfx key={f} name="tack" at={f} vol={0.5} />)}
    <Sfx name="slide" at={6} vol={0.55} />
    <Sfx name="place" at={30} vol={0.8} />
    {[40, 55, 70, 85].map((f) => <Sfx key={`t${f}`} name="tick" at={f} vol={0.5} />)}
    <Sfx name="stamp" at={96} vol={1} />
  </Scene>
);

const ITEMS: { label: string; el: React.ReactNode; at: number }[] = [
  { label: 'boné', el: <Cap w={250} />, at: 124 },
  { label: 'camiseta', el: <Tee w={210} />, at: 146 },
  { label: 'tênis', el: <Sneaker w={290} />, at: 168 },
  { label: 'relógio', el: <Watch w={104} />, at: 190 },
];

/* 2 · Contexto: "Todo novembro... o nome volta pras arquibancadas: em boné, em camiseta, em tênis, em relógio." */
const S2: React.FC = () => (
  <Scene bg="cream" topo={1} seed={82} cam={[1.04, 1.0]}>
    <Piece x={64} y={376} seed={10} boil={0.4}>
      <T size={50} upper color={C.wine} w={900}>
        <Reveal at={0}>Todo novembro, em Interlagos,</Reveal>
        <Reveal at={62}>o nome volta pras</Reveal>
        <Reveal at={68}><Hl>arquibancadas.</Hl></Reveal>
      </T>
    </Piece>
    {ITEMS.map((it, i) => (
      <React.Fragment key={it.label}>
        <Piece x={70 + (i % 2) * 480} y={i < 2 ? 660 : 990} rot={i % 2 ? 2.5 : -2.5} seed={20 + i} enter={{ kind: 'pop', at: it.at, dur: 6 }}>
          <Paper w={440} h={300} color={i % 3 === 0 ? 'kraft' : 'white'} torn={i % 2 ? 'tb' : 'lr'} seed={20 + i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: C.wine }}>
            {it.el}
            <span style={mono}>{it.label}</span>
          </Paper>
        </Piece>
        <Piece x={220 + (i % 2) * 480} y={(i < 2 ? 660 : 990) - 20} rot={i % 2 ? -6 : 5} seed={30 + i} enter={{ kind: 'cut', at: it.at + 4 }} z={4}>
          <Tape w={140} h={40} color="cream" seed={30 + i} />
        </Piece>
        <Sfx name="place" at={it.at} vol={0.7} />
      </React.Fragment>
    ))}
  </Scene>
);

/* 3 · Antes: "Nada disso é improviso. O nome e os símbolos são marcas registradas... licencia o uso." */
const S3: React.FC = () => (
  <Scene bg="kraft" topo={0} seed={83} cam={[1.0, 1.04]} punch={[[72, 0.03]]}>
    <Piece x={64} y={376} seed={40} boil={0.4}>
      <T size={56} upper color={C.wine} w={900}>
        <Reveal at={0}>Nada disso é</Reveal>
        <Reveal at={6}><Hl>improviso.</Hl></Reveal>
      </T>
    </Piece>
    <Piece x={70} y={610} rot={-3} seed={41} enter={{ kind: 'drop', at: 40 }}>
      <Doc w={540} h={330} title="Marcas registradas" seed={41}>
        <Row k="Nome" v="registrado" kw={130} />
        <Row k="Símbolos" v="registrados" kw={130} />
        <div style={{ marginTop: 8 }}><Scribble kind="loop" w={200} h={46} at={56} dur={8} seed={3} stroke={5} /></div>
      </Doc>
    </Piece>
    <Piece x={500} y={590} rot={-12} seed={42} enter={{ kind: 'stamp', at: 72 }} z={5}>
      <Stamp text="R" round size={64} color={C.wine} />
    </Piece>
    <Piece x={470} y={900} rot={4} seed={43} enter={{ kind: 'slide', at: 132, from: 'right', dist: 1100, dur: 8 }} z={3}>
      <Doc w={530} h={310} title="Licença de uso" seed={43} color="white">
        <Row k="Quem" v="empresa da família" kw={90} />
        <Row k="Para" v="outras marcas" kw={90} />
      </Doc>
    </Piece>
    <Arrow from={[300, 950]} to={[466, 1050]} bend={0.3} at={150} seed={5} />
    <Piece x={100} y={1130} rot={-14} seed={44} enter={{ kind: 'pop', at: 176 }} z={5} boil={1.3}>
      <Key w={300} />
    </Piece>
    <Sfx name="place" at={48} vol={0.8} />
    <Sfx name="stamp" at={72} vol={1} />
    <Sfx name="slide" at={132} vol={0.55} />
    <Sfx name="scribble" at={150} vol={0.4} />
    <Sfx name="pop" at={176} vol={0.5} />
  </Scene>
);

const Stack: React.FC<{ from: number }> = ({ from }) => {
  const frame = useCurrentFrame();
  return <Notebooks w={280} n={Math.max(0, Math.min(6, Math.floor((frame - from) / 10)))} />;
};

/* 4 · Depois: os números, sempre atribuídos a quem os informou. */
const S4: React.FC = () => (
  <Scene bg="winedeep" topo={1} seed={84} cam={[1.04, 1.0]}>
    <Piece x={64} y={376} rot={-1.5} seed={50} enter={{ kind: 'pop', at: 0 }}>
      <Paper w={470} h={54} color="kraft" seed={50} shadow="soft" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.winedeep }}>
        <span style={{ ...mono, fontSize: 19 }}>segundo a empresa, em 2024</span>
      </Paper>
    </Piece>
    <Piece x={64} y={452} seed={51} boil={false}>
      <Ransom lines={['+US$ 2', 'BILHÕES']} size={116} at={8} seed={84} palette={['cream', 'kraft', 'white', 'kraftdeep']} />
    </Piece>
    <Piece x={64} y={736} seed={52} boil={0.4}>
      <T size={38} upper color={C.cream} w={860} lh={1.12}>
        <Reveal at={40}>em contratos de licenciamento,</Reveal>
        <Reveal at={46}>em 30 anos.</Reveal>
      </T>
    </Piece>
    <Piece x={64} y={884} rot={1.5} seed={53} enter={{ kind: 'pop', at: 168 }}>
      <Paper w={330} h={54} color="cream" seed={53} shadow="soft" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.wine }}>
        <span style={{ ...mono, fontSize: 19 }}>segundo a família</span>
      </Paper>
    </Piece>
    <Piece x={64} y={958} seed={54} boil={false}>
      <Ransom lines={['+US$ 500', 'MILHÕES']} size={80} at={176} seed={85} palette={['kraft', 'cream', 'kraftdeep', 'white']} />
    </Piece>
    <Piece x={64} y={1158} seed={55} boil={0.4}>
      <T size={36} upper color={C.cream} w={600} lh={1.12}>
        <Reveal at={204}>para o instituto de</Reveal>
        <Reveal at={210}><Em color={C.kraft}>educação</Em> que leva o nome.</Reveal>
      </T>
    </Piece>
    <Piece x={700} y={900} seed={56} boil={0.6}>
      <Stack from={196} />
    </Piece>
    {[196, 206, 216, 226, 236, 246].map((f) => <Sfx key={f} name="place" at={f} vol={0.5} />)}
    {[8, 10, 12, 14, 16, 18].map((f) => <Sfx key={`a${f}`} name="tack" at={f} vol={0.5} />)}
    {[176, 178, 180, 182, 184].map((f) => <Sfx key={`b${f}`} name="tack" at={f} vol={0.5} />)}
    <Source at={40} dark>Fonte: Máquina do Esporte, 30/4/2024. Marcas citadas pertencem às suas titulares, sem vínculo com a Velmont.</Source>
  </Scene>
);

const CAN = ['Pode ser licenciada.', 'Pode render.', 'Pode continuar depois do fundador.'];

/* 5 · Ponte: "É isso que quer dizer marca é patrimônio..." */
const S5: React.FC = () => (
  <Scene bg="cream" topo={0} seed={85} cam={[1.0, 1.04]} punch={[[8, 0.03]]}>
    <Piece x={58} y={380} rot={-2} seed={60} enter={{ kind: 'stamp', at: 8 }} z={5}>
      <Paper w={760} h={126} color="wine" torn="r" seed={60} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <T size={62} upper>Marca é <Em color={C.kraft}>patrimônio.</Em></T>
      </Paper>
    </Piece>
    {CAN.map((text, i) => (
      <React.Fragment key={text}>
        <Piece x={64 + i * 60} y={590 + i * 196} rot={i === 1 ? 1.5 : -1.5} seed={70 + i} enter={{ kind: 'slide', at: 96 + i * 50, from: i % 2 ? 'right' : 'left', dist: 1100, dur: 8 }} z={2 + i}>
          <Ficha w={800} h={120} tab={`${i + 1}`} seed={70 + i} color={i === 1 ? 'white' : 'kraft'}>
            <T size={i === 2 ? 36 : 48} upper color={C.wine} style={{ whiteSpace: 'nowrap' }}>{text}</T>
          </Ficha>
        </Piece>
        <Sfx name="slide" at={96 + i * 50} vol={0.55} />
      </React.Fragment>
    ))}
    <Piece x={770} y={596} rot={8} seed={80} enter={{ kind: 'cut', at: 108 }} z={6}>
      <Clip w={40} />
    </Piece>
    <Source at={100}>Lei 9.279/96, arts. 130 e 139.</Source>
    <Sfx name="stamp" at={8} vol={1} />
  </Scene>
);

/* 6 · Lição: "Sem registro, você tem um nome conhecido. Com registro, você tem um bem." */
const S6: React.FC = () => (
  <Scene bg="wine" topo={1} seed={86} cam={[1.04, 1.0]} punch={[[176, 0.03]]}>
    <Piece x={64} y={376} seed={90} boil={0.4}>
      <T size={48} upper color={C.cream} w={900}>
        <Reveal at={0}>A sua marca ainda é pequena.</Reveal>
        <Reveal at={46}>O mecanismo é <Em color={C.kraft}>o mesmo.</Em></Reveal>
      </T>
    </Piece>
    <Piece x={56} y={610} rot={-3} seed={91} enter={{ kind: 'slide', at: 104, from: 'left', dist: 1100, dur: 8 }}>
      <Paper w={450} h={440} color="cream" torn="all" seed={91} style={{ padding: '46px 34px', color: C.wine }}>
        <div style={{ ...mono, fontSize: 21 }}>Sem registro</div>
        <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 80, lineHeight: 1, marginTop: 26 }}>um nome conhecido</div>
        <div style={{ marginTop: 26 }}><Scribble kind="zig" w={300} h={34} at={116} dur={8} seed={7} stroke={5} /></div>
      </Paper>
    </Piece>
    <Piece x={550} y={720} rot={3} seed={92} enter={{ kind: 'stamp', at: 176 }} z={4}>
      <Paper w={460} h={440} color="kraft" seed={92} style={{ padding: 20, color: C.winedeep }}>
        <div style={{ border: `3px double ${C.wine}`, height: '100%', boxSizing: 'border-box', padding: '24px 26px' }}>
          <div style={{ ...mono, fontSize: 21 }}>Com registro</div>
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 132, lineHeight: 1, marginTop: 30, color: C.wine }}>um bem</div>
        </div>
      </Paper>
    </Piece>
    <Piece x={850} y={1010} rot={-12} seed={93} enter={{ kind: 'stamp', at: 192 }} z={6}>
      <Stamp text="R" round size={64} color={C.wine} />
    </Piece>
    <Arrow from={[290, 1070]} to={[548, 1118]} bend={0.34} at={196} color={C.kraft} seed={8} />
    <Sfx name="slide" at={104} vol={0.55} />
    <Sfx name="scribble" at={116} vol={0.4} />
    <Sfx name="stamp" at={176} vol={1} />
    <Sfx name="stamp" at={192} vol={0.8} />
    <Sfx name="scribble" at={196} vol={0.4} />
  </Scene>
);

/* 7 · Fecho: "Criar gera valor. Proteger garante que esse valor continue sendo seu." */
const S7: React.FC = () => (
  <Scene bg="winedeep" topo={0} seed={87} cam={[1.0, 1.04]}>
    <Piece x={60} y={430} seed={100} boil={0.5}>
      <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 122, lineHeight: 1, color: C.cream, letterSpacing: '-0.02em' }}>
        <Reveal at={0}>Criar gera valor.</Reveal>
      </div>
    </Piece>
    <Piece x={60} y={600} seed={101} boil={0.5}>
      <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 78, lineHeight: 1.06, color: C.kraft, width: 920 }}>
        <Reveal at={42}>Proteger garante que esse</Reveal>
        <Reveal at={48}>valor continue sendo seu.</Reveal>
      </div>
    </Piece>
    <Piece x={64} y={900} rot={-2} seed={102} enter={{ kind: 'slide', at: 72, from: 'left', dist: 1200, dur: 8 }} z={5}>
      <Paper w={640} h={200} color="cream" torn="r" seed={102} style={{ padding: '28px 30px' }}>
        <T size={36} upper color={C.wine} lh={1.12}>Salva pra lembrar quando o registro parecer só mais um gasto.</T>
      </Paper>
    </Piece>
    <Piece x={740} y={960} rot={8} seed={103} enter={{ kind: 'pop', at: 80 }} boil={1.4}>
      <Cutout name="stopwatch" w={230} srcW={740} />
    </Piece>
    <Sfx name="thud" at={42} vol={0.5} />
    <Sfx name="slide" at={72} vol={0.55} />
    <Sfx name="tick" at={90} vol={0.5} />
    <Sfx name="tick" at={105} vol={0.5} />
  </Scene>
);

export const EP08: SceneDef[] = [
  { id: 'gancho', dur: 158, el: <S1 /> },
  { id: 'contexto', dur: 240, el: <S2 /> },
  { id: 'antes', dur: 270, el: <S3 /> },
  { id: 'depois', dur: 330, el: <S4 /> },
  { id: 'ponte', dur: 270, el: <S5 /> },
  { id: 'licao', dur: 270, el: <S6 /> },
  { id: 'fecho', dur: 130, el: <S7 /> },
  { id: 'assinatura', dur: 66, el: <EndCard /> },
];
