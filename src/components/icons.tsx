import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const S = ({ size = 20, children, ...p }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);

export const IconFlame = (p: P) => <S {...p}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3 1.072-2.143 2.246-3.318 3-4 .5 2 2 4 3.5 6.5 1 1.667 1.5 3.167 1.5 4.5a7 7 0 1 1-14 0c0-1.5.5-3 1.5-4.5.5 1 1.5 2 3 3z"/></S>;
export const IconBolt = (p: P) => <S {...p}><path d="M13 2 4.5 13H11l-1 9 9.5-11H13z"/></S>;
export const IconBook = (p: P) => <S {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></S>;
export const IconCards = (p: P) => <S {...p}><rect x="7" y="7" width="12" height="14" rx="2"/><path d="M5 17V5a2 2 0 0 1 2-2h10"/></S>;
export const IconBrain = (p: P) => <S {...p}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.04-2.77 2.5 2.5 0 0 1 .34-4.27 2.5 2.5 0 0 1 1.16-4A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.04-2.77 2.5 2.5 0 0 0-.34-4.27 2.5 2.5 0 0 0-1.16-4A2.5 2.5 0 0 0 14.5 2z"/></S>;
export const IconChart = (p: P) => <S {...p}><path d="M3 3v18h18"/><path d="M7 16l4-5 4 4 5-7"/></S>;
export const IconSettings = (p: P) => <S {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .3 1.7 1.7 0 0 0-.82 1.46V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-.67-1.31 1.7 1.7 0 0 0-1-.3 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.3-1 1.7 1.7 0 0 0-1.46-.82H2.75a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.31-.67 1.7 1.7 0 0 0 .3-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.3 1.7 1.7 0 0 0 .82-1.46V2.75a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 .67 1.31 1.7 1.7 0 0 0 1 .3 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 .3 1 1.7 1.7 0 0 0 1.46.82h.09a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.31.67 1.7 1.7 0 0 0-.3 1z"/></S>;
export const IconVolume = (p: P) => <S {...p}><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></S>;
export const IconMute = (p: P) => <S {...p}><path d="M11 5 6 9H2v6h4l5 4z"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></S>;
export const IconCheck = (p: P) => <S {...p}><polyline points="20 6 9 17 4 12"/></S>;
export const IconX = (p: P) => <S {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></S>;
export const IconChevronLeft = (p: P) => <S {...p}><polyline points="15 18 9 12 15 6"/></S>;
export const IconChevronRight = (p: P) => <S {...p}><polyline points="9 18 15 12 9 6"/></S>;
export const IconPlus = (p: P) => <S {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></S>;
export const IconLock = (p: P) => <S {...p}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/></S>;
export const IconStar = (p: P & { filled?: boolean }) => {
  const { filled, ...rest } = p;
  return <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
};
export const IconTrophy = (p: P) => <S {...p}><path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></S>;
export const IconTarget = (p: P) => <S {...p}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></S>;
export const IconClock = (p: P) => <S {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></S>;
export const IconSearch = (p: P) => <S {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></S>;
export const IconMic = (p: P) => <S {...p}><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></S>;
export const IconAlert = (p: P) => <S {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></S>;
