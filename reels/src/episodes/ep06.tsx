import React from 'react';
import { useCurrentFrame } from 'remotion';
import { Arrow, Cup, Doc, Em, EndCard, Ficha, Flower4, Hl, Loupe, Mark, mono, Paper, Piece, Ransom, Reveal, Scene, SeriesTag, Sfx, Sign, Source, Stamp, T, type SceneDef } from '../kit';
import { C, SERIF } from '../theme';

/**
 * PAPEL PASSADO · Nº 06 · Uma flor de 1,3 milhão
 * História real: Louis Vuitton x Molly Tea (China, julho de 2026).
 * Nenhum logo ou monograma aparece: a flor é uma forma genérica.
 */

/* 1 · Gancho: "Uma rede de chá foi condenada a pagar 1,3 milhão de euros por causa de uma flor." */
const S1: React.FC = () => (
  <Scene bg="winedeep" topo={1} seed={61} cam={[1.0, 1.05]} punch={[[130, 0.03]]}>
    <SeriesTag n="06" dark />
    <Piece x={64} y={456} seed={1} boil={0.4}>
      <T size={44} upper color={C.cream} w={900} lh={1.1}>Uma rede de chá foi<br />condenada a pagar</T>
    </Piece>
    <Piece x={64} y={580} seed={2} boil={false}>
      <Ransom lines={['1,3', 'MILHÃO']} size={138} at={6} seed={61} palette={['cream', 'kraft', 'white', 'kraftdeep']} />
    </Piece>
    <Piece x={420} y={606} rot={3} seed={3} enter={{ kind: 'stamp', at: 30 }} z={4}>
      <Paper w={330} h={96} color="kraft" torn="l" seed={3} style={{ display: 'flex', alignItems: 'center', paddingLeft: 36 }}>
        <T size={50} upper color={C.winedeep}>de euros</T>
      </Paper>
    </Piece>
    <Piece x={58} y={916} rot={-2} seed={4} enter={{ kind: 'stamp', at: 130 }} z={5}>
      <Paper w={520} h={190} color="cream" torn="r" seed={4} style={{ padding: '22px 28px' }}>
        <T size={46} upper color={C.wine} lh={1.02}>por causa de<br /><Em scale={1.7}>uma flor.</Em></T>
      </Paper>
    </Piece>
    <Piece x={680} y={980} rot={6} seed={5} enter={{ kind: 'drop', at: 12 }} boil={1.3}>
      <Cup w={260} />
    </Piece>
    <Piece x={764} y={1130} rot={6} seed={6} enter={{ kind: 'stamp', at: 150 }} z={6}>
      <Flower4 w={92} />
    </Piece>
    {[6, 8, 10, 12, 14, 16, 18, 20].map((f) => <Sfx key={f} name="tack" at={f} vol={0.5} />)}
    <Sfx name="place" at={20} vol={0.8} />
    <Sfx name="stamp" at={30} vol={0.7} />
    <Sfx name="stamp" at={130} vol={0.9} />
    <Sfx name="stamp" at={150} vol={1} />
  </Scene>
);

/* 2a · Contexto: "Julho de 2026, China. Mais de duas mil lojas e uma flor de quatro pétalas nos copos." */
const S2a: React.FC = () => (
  <Scene bg="kraft" topo={0} seed={62} cam={[1.04, 1.0]}>
    <Piece x={64} y={376} rot={-1.5} seed={10} enter={{ kind: 'pop', at: 0 }}>
      <Paper w={430} h={56} color="white" seed={10} shadow="soft" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.wine }}>
        <span style={mono}>Julho de 2026 · China</span>
      </Paper>
    </Piece>
    <Piece x={64} y={456} seed={11} boil={0.4}>
      <T size={56} upper color={C.wine} w={900}>
        <Reveal at={10}>Mais de 2 mil lojas.</Reveal>
        <Reveal at={76}>Uma flor de quatro</Reveal>
        <Reveal at={82}><Hl>pétalas nos copos.</Hl></Reveal>
      </T>
    </Piece>
    {Array.from({ length: 8 }, (_, i) => (
      <React.Fragment key={i}>
        <Piece x={70 + (i % 4) * 235} y={i < 4 ? 770 : 1040} rot={(i % 3) * 2 - 2} seed={20 + i} enter={{ kind: 'pop', at: 20 + i * 5, dur: 6 }}>
          <Cup w={180} mark={<Flower4 w={62} />} />
        </Piece>
        <Sfx name="place" at={20 + i * 5} vol={0.45} />
      </React.Fragment>
    ))}
    <Source at={90}>Fonte: Lusa, via ECO, 3/7/2026.</Source>
  </Scene>
);

