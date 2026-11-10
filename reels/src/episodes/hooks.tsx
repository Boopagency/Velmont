import React from 'react';
import { Cutout, Em, Hl, Mark, Paper, Piece, Ransom, Reveal, Scene, Scribble, Sfx, Stamp, T, Tape, Typed } from '../kit';
import { C, SANS, SERIF } from '../theme';
import { SeriesTag } from './ep01';

/**
 * Cena de abertura (gancho e capa) dos episódios 02 a 10.
 * Cada uma é a primeira cena do seu episódio; aqui ficam juntas para o storyboard.
 */

const mono: React.CSSProperties = { fontFamily: SANS, fontWeight: 500, fontSize: 22, letterSpacing: '0.08em', textTransform: 'uppercase' };
const Bar: React.FC<{ w: number | string; o?: number }> = ({ w, o = 0.22 }) => <div style={{ width: w, height: 14, background: C.winedeep, opacity: o, margin: '12px 0' }} />;

/** 02 · Tenho CNPJ, o nome é meu */
export const Hook02: React.FC = () => (
  <Scene bg="kraft" topo={1} seed={21} cam={[1.0, 1.05]} punch={[[30, 0.03]]}>
    <SeriesTag n="02" />
    <Piece x={64} y={468} seed={2} boil={false}>
      <Ransom lines={['TENHO', 'CNPJ.']} size={150} at={0} seed={12} palette={['cream', 'wine', 'white', 'winedeep']} />
    </Piece>
    <Piece x={420} y={820} rot={2} seed={3} enter={{ kind: 'slide', at: 14, from: 'right', dist: 900, dur: 8 }}>
      <Paper w={560} h={108} color="wine" torn="l" seed={3} style={{ display: 'flex', alignItems: 'center', paddingLeft: 40 }}>
        <T size={62} upper>o nome é meu.</T>
      </Paper>
    </Piece>
    <Piece x={90} y={980} rot={-3} seed={4} enter={{ kind: 'slide', at: 6, from: 'bottom', dist: 1100 }}>
      <Paper w={800} h={420} color="white" seed={4} style={{ padding: '30px 36px', color: C.winedeep }}>
        <div style={{ ...mono, fontWeight: 800, borderBottom: `3px solid ${C.winedeep}`, paddingBottom: 12 }}>Cadastro Nacional da Pessoa Jurídica</div>
        <div style={{ ...mono, fontSize: 17, marginTop: 20, opacity: 0.7 }}>Nome empresarial</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: '0.02em' }}>ZUVÊ CONFEITARIA LTDA</div>
        <div style={{ ...mono, fontSize: 17, marginTop: 18, opacity: 0.7 }}>Situação cadastral</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 30 }}>ATIVA</div>
        <Bar w="72%" /><Bar w="48%" /><Bar w="60%" />
      </Paper>
    </Piece>
    <Piece x={380} y={1040} rot={-14} seed={5} enter={{ kind: 'stamp', at: 30 }} z={5}>
      <Stamp text="MITO" size={150} color={C.wine} />
    </Piece>
    <Sfx name="thud" at={0} vol={0.5} />
    {[0, 2, 4, 6, 8].map((f) => <Sfx key={f} name="tack" at={f} vol={0.5} />)}
    <Sfx name="slide" at={6} vol={0.55} />
    <Sfx name="slide" at={14} vol={0.5} />
    <Sfx name="stamp" at={30} vol={1} />
  </Scene>
);

