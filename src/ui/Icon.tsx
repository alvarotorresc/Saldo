import type { ReactNode, SVGProps } from 'react';

// Icon set for Saldo v0.2 "Terminal / Technical" direction.
// The ~40 handoff icons live at viewBox 20x20 stroke 1.5; legacy icons inherited
// from v0.1 live at viewBox 24x24 stroke 1.8. We keep both name sets so existing
// pages still compile and new screens can use the canonical handoff names.

export type IconName =
  // ── handoff v0.2 set (viewBox 20, stroke 1.5) ──
  | 'home'
  | 'list'
  | 'chart'
  | 'grid'
  | 'settings'
  | 'plus'
  | 'minus'
  | 'search'
  | 'filter'
  | 'sort'
  | 'lock'
  | 'unlock'
  | 'shield'
  | 'wifi-off'
  | 'eye'
  | 'eye-off'
  | 'arrow-up'
  | 'arrow-down'
  | 'arrow-r'
  | 'arrow-l'
  | 'chev-l'
  | 'chev-r'
  | 'chev-d'
  | 'chev-u'
  | 'target'
  | 'wallet'
  | 'bank'
  | 'card'
  | 'download'
  | 'upload'
  | 'refresh'
  | 'check'
  | 'x'
  | 'calendar'
  | 'tag'
  | 'dot'
  | 'dots'
  | 'dots-v'
  | 'repeat'
  | 'alert'
  | 'bell'
  | 'user'
  | 'users'
  | 'finger'
  | 'face-id'
  | 'key'
  | 'file'
  | 'trash'
  | 'edit'
  | 'copy'
  | 'link'
  | 'send'
  | 'swap'
  | 'pie'
  | 'bars'
  | 'line'
  | 'flow'
  | 'zap'
  | 'info'
  | 'cpu'
  // ── legacy v0.1 aliases / icons (viewBox 24, stroke 1.8) ──
  | 'import'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'trending-up'
  | 'trending-down'
  | 'split'
  | 'folder'
  | 'utensils'
  | 'bus'
  | 'heart'
  | 'star'
  | 'bag'
  | 'briefcase'
  | 'cart'
  | 'arrow'
  | 'arrow-right';

interface IconDef {
  viewBox: string;
  stroke: number;
  paths: ReactNode;
}

