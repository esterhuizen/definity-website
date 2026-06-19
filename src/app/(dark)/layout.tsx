import { NavD } from '@/components/NavD';
import { FooterD } from '@/components/FooterD';

// (dark) route group — the migrated Concept-D experience. The .dfy-root wrapper paints the
// scoped dark "Definity blue" canvas (so the not-yet-migrated light pages are unaffected)
// and provides the shared nav + footer.
export default function DarkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dfy dfy-root">
      <div className="dfy-canvas" aria-hidden="true" />
      <NavD />
      {children}
      <FooterD />
    </div>
  );
}
