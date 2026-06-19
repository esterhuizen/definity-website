// Refined mono-line ∞ — the institutional version of the brand mark (Definity /
// infinity / the loop). White by default; pass a className to recolour.
export function LogoMark({ className, strokeWidth = 2.4 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 60 30" className={className} role="img" aria-label="Definity">
      <path
        d="M30 15 C30 4 12 4 12 15 C12 26 30 26 30 15 C30 4 48 4 48 15 C48 26 30 26 30 15 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
    </svg>
  );
}