/** 03 · Senha 001 */
export const Hook03: React.FC = () => (
  <Scene bg="wine" topo={0} seed={31} cam={[1.04, 1.0]} punch={[[34, 0.03]]}>
    <SeriesTag n="03" dark />
    <Piece x={64} y={462} seed={1} boil={0.4}>
      <T size={54} upper color={C.cream}>No Brasil,</T>
    </Piece>
    <Piece x={64} y={540} seed={2} boil={false}>
      <Ransom lines={['MARCA', 'TEM FILA.']} size={128} at={2} seed={31} palette={['cream', 'kraft', 'white', 'kraftdeep']} />
    </Piece>
    <Piece x={560} y={880} rot={3} seed={3}>
      <Paper w={400} h={330} color="kraftdeep" seed={3} style={{ padding: 26 }}>
        <div style={{ ...mono, fontWeight: 800, color: C.winedeep, fontSize: 24 }}>Retire sua senha</div>
        <div style={{ marginTop: 150, height: 30, background: C.night, borderRadius: 6 }} />
      </Paper>
    </Piece>
    <Piece x={612} y={1058} rot={-4} seed={4} z={4} enter={{ kind: 'cut', at: 18 }} move={(f) => ({ y: Math.min(0, -170 + Math.max(0, Math.floor((f - 18) / 2) * 2) * 13) })}>
      <Paper w={296} h={360} color="cream" torn="b" seed={4} style={{ padding: '28px 0', textAlign: 'center', color: C.winedeep }}>
        <div style={{ ...mono, fontWeight: 800, fontSize: 26 }}>Senha</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 150, lineHeight: 1, letterSpacing: '-0.04em' }}>001</div>
        <div style={{ ...mono, fontSize: 17, marginTop: 8, opacity: 0.7 }}>pedido de registro</div>
      </Paper>
    </Piece>
    <Piece x={64} y={1090} rot={-2} seed={5} enter={{ kind: 'stamp', at: 34 }} z={5}>
      <Paper w={470} h={196} color="kraft" torn="r" seed={5} style={{ padding: '26px 28px' }}>
        <T size={56} upper color={C.winedeep} lh={1.05}>Você pegou <Em>senha?</Em></T>
      </Paper>
    </Piece>
    <Sfx name="thud" at={0} vol={0.5} />
    {[2, 4, 6, 8, 10, 12].map((f) => <Sfx key={f} name="tack" at={f} vol={0.5} />)}
    <Sfx name="tear" at={18} vol={0.6} />
    <Sfx name="stamp" at={34} vol={0.95} />
    <Sfx name="ding" at={36} vol={0.4} />
  </Scene>
);

/** 04 · Não apareceu nada */
export const Hook04: React.FC = () => (
  <Scene bg="cream" topo={1} seed={41} cam={[1.0, 1.05]} punch={[[40, 0.03]]}>
    <SeriesTag n="04" />
    <Piece x={64} y={462} seed={1} boil={0.4}>
      <T size={56} upper color={C.wine}>Pesquisei no INPI.</T>
    </Piece>
    <Piece x={64} y={546} seed={2} boil={false}>
      <Ransom lines={['NÃO APARECEU', 'NADA.']} size={96} at={10} seed={41} />
    </Piece>
    <Piece x={64} y={850} rot={-1.5} seed={3} enter={{ kind: 'slide', at: 0, from: 'left', dist: 1100, dur: 8 }}>
      <Paper w={820} h={250} color="white" seed={3} style={{ padding: '26px 30px', color: C.winedeep }}>
        <div style={{ ...mono, fontSize: 18, opacity: 0.7 }}>Busca de marcas</div>
        <div style={{ marginTop: 12, border: `4px solid ${C.winedeep}`, borderRadius: 44, padding: '12px 30px', fontFamily: SANS, fontWeight: 800, fontSize: 52, letterSpacing: '0.02em' }}>
          <Typed text="DOCE LAR" at={4} cps={16} />
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 28, marginTop: 18 }}><Reveal at={26} rise={0}>0 resultados encontrados</Reveal></div>
      </Paper>
    </Piece>
    <Piece x={440} y={960} rot={-8} seed={4} enter={{ kind: 'slide', at: 30, from: 'right', dist: 900, dur: 8 }} z={4} boil={1.4}>
      <Cutout name="magnifier" w={560} srcW={860} />
    </Piece>
    <Piece x={70} y={1170} rot={-9} seed={5} enter={{ kind: 'stamp', at: 40 }} z={5}>
      <Stamp text="LIVRE?" size={104} color={C.wine} />
    </Piece>
    <Sfx name="slide" at={0} vol={0.55} />
    {[4, 8, 12, 16, 20].map((f) => <Sfx key={f} name="tick" at={f} vol={0.5} />)}
    {[10, 12, 14, 16, 18, 20, 22, 24].map((f) => <Sfx key={`t${f}`} name="tack" at={f} vol={0.4} />)}
    <Sfx name="whoosh" at={30} vol={0.5} />
    <Sfx name="stamp" at={40} vol={1} />
  </Scene>
);

