import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { color, sans, serif } from "../brand";
import { BrandFrame } from "../collage/BrandFrame";
import { Camera } from "../collage/Camera";
import { Cutout } from "../collage/Cutout";
import { onTwos } from "../collage/motion";
import { PaperBackground, TornPaper } from "../collage/Paper";
import { Rip } from "../collage/Rip";
import { marks, Scribble } from "../collage/Scribble";
import { SlideIn } from "../collage/SlideIn";
import { Stamp } from "../collage/Stamp";
import { Tape } from "../collage/Tape";
import { TopoLines } from "../collage/TopoLines";

// Scene lengths in seconds. Total 33 s.
export const SCENES = { cover: 3, news: 4, notice: 5, pending: 3, law: 6, split: 6, cta: 6 } as const;

const title: React.CSSProperties = {
  fontFamily: sans,
  fontWeight: 800,
  textTransform: "uppercase",
  lineHeight: 1.02,
  letterSpacing: "-0.015em",
  margin: 0,
};
const caps: React.CSSProperties = {
  fontFamily: sans,
  fontWeight: 500,
  textTransform: "uppercase",
  lineHeight: 1.22,
  margin: 0,
};
const U: React.FC<{ children: React.ReactNode; c?: string }> = ({ children, c }) => (
  <span style={{ textDecoration: "underline", textDecorationThickness: "0.075em", textUnderlineOffset: "0.13em", textDecorationColor: c }}>{children}</span>
);
const B: React.FC<{ children: React.ReactNode }> = ({ children }) => <b style={{ fontWeight: 800 }}>{children}</b>;
const At: React.FC<{ x: number; y: number; w: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, y, w, children, style }) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, ...style }}>{children}</div>
);

/* 0 to 3 s: the cover */
export const Cover: React.FC = () => (
  <AbsoluteFill>
    <Camera duration={SCENES.cover * 30} seed={1}>
      <PaperBackground tone="cream" seed={1} />
      <TopoLines color={color.wine} opacity={0.2} seed={3} />
      <At x={80} y={384} w={880}>
        <h1 style={{ ...title, fontSize: 86, color: color.wineDeep }}>
          10 anos usando
          <br />o <U>nome.</U>
        </h1>
      </At>
      <SlideIn at={0} from={[-1000, 0]} rotateFrom={-6} duration={8} origin={[500, 640]}>
        <TornPaper tone="wine" x={64} y={584} width={880} height={124} rotate={-1.8} seed={11} torn={{ right: true }}>
          <div style={{ ...title, fontSize: 74, color: color.ivory, padding: "22px 30px" }}>Nunca registrou.</div>
        </TornPaper>
        <Tape at={8} x={44} y={652} width={112} height={46} rotate={-40} seed={12} />
      </SlideIn>
      <SlideIn at={0} from={[0, 1000]} rotateFrom={8} duration={10} origin={[320, 1080]}>
        <TornPaper tone="kraft" x={70} y={770} width={500} height={600} rotate={3} seed={13} />
      </SlideIn>
      <SlideIn at={4} from={[0, 1100]} rotateFrom={-10} duration={10} origin={[310, 1080]}>
        <Cutout src="cutouts/microphone" x={140} y={730} width={340} rotate={-6} seed={14} />
      </SlideIn>
      <Scribble d={marks.burst} at={30} x={466} y={790} width={120} rotate={-8} seed={15} />
      <Stamp at={20} x={730} y={1110} rotate={-11} size={84} seed={16}>
        10 ANOS
      </Stamp>
    </Camera>
    <BrandFrame top="light" bottom="light" />
  </AbsoluteFill>
);