/* 2b · Conflito: "A Louis Vuitton olhou pra essa flor e enxergou o próprio monograma." */
const S2b: React.FC = () => (
  <Scene bg="cream" topo={1} seed={63} cam={[1.0, 1.05]} punch={[[60, 0.03]]}>
    <Piece x={64} y={376} seed={30} boil={0.4}>
      <T size={56} upper color={C.wine} w={900}>
        <Reveal at={0}>A Louis Vuitton olhou</Reveal>
        <Reveal at={6}>pra essa flor</Reveal>
      </T>
    </Piece>
    <Piece x={58} y={540} rot={-2} seed={31} enter={{ kind: 'stamp', at: 60 }} z={5}>
      <Paper w={900} h={112} color="wine" torn="r" seed={31} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <T size={44} upper>e enxergou o próprio <Em color={C.kraft}>monograma.</Em></T>
      </Paper>
    </Piece>
    <Piece x={300} y={760} rot={-3} seed={32}>
      <Paper w={440} h={440} color="kraft" torn="all" seed={32} />
    </Piece>
    <Piece x={370} y={830} rot={-3} seed={33} boil={1.3}>
      <Flower4 w={300} />
    </Piece>
    <Piece x={520} y={880} rot={-8} seed={34} enter={{ kind: 'slide', at: 20, from: 'right', dist: 900, dur: 8 }} z={4} boil={1.6}>
      <Loupe w={360} />
    </Piece>
    <Sfx name="whoosh" at={20} vol={0.45} />
    <Sfx name="stamp" at={60} vol={1} />
  </Scene>
);

const Shape: React.FC<{ k: number; size?: number; color?: string }> = ({ k, size = 110, color = C.wine }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
    {k === 0 && <><circle cx="50" cy="50" r="38" fill="none" stroke={color} strokeWidth="9" /><circle cx="50" cy="50" r="12" fill={color} /></>}
    {k === 1 && <path d="M50 10 L90 50 L50 90 L10 50 Z" fill="none" stroke={color} strokeWidth="9" strokeLinejoin="round" />}
    {k === 2 && <><path d="M10 84 L42 30 L60 60 L72 44 L92 84 Z" fill={color} /><circle cx="74" cy="22" r="10" fill={color} /></>}
  </svg>
);