/** 05 · Nome de todo mundo */
export const Hook05: React.FC = () => (
  <Scene bg="winedeep" topo={0} seed={51} cam={[1.04, 1.0]} punch={[[30, 0.03]]}>
    <SeriesTag n="05" dark />
    <Piece x={64} y={462} seed={1} boil={0.4}>
      <T size={46} upper color={C.cream} w={900} lh={1.1}>O nome mais fácil de entender costuma ser</T>
    </Piece>
    <Piece x={64} y={590} seed={2} boil={false}>
      <Ransom lines={['O MAIS', 'DIFÍCIL']} size={138} at={8} seed={52} palette={['cream', 'kraft', 'white', 'kraftdeep', 'apoio']} />
    </Piece>
    <Piece x={470} y={900} rot={2} seed={3} enter={{ kind: 'stamp', at: 30 }} z={5}>
      <Paper w={500} h={104} color="kraft" torn="l" seed={3} style={{ display: 'flex', alignItems: 'center', paddingLeft: 40 }}>
        <T size={56} upper color={C.winedeep}>de registrar.</T>
      </Paper>
    </Piece>
    <Piece x={110} y={1040} rot={-2.5} seed={4} enter={{ kind: 'drop', at: 4 }}>
      <div style={{ position: 'relative', width: 760, height: 360 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 760, height: 120, background: `repeating-linear-gradient(90deg, ${C.cream} 0 76px, ${C.wine} 76px 152px)`, clipPath: 'polygon(4% 0, 96% 0, 100% 78%, 95% 100%, 90% 80%, 85% 100%, 80% 80%, 75% 100%, 70% 80%, 65% 100%, 60% 80%, 55% 100%, 50% 80%, 45% 100%, 40% 80%, 35% 100%, 30% 80%, 25% 100%, 20% 80%, 15% 100%, 10% 80%, 5% 100%, 0 78%)' }} />
        <div style={{ position: 'absolute', left: 40, top: 130 }}>
          <Paper w={680} h={200} color="cream" seed={41} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <T size={78} upper color={C.wine} ls="0.01em">Bolos Caseiros</T>
            <div style={{ ...mono, fontSize: 18, color: C.wine, opacity: 0.7, marginTop: 6 }}>(nome fictício)</div>
          </Paper>
        </div>
      </div>
    </Piece>
    <Sfx name="thud" at={4} vol={0.6} />
    {[8, 10, 12, 14, 16, 18, 20].map((f) => <Sfx key={f} name="tack" at={f} vol={0.5} />)}
    <Sfx name="stamp" at={30} vol={0.95} />
  </Scene>
);

const NameTag: React.FC<{ seed: number }> = ({ seed }) => (
  <Paper w={420} h={250} color="cream" seed={seed} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.wine }}>
    <div style={{ position: 'absolute', left: 24, top: 108, width: 26, height: 26, borderRadius: 13, background: C.kraftdeep }} />
    <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 150, lineHeight: 0.9 }}>Zuvê</div>
    <div style={{ ...mono, fontSize: 16, opacity: 0.7, marginTop: 10 }}>(nome fictício)</div>
  </Paper>
);