/* 3 to 7 s: the report, as a newspaper clipping put together for the video */
export const News: React.FC = () => (
  <AbsoluteFill>
    <Camera duration={SCENES.news * 30} seed={2}>
      <PaperBackground tone="kraft" seed={2} />
      <TopoLines color={color.wine} opacity={0.16} seed={8} />
      <SlideIn at={0} from={[1100, 60]} rotateFrom={10} duration={10} origin={[520, 810]}>
        <TornPaper tone="white" x={96} y={430} width={850} height={700} rotate={-2} seed={21}>
          <div style={{ position: "absolute", left: 46, right: 46, top: 40 }}>
            <div style={{ borderTop: `3px solid ${color.ink}`, borderBottom: `1px solid ${color.ink}`, height: 7, marginBottom: 30 }} />
            <p style={{ fontFamily: sans, fontWeight: 800, fontSize: 60, lineHeight: 1.08, letterSpacing: "-0.02em", color: color.ink, margin: 0 }}>
              Paulinho o Loko contou que pode ter que <U c={color.wine}>mudar o próprio nome artístico.</U>
            </p>
            <div style={{ display: "flex", gap: 30, marginTop: 40 }}>
              {[0, 1].map((col) => (
                <div key={col} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 15 }}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <div key={i} style={{ height: 11, background: "rgba(22,11,15,0.22)", width: i === 11 ? "55%" : `${88 + ((i * 7 + col * 3) % 12)}%` }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </TornPaper>
      </SlideIn>
      <Tape at={10} x={150} y={442} width={190} height={58} rotate={-34} seed={22} />
      <Tape at={12} x={905} y={428} width={190} height={58} rotate={30} seed={23} />
      <At x={110} y={1170} w={820}>
        <p style={{ fontFamily: sans, fontWeight: 500, fontSize: 27, color: color.wineDeep, margin: 0 }}>Fonte: Portal Minuto News, 26/07/2026</p>
      </At>
      <Scribble d={marks.arrow} at={44} x={690} y={1150} width={170} rotate={200} seed={24} />
    </Camera>
    <BrandFrame top="light" bottom="light" />
  </AbsoluteFill>
);

/** Tear-off desk calendar drawn in the halftone style: pages fall until 10. */
const Calendar: React.FC<{ x: number; y: number; start: number }> = ({ x, y, start }) => {
  const frame = useCurrentFrame();
  const f = onTwos(frame) - start;
  // one page every 6 frames, 1 -> 10; the page on top falls in 3 poses
  const day = Math.min(10, 1 + Math.max(0, Math.floor(f / 6)));
  const falling = f >= 6 && f < 60 ? f % 6 : -1;
  const dots = "radial-gradient(circle, rgba(24,18,20,0.85) 34%, transparent 37%) 0 0 / 9px 9px";
  const page = (n: number, style?: React.CSSProperties) => (
    <div style={{ position: "absolute", left: 18, top: 44, width: 364, height: 330, background: color.white, ...style }}>
      <div style={{ height: 58, background: color.wine }} />
      <div style={{ ...title, fontSize: 210, lineHeight: "272px", textAlign: "center", color: color.ink, letterSpacing: "-0.04em" }}>{n}</div>
      {/* printed shading at the foot of the page */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 40, background: dots, opacity: 0.35 }} />
    </div>
  );
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 400, height: 470, filter: "drop-shadow(0 6px 6px rgba(10,4,6,0.45))" }}>
      {/* sticker border, like the photo cutouts */}
      <div style={{ position: "absolute", inset: -14, background: color.white, borderRadius: 22 }} />
      {/* stand */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 360, height: 110, background: dots, backgroundColor: "#6b6266", clipPath: "polygon(6% 0, 94% 0, 100% 100%, 0 100%)" }} />
      {page(day)}
      {falling >= 0 ? (
        page(day - 1, {
          translate: `${falling * 18}px ${falling * falling * 18}px`,
          rotate: `${falling * -8}deg`,
          transformOrigin: "20% 0",
        })
      ) : null}
      {/* rings */}
      {[70, 140, 260, 330].map((rx) => (
        <div key={rx} style={{ position: "absolute", left: rx, top: 28, width: 16, height: 34, borderRadius: 8, background: color.ink }} />
      ))}
    </div>
  );
};

/* 7 to 12 s: the notice */
export const Notice: React.FC = () => (
  <AbsoluteFill>
    <Camera duration={SCENES.notice * 30} seed={3}>
      <PaperBackground tone="wine" seed={3} />
      <TopoLines color={color.champagne} opacity={0.22} seed={5} />
      <SlideIn at={0} from={[-1000, 0]} rotateFrom={-5} duration={8} origin={[500, 500]}>
        <TornPaper tone="white" x={80} y={384} width={860} height={236} rotate={-1} seed={31} torn={{}}>
          <p style={{ ...caps, fontSize: 42, color: color.ink, padding: "32px 38px" }}>
            Segundo ele, outra pessoa registrou o nome no <B>INPI</B> e mandou um aviso:
          </p>
        </TornPaper>
      </SlideIn>
      <SlideIn at={30} from={[0, 50]} scaleFrom={0.7} duration={8} origin={[520, 768]}>
        <TornPaper tone="cream" x={120} y={662} width={800} height={212} rotate={1.5} seed={32} torn={{}}>
          <p style={{ ...title, fontSize: 60, lineHeight: 1.05, color: color.wine, padding: "40px 44px" }}>
            10 dias pra parar
            <br />
            de usar.
          </p>
        </TornPaper>
        {/* balloon tail */}
        <svg width="90" height="80" viewBox="0 0 90 80" style={{ position: "absolute", left: 180, top: 866, filter: "drop-shadow(0 5px 5px rgba(10,4,6,0.4))" }}>
          <path d="M 0 0 L 70 0 L 8 78 Z" fill={color.ivory} />
        </svg>
      </SlideIn>
      <SlideIn at={40} from={[-700, 80]} rotateFrom={-12} duration={10} origin={[300, 1160]}>
        <Calendar x={110} y={944} start={52} />
      </SlideIn>
      <Scribble d={marks.circle} at={108} x={100} y={1024} width={420} height={330} seed={34} />
      <SlideIn at={18} from={[700, 0]} rotateFrom={14} duration={10} origin={[760, 1140]}>
        <Cutout src="cutouts/clock" x={600} y={930} width={320} rotate={9} seed={35} />
      </SlideIn>
      <Scribble d={marks.burst} at={60} x={846} y={880} width={100} rotate={-55} stroke={color.champagne} seed={36} />
    </Camera>
    <BrandFrame top="dark" bottom="dark" />
  </AbsoluteFill>
);

