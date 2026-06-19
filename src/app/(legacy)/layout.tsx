import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';

// (legacy) route group — pages not yet migrated to Concept D keep their original light
// theme and chrome, so nothing is broken mid-rollout. Migrate a page by moving its folder
// into (dark) and reskinning it.
export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}
