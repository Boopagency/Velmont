import type { CSSProperties } from 'react';
type IconName = 'arrow' | 'star' | 'menu' | 'close' | 'play' | 'pause' | 'grid' | 'window' | 'minus';
const paths: Record<IconName, string> = {
  arrow: 'M5 19 19 5M5 5h14v14', star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z',
  menu: 'M4 6h16M4 12h16M4 18h16', close: 'm5 5 14 14M5 19 19 5', play: 'm7 4 13 8-13 8Z', pause: 'M8 5v14M16 5v14',
  grid: 'M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18', window: 'M4 4h16v16H4Z', minus: 'M4 12h16',
};
export function Icon({ name, style }: { name: IconName; style?: CSSProperties }) {
  return <svg className={`vm-icon vm-icon-${name}`} style={style} viewBox="0 0 24 24" width="24" height="24" fill={name === 'star' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]} /></svg>;
}
export function Arrow({ direction = 'diagonal' }: { direction?: 'diagonal' | 'down' | 'up' | 'left' | 'right' }) {
  const rotation = { diagonal: 0, right: 45, down: 135, left: 225, up: -45 }[direction];
  return <span className="icon-wrap" aria-hidden="true"><Icon name="arrow" style={{ transform: `rotate(${rotation}deg)` }} /></span>;
}