/* 12 to 15 s: no decision yet */
export const Pending: React.FC = () => (
  <AbsoluteFill>
    <Camera duration={SCENES.pending * 30} seed={4}>
      <PaperBackground tone="cream" seed={4} />
      <TopoLines color={color.wine} opacity={0.2} seed={9} />
      <At x={80} y={384} w={880}>
        <h2 style={{ ...title, fontSize: 92, color: color.wineDeep }}>
          O caso ainda
          <br />
          não teve
          <br />
          <U>decisão.</U>
        </h2>
      </At>
      <SlideIn at={0} from={[0, 900]} rotateFrom={6} duration={10} origin={[540, 1050]}>
        <TornPaper tone="kraft" x={180} y={722} width={270} height={90} rotate={3} seed={41} torn={{}} />
        <TornPaper tone="kraft" x={130} y={772} width={810} height={620} rotate={3} seed={42} torn={{ bottom: true }}>
          <div style={{ position: "absolute", left: 60, top: 70, width: 330, height: 120, background: color.white, opacity: 0.85 }}>
            {[30, 60, 90].map((ty) => (
              <div key={ty} style={{ position: "absolute", left: 24, right: 24, top: ty, height: 2, background: "rgba(22,11,15,0.3)" }} />
            ))}
          </div>
        </TornPaper>
      </SlideIn>
      <Stamp at={14} x={540} y={1080} rotate={-9} size={70} seed={43}>
        EM ANDAMENTO
      </Stamp>
    </Camera>
    <BrandFrame top="light" bottom="light" />
  </AbsoluteFill>
);

/* 15 to 21 s: what the law says */
export const Law: React.FC = () => (
  <AbsoluteFill>
    <Camera duration={SCENES.law * 30} seed={5}>
      <PaperBackground tone="wine" seed={5} />
      <TopoLines color={color.champagne} opacity={0.2} seed={11} />
      <At x={80} y={384} w={880}>
        <p style={{ ...title, fontSize: 54, fontWeight: 500, color: color.ivory }}>No Brasil,</p>
        <h2 style={{ ...title, fontSize: 80, color: color.ivory, marginTop: 10 }}>
          <U c={color.champagne}>a marca é de</U>
          <br />
          <U c={color.champagne}>quem registra.</U>
        </h2>
      </At>
      <SlideIn at={0} from={[0, 900]} rotateFrom={-8} duration={10} origin={[540, 850]}>
        <TornPaper tone="cream" x={130} y={652} width={800} height={400} rotate={-2} seed={51} torn={{}}>
          <div style={{ position: "absolute", inset: 20, border: "3px solid #b39a72" }} />
          <div style={{ position: "absolute", inset: 30, border: "1px solid #b39a72" }} />
          <p style={{ ...caps, fontWeight: 800, fontSize: 26, letterSpacing: "0.22em", color: color.wine, textAlign: "center", marginTop: 66 }}>
            Certificado de registro
          </p>
          {[150, 205, 260].map((ty, i) => (
            <div key={ty} style={{ position: "absolute", left: 90, width: i === 0 ? 620 : 520 - i * 60, top: ty, height: 2, background: "rgba(61,16,30,0.35)" }} />
          ))}
          <div style={{ position: "absolute", left: 90, top: 330, width: 220, height: 2, background: "rgba(61,16,30,0.5)" }} />
        </TornPaper>
      </SlideIn>
      <Stamp at={18} x={800} y={984} rotate={-14} size={68} seed={52} variant="seal" />
      <SlideIn at={75} from={[-1000, 0]} rotateFrom={-5} duration={8} origin={[500, 1210]}>
        <TornPaper tone="white" x={80} y={1094} width={860} height={232} rotate={1} seed={53} torn={{}}>
          <p style={{ ...caps, fontSize: 41, color: color.ink, padding: "30px 36px" }}>
            Quem já usava de <B>boa-fé</B> pode ter preferência, <U c={color.wine}>mas precisa provar.</U>
          </p>
        </TornPaper>
        <Tape at={83} x={110} y={1102} width={150} height={50} rotate={-30} seed={54} />
      </SlideIn>
      <At x={84} y={1356} w={800}>
        <p style={{ fontFamily: sans, fontWeight: 500, fontSize: 24, letterSpacing: "0.04em", color: color.champagne, margin: 0 }}>LEI 9.279/96, ART. 129</p>
      </At>
    </Camera>
    <BrandFrame top="dark" bottom="dark" />
  </AbsoluteFill>
);

