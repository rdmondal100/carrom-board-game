import { cn } from '@/lib/utils';

// UI-4: small illustrative board drawings (SVG, 100 × 100 user units).
// These are pictures, not physics: positions are hand-placed for clarity.

export type DiagramVariant = 'logo' | 'shoot' | 'colour' | 'point' | 'queen' | 'lastCoin';

const C = {
  frame: '#5a2e14', surface: '#ecd5a4', line: '#3a2412', accent: '#1f6b45', pocket: '#0b0b0b',
  white: '#f2e7cf', black: '#2b2b2b', red: '#d3132f', striker: '#2f6fd6', arrow: '#b45309',
};
const COIN_R = 3;
const STRIKER_R = 4.2;
const POCKETS = [[13, 13], [87, 13], [13, 87], [87, 87]] as const;

function Board() {
  const base = (k: string, x1: number, y1: number, x2: number, y2: number) => (
    <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.line} strokeWidth={0.6} />
  );
  return (
    <g>
      <rect x={0} y={0} width={100} height={100} rx={4} fill={C.frame} />
      <rect x={7} y={7} width={86} height={86} fill={C.surface} />
      {POCKETS.map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={4.6} fill={C.pocket} />)}
      {[22, 78].map((v) => [
        base(`h${v}`, 26, v, 74, v), base(`v${v}`, v, 26, v, 74),
      ])}
      {[[26, 22], [74, 22], [26, 78], [74, 78], [22, 26], [22, 74], [78, 26], [78, 74]].map(([x, y]) => (
        <circle key={`e${x}${y}`} cx={x} cy={y} r={1.6} fill="none" stroke={C.accent} strokeWidth={0.6} />
      ))}
      <circle cx={50} cy={50} r={11} fill="none" stroke={C.accent} strokeWidth={0.7} />
    </g>
  );
}

function Coin({ x, y, kind, label }: { x: number; y: number; kind: 'white' | 'black' | 'red'; label?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={COIN_R} fill={C[kind]} stroke="#00000066" strokeWidth={0.4} />
      {label && (
        <text x={x} y={y - COIN_R - 1.2} textAnchor="middle" fontSize={4} fontWeight={700} fill={C.line}>{label}</text>
      )}
    </g>
  );
}

function Striker({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={STRIKER_R} fill={C.striker} stroke="#00000066" strokeWidth={0.4} />;
}

function Arrow({ d, dashed }: { d: string; dashed?: boolean }) {
  return (
    <path d={d} fill="none" stroke={C.arrow} strokeWidth={1} strokeDasharray={dashed ? '2 1.5' : undefined} markerEnd="url(#arrowhead)" />
  );
}

function Rack() {
  const ring = [[0, -6.2, 'white'], [5.4, -3.1, 'black'], [5.4, 3.1, 'white'], [0, 6.2, 'black'], [-5.4, 3.1, 'white'], [-5.4, -3.1, 'black']] as const;
  return (
    <g>
      {ring.map(([dx, dy, k]) => <Coin key={`${dx}${dy}`} x={50 + dx} y={50 + dy} kind={k} />)}
      <Coin x={50} y={50} kind="red" />
    </g>
  );
}

function Scene({ variant }: { variant: DiagramVariant }) {
  switch (variant) {
    case 'logo':
      return <><Rack /><Striker x={50} y={78} /></>;
    case 'shoot':
      return (
        <>
          <Arrow d="M50 74 L50 60" dashed />
          <Striker x={50} y={78} />
          <Coin x={50} y={50} kind="white" />
          <Arrow d="M47.5 47.5 L17 17" />
          <Arrow d="M40 78 L30 78" />
          <Arrow d="M60 78 L70 78" />
        </>
      );
    case 'colour':
      return (
        <>
          <Coin x={40} y={44} kind="white" /><Coin x={58} y={40} kind="white" /><Coin x={46} y={58} kind="white" />
          <Coin x={60} y={56} kind="black" /><Coin x={36} y={56} kind="black" /><Coin x={52} y={30} kind="black" />
          <Coin x={50} y={50} kind="red" />
          <Striker x={50} y={78} />
        </>
      );
    case 'point':
      return (
        <>
          <Coin x={36} y={50} kind="white" label="10" />
          <Coin x={64} y={50} kind="black" label="5" />
          <Coin x={50} y={50} kind="red" label="20" />
          <Striker x={50} y={78} />
        </>
      );
    case 'queen':
      return (
        <>
          <Coin x={50} y={50} kind="red" label="1" />
          <Arrow d="M52.5 47.5 L83 17" />
          <Coin x={66} y={60} kind="white" label="2" />
          <Arrow d="M68.5 57.5 L84 21" dashed />
          <Striker x={50} y={78} />
        </>
      );
    case 'lastCoin':
      return (
        <>
          <Coin x={50} y={50} kind="red" />
          <Coin x={30} y={34} kind="white" />
          <Arrow d="M28 32 L17 18" />
          <Arrow d="M15 15 Q 30 42 44 48" dashed />
          <Striker x={50} y={78} />
        </>
      );
  }
}

export function BoardDiagram({ variant, className }: { variant: DiagramVariant; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={cn('h-auto', className)}>
      <defs>
        <marker id="arrowhead" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={4} markerHeight={4} orient="auto-start-reverse">
          <path d="M0 0 L6 3 L0 6 z" fill={C.arrow} />
        </marker>
      </defs>
      <Board />
      <Scene variant={variant} />
    </svg>
  );
}
