import { Hero } from '@/components/Hero';
import { StatsRow } from '@/components/StatsRow';
import { ValidatorMap } from '@/components/ValidatorMap';

// Regenerate the homepage every 30 minutes so the live on-chain stats
// (validators, total staked) stay current. The hourly stats job writes
// public/stats.json; this ISR window picks it up between refreshes.
export const revalidate = 1800;
import { MissionSection } from '@/components/MissionSection';
import { HowItWorks } from '@/components/HowItWorks';
import { TrustSection } from '@/components/TrustSection';
import { RegionsBand } from '@/components/RegionsBand';
import { HomeFAQ } from '@/components/HomeFAQ';
import { FinalCTA } from '@/components/FinalCTA';

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsRow />
      <ValidatorMap />
      <MissionSection />
      <HowItWorks />
      <TrustSection />
      <RegionsBand />
      <HomeFAQ />
      <FinalCTA />
    </>
  );
}