const AppIcon: React.FC<{ swap: number }> = ({ swap }) => {
  const frame = useCurrentFrame();
  const after = frame >= swap;
  const k = after ? (frame - swap < 2 ? 1.25 : frame - swap < 4 ? 0.94 : 1) : 1;
  return (
    <div style={{ width: 240, height: 240, borderRadius: 54, background: C.cream, boxShadow: '0 8px 9px rgba(10,2,6,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ transform: `scale(${k})` }}>{after ? <Shape k={0} size={150} color={C.kraftdeep} /> : <Flower4 w={160} />}</div>
    </div>
  );
};

/* 3 · A Justiça: "A grife tinha os desenhos registrados... ganhou... a rede vai recorrer e já mudou o logo." */
const S3: React.FC = () => (
  <Scene bg="wine" topo={0} seed={64} cam={[1.0, 1.04]} punch={[[110, 0.03]]}>
    <Piece x={64} y={376} seed={40} boil={0.4}>
      <T size={54} upper color={C.cream} w={900}>
        <Reveal at={0}>A grife tinha os</Reveal>
        <Reveal at={6}>desenhos <Mark at={16} color={C.kraft} seed={3}>registrados.</Mark></Reveal>
      </T>
    </Piece>
    <Piece x={70} y={560} rot={-2} seed={41} enter={{ kind: 'drop', at: 16 }}>
      <Doc w={520} h={300} title="Desenhos registrados" seed={41}>
        <div style={{ display: 'flex', gap: 22, marginTop: 20 }}>
          {[0, 1, 2].map((k) => <div key={k} style={{ border: `3px solid ${C.apoio}`, padding: 12 }}><Shape k={k} /></div>)}
        </div>
      </Doc>
    </Piece>
    <Piece x={490} y={540} rot={-12} seed={42} enter={{ kind: 'stamp', at: 44 }} z={5}>
      <Stamp text="R" round size={62} color={C.wine} />
    </Piece>
    <Piece x={560} y={720} rot={4} seed={43} enter={{ kind: 'stamp', at: 110 }} z={5}>
      <Paper w={440} h={170} color="kraft" torn="l" seed={43} style={{ padding: '22px 30px', color: C.winedeep }}>
        <div style={{ ...mono, fontSize: 20, opacity: 0.75 }}>Primeira instância</div>
        <T size={66} upper color={C.winedeep}>ganhou.</T>
      </Paper>
    </Piece>
    <Piece x={64} y={960} seed={44} boil={0.4}>
      <T size={42} upper color={C.cream} w={600} lh={1.12}>
        <Reveal at={170}>A rede vai recorrer</Reveal>
        <Reveal at={176}>e já mudou o logo</Reveal>
        <Reveal at={182}>do aplicativo.</Reveal>
      </T>
    </Piece>
    <Piece x={720} y={940} rot={5} seed={45} enter={{ kind: 'pop', at: 176 }} z={4}>
      <AppIcon swap={222} />
    </Piece>
    <Arrow from={[420, 1150]} to={[716, 1108]} bend={0.3} at={196} color={C.kraft} seed={2} />
    <Source at={60} dark>Fonte: Lusa, via ECO, 3/7/2026. Decisão de primeira instância, com recurso anunciado. Marcas citadas pertencem às suas titulares, sem vínculo com a Velmont.</Source>
    <Sfx name="place" at={24} vol={0.8} />
    <Sfx name="stamp" at={44} vol={0.9} />
    <Sfx name="stamp" at={110} vol={1} />
    <Sfx name="pop" at={176} vol={0.5} />
    <Sfx name="scribble" at={196} vol={0.4} />
    <Sfx name="tape" at={220} vol={0.6} />
  </Scene>
);

/* 4a · Ponte: "O que isso tem a ver com a sua loja, a sua clínica, a sua confeitaria?" */
const S4a: React.FC = () => (
  <Scene bg="cream" topo={0} seed={65} cam={[1.04, 1.0]}>
    <Piece x={64} y={376} seed={50} boil={0.4}>
      <T size={58} upper color={C.wine} w={900}>
        <Reveal at={0}>O que isso tem</Reveal>
        <Reveal at={6}>a ver com...</Reveal>
      </T>
    </Piece>
    <Piece x={70} y={640} rot={-3} seed={51} enter={{ kind: 'drop', at: 44, dur: 8 }}>
      <Sign text="a sua loja?" w={500} color="kraft" pole={90} />
    </Piece>
    <Piece x={400} y={850} rot={2.5} seed={52} enter={{ kind: 'drop', at: 78, dur: 8 }}>
      <Sign text="a sua clínica?" w={560} color="white" pole={90} />
    </Piece>
    <Piece x={110} y={1060} rot={-2} seed={53} enter={{ kind: 'drop', at: 112, dur: 8 }}>
      <Sign text="a sua confeitaria?" w={680} color="wine" pole={70} />
    </Piece>
    <Sfx name="place" at={52} vol={0.8} />
    <Sfx name="place" at={86} vol={0.8} />
    <Sfx name="place" at={120} vol={0.8} />
  </Scene>
);

/* 4b · Regra: "Marca vai além do nome. O desenho também se registra..." */
const S4b: React.FC = () => (
  <Scene bg="winedeep" topo={1} seed={66} cam={[1.0, 1.04]} punch={[[50, 0.03]]}>
    <Piece x={64} y={376} seed={60} boil={0.4}>
      <T size={56} upper color={C.cream} w={900}><Reveal at={0}>Marca vai além do nome.</Reveal></T>
    </Piece>
    <Piece x={58} y={470} rot={-1.5} seed={61} enter={{ kind: 'stamp', at: 50 }} z={5}>
      <Paper w={900} h={108} color="kraft" torn="r" seed={61} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <T size={47} upper color={C.winedeep}>O desenho também se <Em>registra.</Em></T>
      </Paper>
    </Piece>
    {[
      { tab: 'Nome', sub: 'nominativa', el: <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 130, lineHeight: 1, color: C.wine }}>Aa</span> },
      { tab: 'Símbolo', sub: 'figurativa', el: <Shape k={2} size={130} /> },
      { tab: 'Os dois', sub: 'mista', el: <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Shape k={2} size={84} /><span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 84, lineHeight: 1, color: C.wine }}>Aa</span></div> },
    ].map((c, i) => (
      <React.Fragment key={i}>
        <Piece x={64 + i * 322} y={690 + (i % 2) * 40} rot={i === 1 ? 2 : -2} seed={70 + i} enter={{ kind: 'drop', at: 84 + i * 30, dur: 8 }}>
          <Ficha w={296} h={330} tab={c.tab} seed={70 + i} color={i === 1 ? 'white' : 'cream'}>
            <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.el}</div>
            <div style={{ ...mono, fontSize: 19, color: C.wine, textAlign: 'center', borderTop: `2px solid ${C.apoio}`, paddingTop: 12 }}>{c.sub}</div>
          </Ficha>
        </Piece>
        <Sfx name="place" at={92 + i * 30} vol={0.8} />
      </React.Fragment>
    ))}
    <Piece x={64} y={1150} seed={80} boil={0.4}>
      <T size={34} weight={700} color={C.cream} w={900} ls="-0.01em" lh={1.2}><Reveal at={170}>O símbolo sozinho, ou o conjunto de letra e imagem.</Reveal></T>
    </Piece>
    <Sfx name="stamp" at={50} vol={1} />
  </Scene>
);

