import Link from 'next/link';
import { LogoMark } from './LogoMark';

// Shared Concept-D nav for the migrated (dark) route group. Sticky + translucent so it
// reads over the hero canvas and over content as you scroll. Links are real destinations
// (legacy pages still resolve at the same URLs during the rollout).
const NAV = [
  { label: 'Stake', href: '/stake' },
  { label: 'Institutions', href: '/institutions' },
  { label: 'Validators', href: '/validators' },
  { label: 'Verify', href: '/addresses' },
  { label: 'FAQ', href: '/faq' },
];

export function NavD() {
  return (
    <header className="nav-d">
      <div className="wrap">
        <nav>
          <Link className="brand" href="/" aria-label="Definity home">
            <LogoMark className="logo" /> DEFINITY
          </Link>
          <div className="navlinks">
            {NAV.map((l) => (
              <Link key={l.href} href={l.href}>{l.label}</Link>
            ))}
          </div>
          <a className="navcta" href="https://incentive.definity.finance" target="_blank" rel="noreferrer">
            <span className="live" /> Live data
          </a>
        </nav>
      </div>
    </header>
  );
}
