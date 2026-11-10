import React from "react";
import { AbsoluteFill, Series, useVideoConfig } from "remotion";
import { color } from "../brand";
import { Cover, Law, News, Notice, Pending, Question, SCENES, Split } from "./scenes";

// Hard cuts between scenes: a Series with no transitions.
export const M1Paulinho: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: color.wineDeep }}>
      <Series>
        <Series.Sequence name="Capa" durationInFrames={SCENES.cover * fps}>
          <Cover />
        </Series.Sequence>
        <Series.Sequence name="Jornal" durationInFrames={SCENES.news * fps}>
          <News />
        </Series.Sequence>
        <Series.Sequence name="Aviso" durationInFrames={SCENES.notice * fps}>
          <Notice />
        </Series.Sequence>
        <Series.Sequence name="Em andamento" durationInFrames={SCENES.pending * fps}>
          <Pending />
        </Series.Sequence>
        <Series.Sequence name="Lei" durationInFrames={SCENES.law * fps}>
          <Law />
        </Series.Sequence>
        <Series.Sequence name="Antes e depois" durationInFrames={SCENES.split * fps}>
          <Split />
        </Series.Sequence>
        <Series.Sequence name="Pergunta" durationInFrames={SCENES.question * fps}>
          <Question />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
