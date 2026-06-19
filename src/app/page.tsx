import { HeroD } from '@/components/HeroD';
import { HomeSections } from '@/components/HomeSections';

// Redesigned homepage (Concept D): hero + the loop, proof, decentralisation, institutional
// CTA, and footer. ISR every 30 min keeps the live GDI / APY current.
export const revalidate = 1800;

export default function HomePage() {
  return (
    <>
      <HeroD />
      <HomeSections />
    </>
  );
}
