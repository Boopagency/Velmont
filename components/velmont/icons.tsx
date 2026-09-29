import type { CSSProperties } from 'react';
type IconName = 'arrow' | 'star' | 'menu' | 'close' | 'play' | 'pause' | 'grid' | 'window' | 'minus' | 'sound' | 'mute' | 'captions' | 'expand' | 'restart';
const paths: Record<IconName, string> = {
  arrow: 'M5 19 19 5M5 5h14v14', star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z',
  menu: 'M4 6h16M4 12h16M4 18h16', close: 'm5 5 14 14M5 19 19 5', play: 'm7 4 13 8-13 8Z', pause: 'M8 5v14M16 5v14',
  grid: 'M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18', window: 'M4 4h16v16H4Z', minus: 'M4 12h16',
  sound: 'M4 9h4l5-4v14l-5-4H4ZM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12', mute: 'M4 9h4l5-4v14l-5-4H4ZM16 9l5 6M21 9l-5 6',
  captions: 'M3 5h18v14H3ZM7 11h4M13 11h4M7 15h7M16 15h1', expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', restart: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5',
};
export function Icon({ name, style }: { name: IconName; style?: CSSProperties }) {
  return <svg className={`vm-icon vm-icon-${name}`} style={style} viewBox="0 0 24 24" width="24" height="24" fill={name === 'star' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
export function Arrow({ direction = 'diagonal' }: { direction?: 'diagonal' | 'down' | 'up' | 'left' | 'right' }) {
  const rotation = { diagonal: 0, right: 45, down: 135, left: 225, up: -45 }[direction];
  return <span className="icon-wrap" aria-hidden="true"><Icon name="arrow" style={{ transform: `rotate(${rotation}deg)` }} /></span>;
}