/** 06 · 45 gavetas */
export const Hook06: React.FC = () => (
  <Scene bg="kraft" topo={0} seed={61} cam={[1.0, 1.05]} punch={[[38, 0.03]]}>
    <SeriesTag n="06" />
    <Piece x={64} y={468} seed={2} boil={false}>
      <Ransom lines={['O MESMO', 'NOME']} size={138} at={0} seed={63} palette={['cream', 'wine', 'white', 'winedeep']} />
    </Piece>
    <Piece x={64} y={800} seed={1} boil={0.4}>
      <T size={58} upper color={C.winedeep} w={900} lh={1.06}>
        <Reveal at={14}>pode ter dois donos.</Reveal>
        <Reveal at={38}><Em color={C.wine} scale={1.3}>E os dois estarem certos.</Em></Reveal>
      </T>
    </Piece>
    <Piece x={70} y={1010} rot={-6} seed={3} enter={{ kind: 'slide', at: 8, from: 'left', dist: 900 }}>
      <NameTag seed={3} />
    </Piece>
    <Piece x={560} y={1130} rot={5} seed={4} enter={{ kind: 'slide', at: 14, from: 'right', dist: 900 }}>
      <NameTag seed={4} />
    </Piece>
    <Piece x={360} y={1160} rot={-14} seed={5} enter={{ kind: 'stamp', at: 22 }} z={5}>
      <Stamp text="R" round size={64} color={C.wine} />
    </Piece>
    <Piece x={850} y={1270} rot={10} seed={6} enter={{ kind: 'stamp', at: 28 }} z={5}>
      <Stamp text="R" round size={64} color={C.wine} />
    </Piece>
    {[0, 2, 4, 6, 8, 10].map((f) => <Sfx key={f} name="tack" at={f} vol={0.5} />)}
    <Sfx name="slide" at={8} vol={0.55} />
    <Sfx name="slide" at={14} vol={0.55} />
    <Sfx name="stamp" at={22} vol={0.9} />
    <Sfx name="stamp" at={28} vol={0.9} />
  </Scene>
);

/** 07 · O cupom inteiro */
export const Hook07: React.FC = () => (
  <Scene bg="wine" topo={1} seed={71} cam={[1.04, 1.0]} punch={[[34, 0.03]]}>
    <SeriesTag n="07" dark />
    <Piece x={64} y={462} seed={1} boil={0.4}>
      <T size={48} upper color={C.cream} w={900} lh={1.1}>Orçamento de marca<br />com uma linha só?</T>
    </Piece>
    <Piece x={64} y={610} seed={2} boil={false}>
      <Ransom lines={['PEÇA O', 'CUPOM']} size={138} at={10} seed={72} palette={['cream', 'kraft', 'white', 'kraftdeep']} />
    </Piece>
    <Piece x={64} y={930} rot={-2} seed={3} enter={{ kind: 'stamp', at: 34 }} z={5}>
      <Paper w={420} h={108} color="kraft" torn="r" seed={3} style={{ display: 'flex', alignItems: 'center', paddingLeft: 28 }}>
        <T size={66} upper color={C.winedeep}>inteiro.</T>
      </Paper>
    </Piece>
    <Piece x={540} y={900} rot={5} seed={4} enter={{ kind: 'drop', at: 2 }}>
      <Paper w={420} h={500} color="white" torn="tb" seed={4} rough={9} style={{ padding: '46px 30px', color: C.winedeep }}>
        <div style={{ ...mono, fontWeight: 800, textAlign: 'center', fontSize: 24 }}>Orçamento</div>
        <div style={{ borderTop: `3px dashed ${C.winedeep}`, margin: '16px 0', opacity: 0.6 }} />
        <div style={{ ...mono, fontWeight: 800, fontSize: 24 }}>Registro de marca</div>
        <div style={{ ...mono, fontSize: 20, marginTop: 30, opacity: 0.75 }}>Total</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 60 }}>R$</div>
        <div style={{ borderTop: `3px dashed ${C.winedeep}`, margin: '22px 0 12px', opacity: 0.6 }} />
        <div style={{ ...mono, fontSize: 16, opacity: 0.6, textAlign: 'center' }}>só isso?</div>
      </Paper>
    </Piece>
    <Piece x={640} y={1150} rot={-4} seed={5} enter={{ kind: 'cut', at: 16 }} z={4}>
      <Tape w={300} h={70} color="kraft" seed={5} opacity={1} />
    </Piece>
    <Sfx name="register" at={2} vol={0.6} />
    {[10, 12, 14, 16, 18, 20].map((f) => <Sfx key={f} name="tack" at={f} vol={0.5} />)}
    <Sfx name="tape" at={14} vol={0.5} />
    <Sfx name="stamp" at={34} vol={0.95} />
  </Scene>
);

