import Link from 'next/link';
import { Logo } from './Logo';
import { MobileMenu } from './MobileMenu';

const NAV = [
  { label: 'Institutions', href: '/institutions' },
  { label: 'Mission', href: '/#mission' },
  { label: 'How it works', href: '/#how' },
  { label: 'Stake', href: '/#stake' },
  { label: 'Validators', href: '/validators' },
  { label: 'FAQ', href: '/faq' },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-ring bg-bg/80 backdrop-blur-md">
      <div className="container-narrow flex h-16 items-center justify-between">
        <Link href="/" aria-label="Definity home" className="-ml-1 rounded-md p-1 hover:opacity-90">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-8 text-sm text-ink-muted">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition hover:text-ink">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/#stake" className="btn-primary text-sm">
            Stake SOL
          </Link>
          <MobileMenu items={NAV} />
        </div>
      </div>
    </header>
  );
}
