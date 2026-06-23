export type TrackerAccentTheme = {
  fill: string;
  ring: string;
  stroke: string;
  btnIdle: string;
  btnHover: string;
  btnActive: string;
  segmentActive: string;
};

export const TRACKER_ACCENT_THEMES: Record<string, TrackerAccentTheme> = {
  'bg-brand-primary': {
    fill: 'from-brand-primary via-brand-primary/85 to-cyan-400/70',
    ring: 'ring-brand-primary/45',
    stroke: 'stroke-brand-primary',
    btnIdle: 'text-brand-primary/80',
    btnHover: 'hover:bg-brand-primary/12 hover:text-brand-primary',
    btnActive: 'active:bg-brand-primary/20',
    segmentActive: 'bg-brand-primary shadow-[0_0_8px_rgba(56,189,248,0.35)]',
  },
  'bg-amber-400': {
    fill: 'from-amber-400 via-amber-300/90 to-orange-300/70',
    ring: 'ring-amber-400/45',
    stroke: 'stroke-amber-400',
    btnIdle: 'text-amber-300/80',
    btnHover: 'hover:bg-amber-400/12 hover:text-amber-300',
    btnActive: 'active:bg-amber-400/20',
    segmentActive: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)]',
  },
  'bg-violet-400': {
    fill: 'from-violet-400 via-violet-300/90 to-fuchsia-400/70',
    ring: 'ring-violet-400/45',
    stroke: 'stroke-violet-400',
    btnIdle: 'text-violet-300/80',
    btnHover: 'hover:bg-violet-400/12 hover:text-violet-300',
    btnActive: 'active:bg-violet-400/20',
    segmentActive: 'bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.45)]',
  },
  'bg-sky-400': {
    fill: 'from-sky-400 via-sky-300/90 to-cyan-300/70',
    ring: 'ring-sky-400/45',
    stroke: 'stroke-sky-400',
    btnIdle: 'text-sky-300/80',
    btnHover: 'hover:bg-sky-400/12 hover:text-sky-300',
    btnActive: 'active:bg-sky-400/20',
    segmentActive: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.45)]',
  },
  'bg-emerald-400': {
    fill: 'from-emerald-400 via-emerald-300/90 to-teal-300/70',
    ring: 'ring-emerald-400/45',
    stroke: 'stroke-emerald-400',
    btnIdle: 'text-emerald-300/80',
    btnHover: 'hover:bg-emerald-400/12 hover:text-emerald-300',
    btnActive: 'active:bg-emerald-400/20',
    segmentActive: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)]',
  },
  'bg-orange-400': {
    fill: 'from-orange-400 via-orange-300/90 to-amber-300/70',
    ring: 'ring-orange-400/45',
    stroke: 'stroke-orange-400',
    btnIdle: 'text-orange-300/80',
    btnHover: 'hover:bg-orange-400/12 hover:text-orange-300',
    btnActive: 'active:bg-orange-400/20',
    segmentActive: 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.45)]',
  },
};

export function getTrackerAccentTheme(accentClass: string): TrackerAccentTheme {
  return TRACKER_ACCENT_THEMES[accentClass] ?? TRACKER_ACCENT_THEMES['bg-brand-primary'];
}
