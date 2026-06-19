import { HeroD } from '@/components/HeroD';

// PHASE 1 preview — the redesigned hero (Concept D) in the real app, wired to the live
// GDI rank + base APY. The rest of the page (loop, trust, validator map, institutional CTA,
// footer) rolls out section by section in later phases.
export const revalidate = 1800;

export default function HomePage() {
  return <HeroD />;
}
