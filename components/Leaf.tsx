// Light grey filled maple leaves: decoration only, hidden from screen readers.
const OUTLINE =
  'M51.5 97 L51.5 75 Q63 76.5 75 79 L72 68.5 L92 52.5 L86.5 49 L90.5 34 L77 37.5 L74.5 30 L62 43 L66 19.5 L58.5 23.5 L50 4 L41.5 23.5 L34 19.5 L38 43 L25.5 30 L23 37.5 L9.5 34 L13.5 49 L8 52.5 L28 68.5 L25 79 Q37 76.5 48.5 75 L48.5 97 Z';
const VEINS = 'M50 75 L50 30 M50 62 L72 48 M50 62 L28 48';

export function Leaf({ size = 14, rotate = 0, veins = false, className = '', style }: { size?: number; rotate?: number; veins?: boolean; className?: string; style?: React.CSSProperties }) {
  // Thin lines stay thin at any size.
  const stroke = Math.max(1.4, 100 / size);
  return (
    <svg className={`leaf ${className}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false" style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined, ...style }}>
      <path d={OUTLINE} fill="currentColor" stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round" />
      {veins && <path d={VEINS} fill="none" stroke="#fff" strokeWidth={stroke * 0.8} strokeLinecap="round" />}
    </svg>
  );
}

/** A small bunch of leaves for a corner of the header or footer. */
export function LeafCluster({ corner }: { corner: 'top-right' | 'bottom-left' | 'bottom-right' }) {
  return (
    <span className={`leaf-cluster ${corner}`} aria-hidden="true">
      <Leaf size={58} rotate={22} veins className="l1" />
      <Leaf size={32} rotate={-16} veins className="l2" />
      <Leaf size={22} rotate={55} className="l3" />
    </span>
  );
}

/** A hairline with a tiny leaf in the middle, between sections. */
export function LeafDivider() {
  return (
    <div className="leaf-divider" aria-hidden="true">
      <span />
      <Leaf size={18} />
      <span />
    </div>
  );
}

/** Tiny leaf used in place of a "·" between details. */
export function LeafDot() {
  return <Leaf size={10} className="leaf-dot" />;
}