/* 21 to 27 s: before, after, and the bridge */
export const Split: React.FC = () => (
    <AbsoluteFill>
      <Camera duration={SCENES.split * 30} seed={6}>
        <PaperBackground tone="wine" seed={6} />
        <TopoLines color={color.champagne} opacity={0.2} seed={13} />
        <At x={80} y={1010} w={860}>
          <p style={{ ...title, fontSize: 86, color: color.champagne }}>Depois:</p>
          <p style={{ ...title, fontSize: 60, fontWeight: 700, color: color.ivory, marginTop: 14 }}>
            Prazo pra parar
            <br />
            de usar.
          </p>
        </At>
        <Rip at={30} y={850} seed={61} rim="#fffdf7">
          <PaperBackground tone="cream" seed={7} />
          <TopoLines color={color.wine} opacity={0.2} seed={15} />
          <At x={80} y={392} w={860}>
            <p style={{ ...title, fontSize: 86, color: color.wine }}>Antes:</p>
            <p style={{ ...title, fontSize: 60, fontWeight: 700, color: color.wineDeep, marginTop: 14 }}>
              Nome conhecido,
              <br />
              sem registro.
            </p>
          </At>
        </Rip>
        <Tape at={96} x={530} y={866} width={960} height={196} rotate={-4} seed={62}>
          <span style={{ ...caps, fontWeight: 700, fontSize: 32, letterSpacing: "0.06em", color: color.wine }}>Entre os dois, o</span>
          <span style={{ ...title, fontSize: 92, color: color.wine }}>Registro.</span>
        </Tape>
      </Camera>
      <BrandFrame top="light" bottom="dark" />
    </AbsoluteFill>
);

/* 27 to 33 s: the call */
export const Cta: React.FC = () => (
  <AbsoluteFill>
    <Camera duration={SCENES.cta * 30} seed={7}>
      <PaperBackground tone="wine" seed={8} />
      <TopoLines color={color.champagne} opacity={0.18} seed={17} />
      <div
        style={{
          position: "absolute",
          left: 250,
          top: 372,
          width: 520,
          height: 260,
          backgroundColor: color.champagne,
          maskImage: `url(${staticFile("brand/velmont-logo.webp")})`,
          maskSize: "contain",
          maskRepeat: "no-repeat",
        }}
      />
      <At x={80} y={662} w={860} style={{ textAlign: "center" }}>
        <p style={{ ...title, fontSize: 64, color: color.ivory }}>
          O seu nome
          <br />é conhecido.
        </p>
        <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 124, lineHeight: 0.95, color: color.champagne, margin: "26px 0 0" }}>
          Ele está
          <br />
          registrado?
        </p>
      </At>
      <SlideIn at={75} from={[0, 700]} rotateFrom={6} duration={8} origin={[510, 1200]}>
        <TornPaper tone="cream" x={110} y={1128} width={800} height={176} rotate={-1.5} seed={71} torn={{ left: true }}>
          <p style={{ ...title, fontSize: 52, lineHeight: 1.08, color: color.wine, padding: "32px 44px", textAlign: "center" }}>
            Chama a Velmont
            <br />
            no WhatsApp.
          </p>
        </TornPaper>
        <Tape at={83} x={880} y={1134} width={150} height={50} rotate={32} seed={72} />
      </SlideIn>
    </Camera>
    <BrandFrame top="dark" bottom="dark" largeHandle />
  </AbsoluteFill>
);