const Mark2: React.FC<{ rot?: number }> = ({ rot = 0 }) => (
  <svg width={210} height={210} viewBox="0 0 100 100" style={{ display: 'block', transform: `rotate(${rot}deg)` }}>
    <circle cx="50" cy="50" r="42" fill="none" stroke={C.wine} strokeWidth="7" />
    <path d="M50 16 L62 50 L50 84 L38 50 Z" fill={C.wine} />
    <path d="M16 50 L50 40 L84 50 L50 60 Z" fill={C.wine} />
  </svg>
);

/* 5 · Lição: "E desenho que lembra o de uma marca famosa é risco até em outro ramo." */
const S5: React.FC = () => (
  <Scene bg="kraft" topo={0} seed={67} cam={[1.04, 1.0]} punch={[[56, 0.03]]}>
    <Piece x={64} y={376} seed={90} boil={0.4}>
      <T size={52} upper color={C.wine} w={900}>
        <Reveal at={0}>Desenho que lembra o de</Reveal>
        <Reveal at={6}>uma marca famosa</Reveal>
      </T>
    </Piece>
    <Piece x={58} y={520} rot={-2} seed={91} enter={{ kind: 'stamp', at: 56 }} z={5}>
      <Paper w={880} h={110} color="wine" torn="r" seed={91} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <T size={50} upper>é risco até em <Em color={C.kraft}>outro ramo.</Em></T>
      </Paper>
    </Piece>
    <Piece x={70} y={730} rot={-3} seed={92} enter={{ kind: 'slide', at: 12, from: 'left', dist: 900, dur: 8 }}>
      <Paper w={400} h={420} color="cream" seed={92} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, color: C.wine }}>
        <Mark2 />
        <span style={mono}>marca famosa</span>
      </Paper>
    </Piece>
    <Piece x={590} y={770} rot={3} seed={93} enter={{ kind: 'slide', at: 24, from: 'right', dist: 900, dur: 8 }}>
      <Paper w={400} h={420} color="white" seed={93} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, color: C.wine }}>
        <Mark2 rot={45} />
        <span style={mono}>logo novo</span>
      </Paper>
    </Piece>
    <Piece x={470} y={880} seed={94} enter={{ kind: 'pop', at: 40 }} z={4}>
      <span style={{ fontFamily: SERIF, fontSize: 170, lineHeight: 1, color: C.wine }}>≈</span>
    </Piece>
    <Piece x={560} y={1100} rot={-8} seed={95} enter={{ kind: 'stamp', at: 100 }} z={6}>
      <Stamp text="parecido demais" size={44} color={C.wine} />
    </Piece>
    <Source at={60}>Lei 9.279/96, art. 125: marca de alto renome tem proteção em todos os ramos.</Source>
    <Sfx name="slide" at={12} vol={0.5} />
    <Sfx name="slide" at={24} vol={0.5} />
    <Sfx name="stamp" at={56} vol={0.9} />
    <Sfx name="stamp" at={100} vol={1} />
  </Scene>
);