const ICONS: Record<IconName, IconDef> = {
  // ── handoff set (20x20, stroke 1.5) ─────────────────────────
  home: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: <path d="M3 9l7-5 7 5v7a1 1 0 0 1-1 1h-3v-5H7v5H4a1 1 0 0 1-1-1z" />,
  },
  list: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <path d="M6 5h11M6 10h11M6 15h11" />
        <circle cx="3" cy="5" r=".8" />
        <circle cx="3" cy="10" r=".8" />
        <circle cx="3" cy="15" r=".8" />
      </>
    ),
  },
  chart: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: <path d="M3 17V8M8 17V4M13 17v-6M18 17H2" />,
  },
  grid: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <rect x="3" y="3" width="6" height="6" rx="1" />
        <rect x="11" y="3" width="6" height="6" rx="1" />
        <rect x="3" y="11" width="6" height="6" rx="1" />
        <rect x="11" y="11" width="6" height="6" rx="1" />
      </>
    ),
  },
  settings: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <circle cx="10" cy="10" r="2.5" />
        <path d="M10 2v2M10 16v2M4 10H2M18 10h-2M5 5 3.5 3.5M16.5 16.5 15 15M5 15l-1.5 1.5M16.5 3.5 15 5" />
      </>
    ),
  },
  plus: { viewBox: '0 0 20 20', stroke: 1.5, paths: <path d="M10 4v12M4 10h12" /> },
  minus: { viewBox: '0 0 20 20', stroke: 1.5, paths: <path d="M4 10h12" /> },
  search: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <circle cx="9" cy="9" r="5" />
        <path d="m17 17-4.5-4.5" />
      </>
    ),
  },
  filter: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: <path d="M3 5h14M6 10h8M8 15h4" />,
  },
  sort: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: <path d="M6 4v12M3 13l3 3 3-3M14 16V4M11 7l3-3 3 3" />,
  },
  lock: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <rect x="4" y="9" width="12" height="9" rx="1.5" />
        <path d="M7 9V6a3 3 0 0 1 6 0v3" />
      </>
    ),
  },
  unlock: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <rect x="4" y="9" width="12" height="9" rx="1.5" />
        <path d="M7 9V6a3 3 0 0 1 6 0" />
      </>
    ),
  },
  shield: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <path d="M10 2 4 4v6c0 4 3 7 6 8 3-1 6-4 6-8V4z" />
        <path d="m7.5 10 1.8 1.8L13 8" />
      </>
    ),
  },
  'wifi-off': {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <path d="M2 6a14 14 0 0 1 16 0M5 10a9 9 0 0 1 10 0M8 14a4 4 0 0 1 4 0M10 17.5v.01" />
        <path d="m2 2 16 16" />
      </>
    ),
  },
  eye: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" />
        <circle cx="10" cy="10" r="2.5" />
      </>
    ),
  },
  'eye-off': {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <path d="M3 3l14 14M8 5a8 8 0 0 1 10 5 13 13 0 0 1-2 2.5M12.5 14a8 8 0 0 1-10.5-4A13 13 0 0 1 5 6" />
    ),
  },
  'arrow-up': { viewBox: '0 0 20 20', stroke: 1.5, paths: <path d="M10 17V3M5 8l5-5 5 5" /> },
  'arrow-down': {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: <path d="M10 3v14M5 12l5 5 5-5" />,
  },
  'arrow-r': { viewBox: '0 0 20 20', stroke: 1.5, paths: <path d="M4 10h12M11 5l5 5-5 5" /> },
  'arrow-l': { viewBox: '0 0 20 20', stroke: 1.5, paths: <path d="M16 10H4M9 5l-5 5 5 5" /> },
  'chev-l': { viewBox: '0 0 20 20', stroke: 1.5, paths: <path d="m12 15-5-5 5-5" /> },
  'chev-r': { viewBox: '0 0 20 20', stroke: 1.5, paths: <path d="m8 5 5 5-5 5" /> },
  'chev-d': { viewBox: '0 0 20 20', stroke: 1.5, paths: <path d="m5 8 5 5 5-5" /> },
  'chev-u': { viewBox: '0 0 20 20', stroke: 1.5, paths: <path d="m5 12 5-5 5 5" /> },
  target: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <circle cx="10" cy="10" r="7" />
        <circle cx="10" cy="10" r="4" />
        <circle cx="10" cy="10" r="1" />
      </>
    ),
  },
  wallet: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <rect x="2" y="5" width="16" height="12" rx="1.5" />
        <path d="M2 9h16" />
        <circle cx="14" cy="13" r="1" />
      </>
    ),
  },
  bank: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: <path d="M3 8l7-4 7 4M4 8v8M16 8v8M8 8v8M12 8v8M3 17h14" />,
  },
  card: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <rect x="2" y="5" width="16" height="11" rx="1.5" />
        <path d="M2 9h16M5 13h3" />
      </>
    ),
  },
  download: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: <path d="M10 3v10M5 9l5 5 5-5M4 17h12" />,
  },
  upload: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: <path d="M10 15V5M5 9l5-5 5 5M4 17h12" />,
  },
  refresh: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <path d="M4 10a6 6 0 0 1 11-3.5M16 10a6 6 0 0 1-11 3.5" />
        <path d="M15 3v3.5h-3.5M5 17v-3.5h3.5" />
      </>
    ),
  },
  check: { viewBox: '0 0 20 20', stroke: 1.5, paths: <path d="m4 10 4 4 8-9" /> },
  x: { viewBox: '0 0 20 20', stroke: 1.5, paths: <path d="M5 5l10 10M15 5 5 15" /> },
  calendar: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <rect x="3" y="4" width="14" height="14" rx="1.5" />
        <path d="M3 8h14M7 2v4M13 2v4" />
      </>
    ),
  },
  tag: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <path d="M3 11V4a1 1 0 0 1 1-1h7l6 6-7 7z" />
        <circle cx="7" cy="7" r="1" />
      </>
    ),
  },
  dot: { viewBox: '0 0 20 20', stroke: 1.5, paths: <circle cx="10" cy="10" r="2" /> },
  dots: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <circle cx="5" cy="10" r="1" />
        <circle cx="10" cy="10" r="1" />
        <circle cx="15" cy="10" r="1" />
      </>
    ),
  },
  'dots-v': {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <circle cx="10" cy="5" r="1" />
        <circle cx="10" cy="10" r="1" />
        <circle cx="10" cy="15" r="1" />
      </>
    ),
  },
  repeat: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <path d="m15 3 2 2-2 2" />
        <path d="M3 10V8a2 2 0 0 1 2-2h12" />
        <path d="m5 17-2-2 2-2" />
        <path d="M17 10v2a2 2 0 0 1-2 2H3" />
      </>
    ),
  },
  alert: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <path d="M10 7v4M10 14v.01" />
        <path d="M2 16 10 3l8 13z" />
      </>
    ),
  },
  bell: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <path d="M4 15h12l-1.5-3V9a4.5 4.5 0 0 0-9 0v3z" />
        <path d="M8 17a2 2 0 0 0 4 0" />
      </>
    ),
  },
  user: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <circle cx="10" cy="7" r="3" />
        <path d="M3 17a7 7 0 0 1 14 0" />
      </>
    ),
  },
  users: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <circle cx="8" cy="7" r="3" />
        <path d="M1 17a7 7 0 0 1 14 0M14 5a3 3 0 0 1 0 6M19 17a6 6 0 0 0-4-5.7" />
      </>
    ),
  },
  finger: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <path d="M8 18v-3M12 18v-3M14 15a4 4 0 0 0-8 0M10 12V5a3 3 0 0 1 6 0v2M10 5a3 3 0 0 0-6 0v7" />
    ),
  },
  'face-id': {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <path d="M3 6V4a1 1 0 0 1 1-1h2M14 3h2a1 1 0 0 1 1 1v2M3 14v2a1 1 0 0 0 1 1h2M14 17h2a1 1 0 0 0 1-1v-2" />
        <path d="M7 8v1M13 8v1M10 7v4M7 13a4 4 0 0 0 6 0" />
      </>
    ),
  },
  key: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <circle cx="7" cy="13" r="3" />
        <path d="m9 11 8-8M14 6l2 2M12 8l2 2" />
      </>
    ),
  },
  file: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <path d="M5 2h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
        <path d="M12 2v4h4" />
      </>
    ),
  },
  trash: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: <path d="M3 5h14M8 5V3h4v2M5 5l1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12M9 9v6M11 9v6" />,
  },
  edit: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <path d="M14 3l3 3-9 9H5v-3z" />
        <path d="M13 4l3 3" />
      </>
    ),
  },
  copy: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <rect x="7" y="7" width="11" height="11" rx="1" />
        <path d="M3 13V3a1 1 0 0 1 1-1h10" />
      </>
    ),
  },
  link: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <path d="M8 11a3 3 0 0 0 4.2.2L15 8.4A3 3 0 0 0 10.8 4L10 4.8" />
        <path d="M12 9a3 3 0 0 0-4.2-.2L5 11.6A3 3 0 0 0 9.2 16l.8-.8" />
      </>
    ),
  },
  send: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: <path d="M17 3 9 11M17 3l-5 14-3-6-6-3z" />,
  },
  swap: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: <path d="M4 7h12M12 3l4 4-4 4M16 13H4M8 17l-4-4 4-4" />,
  },
  pie: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <path d="M10 3a7 7 0 1 0 7 7h-7z" />
        <path d="M13 3a7 7 0 0 1 4 4h-4z" />
      </>
    ),
  },
  bars: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: <path d="M5 17V9M10 17V5M15 17v-6" />,
  },
  line: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: <path d="M3 15l4-6 4 3 6-8" />,
  },
  flow: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <circle cx="4" cy="5" r="1.5" />
        <circle cx="16" cy="5" r="1.5" />
        <circle cx="4" cy="15" r="1.5" />
        <circle cx="16" cy="15" r="1.5" />
        <path d="M4 6.5v7M16 6.5v7M5.5 5h9M5.5 15h9" />
      </>
    ),
  },
  zap: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: <path d="M11 2 3 12h6l-1 6 8-10h-6z" />,
  },
  info: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <circle cx="10" cy="10" r="7" />
        <path d="M10 9v5M10 7v.01" />
      </>
    ),
  },
  cpu: {
    viewBox: '0 0 20 20',
    stroke: 1.5,
    paths: (
      <>
        <rect x="5" y="5" width="10" height="10" rx="1" />
        <rect x="8" y="8" width="4" height="4" />
        <path d="M5 8H3M5 12H3M17 8h-2M17 12h-2M8 5V3M12 5V3M8 17v-2M12 17v-2" />
      </>
    ),
  },
  // ── legacy v0.1 set (24x24, stroke 1.8) ───────────────────
  import: {
    viewBox: '0 0 24 24',
    stroke: 1.8,
    paths: (
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 20h14" />
      </>
    ),
  },
  'chevron-left': { viewBox: '0 0 24 24', stroke: 1.8, paths: <path d="m15 18-6-6 6-6" /> },
  'chevron-right': { viewBox: '0 0 24 24', stroke: 1.8, paths: <path d="m9 18 6-6-6-6" /> },
  'chevron-down': { viewBox: '0 0 24 24', stroke: 1.8, paths: <path d="m6 9 6 6 6-6" /> },
  'trending-up': {
    viewBox: '0 0 24 24',
    stroke: 1.8,
    paths: (
      <>
        <path d="m3 17 6-6 4 4 8-8" />
        <path d="M14 7h7v7" />
      </>
    ),
  },
  'trending-down': {
    viewBox: '0 0 24 24',
    stroke: 1.8,
    paths: (
      <>
        <path d="m3 7 6 6 4-4 8 8" />
        <path d="M14 17h7v-7" />
      </>
    ),
  },
  split: {
    viewBox: '0 0 24 24',
    stroke: 1.8,
    paths: (
      <>
        <path d="M4 19h6l10-14h-6z" />
        <path d="M20 19h-6" />
      </>
    ),
  },
  folder: {
    viewBox: '0 0 24 24',
    stroke: 1.8,
    paths: <path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  },
  utensils: {
    viewBox: '0 0 24 24',
    stroke: 1.8,
    paths: (
      <>
        <path d="M7 3v8a2 2 0 0 0 2 2v8" />
        <path d="M5 3v6" />
        <path d="M9 3v6" />
        <path d="M17 3c-1.5 1.5-2 3.5-2 5 0 2 1 3 2 3v10" />
      </>
    ),
  },
  bus: {
    viewBox: '0 0 24 24',
    stroke: 1.8,
    paths: (
      <>
        <rect x="4" y="4" width="16" height="13" rx="2" />
        <path d="M4 11h16" />
        <circle cx="8" cy="19" r="1.5" />
        <circle cx="16" cy="19" r="1.5" />
        <path d="M8 4v3" />
        <path d="M16 4v3" />
      </>
    ),
  },
  heart: {
    viewBox: '0 0 24 24',
    stroke: 1.8,
    paths: (
      <path d="M12 20s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 5c-2.5 4.5-9.5 9-9.5 9z" />
    ),
  },
  star: {
    viewBox: '0 0 24 24',
    stroke: 1.8,
    paths: (
      <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" />
    ),
  },
  bag: {
    viewBox: '0 0 24 24',
    stroke: 1.8,
    paths: (
      <>
        <path d="M5 8h14l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </>
    ),
  },
  briefcase: {
    viewBox: '0 0 24 24',
    stroke: 1.8,
    paths: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        <path d="M3 13h18" />
      </>
    ),
  },
  cart: {
    viewBox: '0 0 24 24',
    stroke: 1.8,
    paths: (
      <>
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="17" cy="20" r="1.4" />
        <path d="M3 4h2l2.5 11h11L21 7H7" />
      </>
    ),
  },
  arrow: {
    viewBox: '0 0 24 24',
    stroke: 1.8,
    paths: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
  },
  'arrow-right': {
    viewBox: '0 0 24 24',
    stroke: 1.8,
    paths: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
  },
};

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name' | 'stroke' | 'width' | 'height'> {
  name: IconName;
  size?: number;
  stroke?: number;
}

export function Icon({ name, size = 20, stroke, className = '', ...rest }: Props) {
  const def = ICONS[name];
  return (
    <svg
      {...rest}
      width={size}
      height={size}
      viewBox={def.viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke ?? def.stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {def.paths}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(ICONS) as readonly IconName[];