const Item: React.FC<{ text: string; at: number; done?: boolean; seed: number }> = ({ text, at, done = true, seed }) => (
  <div style={{ position: 'relative', height: 86, display: 'flex', alignItems: 'center', gap: 22, borderBottom: `2px solid ${C.apoio}` }}>
    <div style={{ width: 40, height: 40, border: `4px solid ${C.winedeep}`, position: 'relative' }}>
      {done && <div style={{ position: 'absolute', left: -2, top: -16 }}><Scribble kind="check" w={54} h={50} at={at} dur={5} seed={seed} stroke={6} /></div>}
    </div>
    <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 42, color: C.winedeep, position: 'relative' }}>
      {text}
      {done && <div style={{ position: 'absolute', left: -6, top: 6, right: -6 }}><Scribble kind="strike" w={text.length * 23} h={30} at={at + 3} dur={5} seed={seed + 1} stroke={5} /></div>}
    </span>
  </div>
);

/** 08 · Semana que vem */
export const Hook08: React.FC = () => (
  <Scene bg="cream" topo={0} seed={81} cam={[1.0, 1.05]} punch={[[40, 0.03]]}>
    <SeriesTag n="08" />
    <Piece x={84} y={470} rot={-1.5} seed={3}>
      <Paper w={800} h={520} color="white" torn="t" seed={3} rough={5} style={{ padding: '44px 44px 0' }}>
        <div style={{ ...mono, fontWeight: 800, color: C.wine, fontSize: 24, marginBottom: 8 }}>Lista da semana</div>
        <Item text="fornecedor" at={2} seed={1} />
        <Item text="folha" at={8} seed={3} />
        <Item text="boleto" at={14} seed={5} />
        <Item text="registrar a marca" at={0} done={false} seed={7} />
      </Paper>
    </Piece>
    <Piece x={166} y={808} seed={4} boil={0.8} z={4}>
      <Scribble kind="circle" w={470} h={104} at={22} dur={8} seed={4} stroke={7} />
    </Piece>
    <Piece x={650} y={900} rot={75} seed={5} boil={0.8} z={4}>
      <Scribble kind="arrow" w={130} h={120} at={30} dur={6} seed={5} stroke={7} />
    </Piece>
    <Piece x={64} y={1060} seed={2} boil={false} z={5}>
      <Ransom lines={['SEMANA', 'QUE VEM']} size={138} at={36} seed={83} />
    </Piece>
    <Sfx name="scribble" at={2} vol={0.5} />
    <Sfx name="scribble" at={8} vol={0.5} />
    <Sfx name="scribble" at={14} vol={0.5} />
    <Sfx name="scribble" at={22} vol={0.6} />
    {[36, 38, 40, 42, 44, 46].map((f) => <Sfx key={f} name="tack" at={f} vol={0.5} />)}
    <Sfx name="thud" at={36} vol={0.6} />
  </Scene>
);

/** 09 · Dá pra alugar um nome */
export const Hook09: React.FC = () => (
  <Scene bg="winedeep" topo={1} seed={91} cam={[1.04, 1.0]} punch={[[30, 0.03]]}>
    <SeriesTag n="09" dark />
    <Piece x={64} y={468} seed={2} boil={false}>
      <Ransom lines={['DÁ PRA', 'ALUGAR']} size={140} at={0} seed={92} palette={['cream', 'kraft', 'white', 'kraftdeep', 'apoio']} />
    </Piece>
    <Piece x={520} y={800} rot={2} seed={3} enter={{ kind: 'stamp', at: 30 }} z={5}>
      <Paper w={450} h={108} color="kraft" torn="l" seed={3} style={{ display: 'flex', alignItems: 'center', paddingLeft: 40 }}>
        <T size={62} upper color={C.winedeep}>um nome.</T>
      </Paper>
    </Piece>
    <Piece x={120} y={940} rot={-2} seed={4} enter={{ kind: 'slide', at: 6, from: 'left', dist: 1100 }}>
      <Paper w={780} h={230} color="cream" seed={4} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.wine, border: `10px solid ${C.wine}` }}>
        <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 170, lineHeight: 1 }}>Zuvê</span>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 44, alignSelf: 'flex-start', marginTop: 36 }}>®</span>
      </Paper>
    </Piece>
    <Piece x={330} y={1150} rot={5} seed={5} origin="50% 0%" enter={{ kind: 'drop', at: 16, dur: 10 }} z={4} move={(f) => ({ rot: Math.sin(Math.floor(f / 2) / 2.6) * 4 })}>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 60, top: -44, width: 4, height: 50, background: C.kraft, transform: 'rotate(10deg)' }} />
        <div style={{ position: 'absolute', right: 60, top: -44, width: 4, height: 50, background: C.kraft, transform: 'rotate(-10deg)' }} />
        <Paper w={400} h={150} color="kraft" seed={5} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <T size={72} upper color={C.winedeep} ls="0.04em">Aluga-se</T>
        </Paper>
      </div>
    </Piece>
    {[0, 2, 4, 6, 8, 10].map((f) => <Sfx key={f} name="tack" at={f} vol={0.5} />)}
    <Sfx name="slide" at={6} vol={0.55} />
    <Sfx name="place" at={24} vol={0.7} />
    <Sfx name="stamp" at={30} vol={0.95} />
  </Scene>
);