/* 6 · O que fazer: "Antes de aprovar o logo novo com o designer, vale olhar o que já existe." */
const S6: React.FC = () => (
  <Scene bg="wine" topo={1} seed={68} cam={[1.0, 1.04]} punch={[[62, 0.03]]}>
    <Piece x={64} y={376} seed={100} boil={0.4}>
      <T size={50} upper color={C.cream} w={900}>
        <Reveal at={0}>Antes de aprovar o logo</Reveal>
        <Reveal at={6}>novo com o designer,</Reveal>
      </T>
    </Piece>
    <Piece x={58} y={520} rot={-2} seed={101} enter={{ kind: 'stamp', at: 62 }} z={5}>
      <Paper w={820} h={110} color="cream" torn="r" seed={101} style={{ display: 'flex', alignItems: 'center', paddingLeft: 30 }}>
        <T size={48} upper color={C.wine}>vale olhar o que <Mark at={74} seed={4}>já existe.</Mark></T>
      </Paper>
    </Piece>
    <Piece x={120} y={720} rot={-3} seed={102} enter={{ kind: 'slide', at: 10, from: 'left', dist: 1100, dur: 8 }}>
      <Paper w={480} h={560} color="kraftdeep" seed={102}>
        <div style={{ width: 150, height: 44, background: C.apoio, margin: '-6px auto 0', borderRadius: 6 }} />
        <div style={{ margin: '26px auto 0', width: 400 }}>
          <Paper w={400} h={440} color="white" seed={103} shadow="soft" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, color: C.wine }}>
            <span style={{ ...mono, fontSize: 18, opacity: 0.7 }}>logo novo · versão final</span>
            <Mark2 rot={45} />
            <div style={{ width: 220, height: 14, background: C.winedeep, opacity: 0.25 }} />
          </Paper>
        </div>
      </Paper>
    </Piece>
    <Piece x={560} y={770} rot={-10} seed={104} enter={{ kind: 'pop', at: 30 }} z={5} move={(f) => ({ y: Math.sin(Math.floor(f / 2) / 2.2) * 8 })}>
      <Stamp text="aprovar?" size={62} color={C.kraft} />
    </Piece>
    <Piece x={420} y={960} rot={-8} seed={105} enter={{ kind: 'slide', at: 84, from: 'right', dist: 900, dur: 8 }} z={6} boil={1.6}>
      <Loupe w={330} />
    </Piece>
    <Sfx name="slide" at={10} vol={0.55} />
    <Sfx name="pop" at={30} vol={0.5} />
    <Sfx name="stamp" at={62} vol={0.9} />
    <Sfx name="whoosh" at={84} vol={0.45} />
  </Scene>
);

/* 7 · Pergunta e CTA: "O seu logo está registrado, ou só o nome?" */
const S7: React.FC = () => (
  <Scene bg="cream" topo={0} seed={69} cam={[1.04, 1.0]}>
    <Piece x={60} y={420} seed={110} boil={0.5}>
      <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 124, lineHeight: 1, color: C.wine, letterSpacing: '-0.02em' }}>
        <Reveal at={0}>O seu logo está</Reveal>
        <Reveal at={6}>registrado,</Reveal>
        <Reveal at={36}>ou só o nome?</Reveal>
      </div>
    </Piece>
    <Piece x={64} y={880} rot={-2} seed={111} enter={{ kind: 'slide', at: 46, from: 'left', dist: 1200, dur: 8 }} z={5}>
      <Paper w={700} h={170} color="wine" torn="r" seed={111} style={{ padding: '28px 30px' }}>
        <T size={40} upper lh={1.1}>Salva pra conferir antes de aprovar o próximo.</T>
      </Paper>
    </Piece>
    <Piece x={760} y={1000} rot={7} seed={112} enter={{ kind: 'pop', at: 52 }} boil={1.3}>
      <Cup w={200} mark={<Flower4 w={70} />} />
    </Piece>
    <Sfx name="thud" at={36} vol={0.5} />
    <Sfx name="slide" at={46} vol={0.55} />
  </Scene>
);

export const EP06: SceneDef[] = [
  { id: 'gancho', dur: 200, el: <S1 /> },
  { id: 'contexto', dur: 210, el: <S2a /> },
  { id: 'conflito', dur: 138, el: <S2b /> },
  { id: 'justica', dur: 285, el: <S3 /> },
  { id: 'ponte', dur: 170, el: <S4a /> },
  { id: 'regra', dur: 222, el: <S4b /> },
  { id: 'licao', dur: 160, el: <S5 /> },
  { id: 'antes', dur: 160, el: <S6 /> },
  { id: 'pergunta', dur: 100, el: <S7 /> },
  { id: 'assinatura', dur: 66, el: <EndCard /> },
];
