type Mood = "idle" | "happy" | "sad" | "wow";

export default function Mascot({
  mood = "idle",
  size = 96,
}: {
  mood?: Mood;
  size?: number;
}) {
  const eye = mood === "happy" ? "happy" : mood === "sad" ? "sad" : "open";
  return (
    <svg
      className={`mascot mascot-${mood}`}
      width={size}
      height={size}
      viewBox="0 0 200 200"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="mg-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9B7BFF" />
          <stop offset="100%" stopColor="#6B46E8" />
        </linearGradient>
        <linearGradient id="mg-beak" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFA95C" />
          <stop offset="100%" stopColor="#FF7A2F" />
        </linearGradient>
      </defs>

      <g className="mascot-bob">
        <circle cx="100" cy="150" r="34" fill="url(#mg-body)" opacity="0.28" />
        <path
          d="M62 118 Q58 70 100 62 Q142 70 138 118 Q138 152 100 154 Q62 152 62 118 Z"
          fill="url(#mg-body)"
        />
        <circle cx="100" cy="96" r="46" fill="#FFFDF7" />
        <circle cx="100" cy="96" r="46" fill="none" stroke="#EDE9FF" strokeWidth="2" />

        <path d="M56 44 Q64 26 84 32 Q78 44 70 46 Z" fill="url(#mg-body)" />
        <path d="M100 36 Q112 18 130 28 Q120 40 108 40 Z" fill="url(#mg-body)" />
        <path d="M138 50 Q152 38 164 50 Q152 60 142 58 Z" fill="url(#mg-body)" />

        {eye === "open" && (
          <g>
            <circle className="mascot-eye" cx="82" cy="94" r="9.5" fill="#231F3F" />
            <circle className="mascot-eye" cx="118" cy="94" r="9.5" fill="#231F3F" />
            <circle cx="85" cy="91" r="3.2" fill="#fff" />
            <circle cx="121" cy="91" r="3.2" fill="#fff" />
          </g>
        )}
        {eye === "happy" && (
          <g stroke="#231F3F" strokeWidth="5" strokeLinecap="round" fill="none">
            <path d="M74 96 Q82 86 90 96" />
            <path d="M110 96 Q118 86 126 96" />
          </g>
        )}
        {eye === "sad" && (
          <g>
            <circle cx="82" cy="97" r="8.5" fill="#231F3F" />
            <circle cx="118" cy="97" r="8.5" fill="#231F3F" />
            <circle cx="84.5" cy="94" r="2.8" fill="#fff" />
            <circle cx="120.5" cy="94" r="2.8" fill="#fff" />
            <path d="M72 82 L92 88" stroke="#231F3F" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M128 82 L108 88" stroke="#231F3F" strokeWidth="4.5" strokeLinecap="round" />
          </g>
        )}

        <path d="M96 100 Q130 92 170 108 Q130 130 96 114 Z" fill="url(#mg-beak)" />
        <path d="M96 108 Q126 112 152 114 Q126 122 98 114 Z" fill="#FFB988" opacity="0.85" />

        <circle cx="70" cy="116" r="7" fill="#FFB8C6" opacity="0.85" />
        <circle cx="132" cy="116" r="7" fill="#FFB8C6" opacity="0.85" />

        {mood === "happy" && (
          <path
            d="M92 124 Q100 132 108 124"
            stroke="#231F3F"
            strokeWidth="3.4"
            strokeLinecap="round"
            fill="none"
          />
        )}
        {mood === "wow" && (
          <ellipse cx="100" cy="127" rx="7" ry="9" fill="#231F3F" />
        )}
        {mood === "sad" && (
          <path
            d="M94 130 Q100 124 106 130"
            stroke="#231F3F"
            strokeWidth="3.4"
            strokeLinecap="round"
            fill="none"
          />
        )}
      </g>
    </svg>
  );
}
