import { Hero } from '@/components/Hero';
import { StatsRow } from '@/components/StatsRow';
import { MissionSection } from '@/components/MissionSection';
import { HowItWorks } from '@/components/HowItWorks';
import { StakeWidget } from '@/components/StakeWidget';
import { TrustSection } from '@/components/TrustSection';
import { RegionsBand } from '@/components/RegionsBand';
import { HomeFAQ } from '@/components/HomeFAQ';
import { FinalCTA } from '@/components/FinalCTA';

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsRow />
      <MissionSection />
      <HowItWorks />
      <StakeWidget />
      <TrustSection />
      <RegionsBand />
      <HomeFAQ />
      <FinalCTA />
    </>
  );
}
