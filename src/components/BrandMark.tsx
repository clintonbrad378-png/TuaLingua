export default function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/icon.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="brand-mark"
      draggable={false}
    />
  );
}