const Floor: React.FC<{ text: string; color: 'kraft' | 'white' | 'wine' | 'kraftdeep' | 'apoio'; w: number; seed: number }> = ({ text, color, w, seed }) => (
  <Paper w={w} h={84} color={color} seed={seed} shadow="soft" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <T size={34} upper ls="0.08em">{text}</T>
  </Paper>
);

const FLOORS: { text: string; color: 'kraft' | 'white' | 'wine' | 'kraftdeep' | 'apoio'; w: number; dx: number; rot: number }[] = [
  { text: 'o nome', color: 'wine', w: 380, dx: 0, rot: -1 },
  { text: 'fachada', color: 'kraft', w: 350, dx: 14, rot: 1.5 },
  { text: 'embalagem', color: 'white', w: 370, dx: -8, rot: -2 },
  { text: 'cardápio', color: 'kraftdeep', w: 340, dx: 18, rot: 1 },
  { text: 'clientes', color: 'apoio', w: 330, dx: 4, rot: -1.5 },
];

/** 10 · Pensa a sua marca crescer */
export const Hook10: React.FC = () => (
  <Scene bg="cream" topo={1} seed={101} cam={[1.0, 1.05]} punch={[[44, 0.03]]}>
    <SeriesTag n="10" />
    <Piece x={64} y={462} seed={1} boil={0.4}>
      <T size={52} upper color={C.wine} w={900}>Pensa a sua marca <Mark at={8} seed={2}>crescer</Mark></T>
    </Piece>
    <Piece x={64} y={548} seed={2} boil={false}>
      <Ransom lines={['E VOCÊ', 'NÃO TER']} size={124} at={14} seed={103} />
    </Piece>
    <Piece x={64} y={836} rot={-2} seed={3} enter={{ kind: 'stamp', at: 44 }} z={6}>
      <Paper w={600} h={104} color="wine" torn="r" seed={3} style={{ display: 'flex', alignItems: 'center', paddingLeft: 28 }}>
        <T size={52} upper>o registro dela.</T>
      </Paper>
    </Piece>
    {FLOORS.map((fl, i) => (
      <React.Fragment key={i}>
        <Piece x={600 + fl.dx} y={1250 - i * 80} rot={fl.rot} seed={110 + i} enter={{ kind: 'drop', at: 4 + i * 7, dur: 8 }} z={2 + i} boil={1.3}>
          <Floor text={fl.text} color={fl.color} w={fl.w} seed={110 + i} />
        </Piece>
        <Sfx name="place" at={10 + i * 7} vol={0.7} />
      </React.Fragment>
    ))}
    <Piece x={588} y={1340} seed={120} boil={0.6} z={1}>
      <div style={{ width: 400, height: 84, border: `5px dashed ${C.wine}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <T size={34} upper ls="0.08em" color={C.wine}>registro?</T>
      </div>
    </Piece>
    {[14, 16, 18, 20, 22, 24].map((f) => <Sfx key={f} name="tack" at={f} vol={0.45} />)}
    <Sfx name="stamp" at={44} vol={0.95} />
  </Scene>
);

export const HOOKS = [Hook02, Hook03, Hook04, Hook05, Hook06, Hook07, Hook08, Hook09, Hook10];
