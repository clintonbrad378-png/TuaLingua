export default function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="brand-mark"
    >
      <defs>
        <linearGradient id="bm-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2A3158" />
          <stop offset="100%" stopColor="#14182B" />
        </linearGradient>
        <clipPath id="bm-clip">
          <circle cx="32" cy="29" r="14" />
        </clipPath>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="18" fill="url(#bm-bg)" />
      <g clipPath="url(#bm-clip)">
        <rect x="18" y="15" width="28" height="9.5" fill="#3A86FF" />
        <rect x="18" y="24.5" width="28" height="4.5" fill="#F5F7FF" />
        <rect x="18" y="29" width="28" height="4.5" fill="#43C996" />
        <rect x="18" y="33.5" width="28" height="9.5" fill="#FFC43D" />
      </g>
      <circle cx="32" cy="29" r="14" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.8" />
      <path d="M32 15C28 19 25.5 24 25.5 29s2.5 10 6.5 14M32 15c4 4 6.5 9 6.5 14S36 39 32 43M18 29h28" stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" fill="none" />
      <path d="M23 40l-2 6 7-4" fill="#F5F7FF" opacity="0.95" />
      <circle cx="28.5" cy="29.2" r="1.5" fill="#14182B" />
      <circle cx="32" cy="29.2" r="1.5" fill="#14182B" />
      <circle cx="35.5" cy="29.2" r="1.5" fill="#14182B" />
      <rect x="4.5" y="4.5" width="55" height="55" rx="17.5" fill="none" stroke="rgba(255,255,255,0.12)" />
    </svg>
  );
}
