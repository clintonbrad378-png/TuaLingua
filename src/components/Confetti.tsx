const COLORS = ["#7C5CFF", "#00B8A9", "#FF8A3D", "#3D8BFF", "#FFC53D", "#FF5A6E"];

export default function Confetti({ pieces = 28 }: { pieces?: number }) {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: pieces }).map((_, i) => {
        const left = (i * 37) % 100;
        const delay = ((i * 13) % 10) / 10;
        const dur = 2.4 + (((i * 7) % 10) / 10) * 1.6;
        const size = 7 + ((i * 5) % 9);
        return (
          <span
            key={i}
            style={{
              left: `${left}%`,
              animationDelay: `${delay}s`,
              animationDuration: `${dur}s`,
              width: size,
              height: size * (i % 2 === 0 ? 1 : 0.45),
              background: COLORS[i % COLORS.length],
            }}
          />
        );
      })}
    </div>
  );
}
