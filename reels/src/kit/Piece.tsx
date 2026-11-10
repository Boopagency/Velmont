import React from 'react';
import { useCurrentFrame } from 'remotion';
import { boil, enterPose, exitPose, type Enter, type Exit } from '../lib/motion';

/**
 * Um recorte na mesa: posição, entrada, saída e o "boil" (tremida de papel).
 * Tudo que aparece em cena fica dentro de um Piece.
 */
export const Piece: React.FC<{
  x: number;
  y: number;
  rot?: number;
  scale?: number;
  enter?: Enter;
  exit?: Exit;
  boil?: number | false;
  seed?: number;
  z?: number;
  origin?: string;
  /** deslocamento extra, quadro a quadro, para animações próprias da cena */
  move?: (frame: number) => { x?: number; y?: number; rot?: number; scale?: number; opacity?: number };
  children: React.ReactNode;
}> = ({ x, y, rot = 0, scale = 1, enter, exit, boil: boilAmp = 1, seed = 1, z, origin = 'center', move, children }) => {
  const frame = useCurrentFrame();
  const a = enterPose(frame, enter, seed);
  const b = exitPose(frame, exit, seed);
  const w = boilAmp === false ? { x: 0, y: 0, rot: 0 } : boil(frame, seed, boilAmp);
  const m = move ? move(frame) : {};
  const opacity = a.opacity * b.opacity * (m.opacity ?? 1);
  if (opacity <= 0) return null;
  const tx = a.x + b.x + w.x + (m.x ?? 0);
  const ty = a.y + b.y + w.y + (m.y ?? 0);
  const r = rot + a.rot + b.rot + w.rot + (m.rot ?? 0);
  const s = scale * a.scale * b.scale * (m.scale ?? 1);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: z,
        opacity,
        transformOrigin: origin,
        transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) rotate(${r.toFixed(3)}deg) scale(${s.toFixed(4)})`,
      }}
    >
      {children}
    </div>
  );
};
