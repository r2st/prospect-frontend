import { cn } from '../lib/utils';
import { LogoMark } from './Logo';

// The sibling-product row every DoAide product's footer carries, in the same
// order as Pulse and Jobs, with Prospect added.
const DOAIDE_PRODUCTS = [
  { name: 'Desk', href: 'https://desk.doaide.com' },
  { name: 'Jobs', href: 'https://job.doaide.com' },
  { name: '409A', href: 'https://409a.doaide.com' },
  { name: 'GST', href: 'https://gst.doaide.com' },
  { name: 'Pulse', href: 'https://pulse.doaide.com' },
  { name: 'Prospect', href: 'https://prospect.doaide.com', current: true },
  { name: 'Med', href: 'https://med.doaide.com' },
  { name: 'Realty', href: 'https://realty.doaide.com' },
  { name: 'Reach', href: 'https://reach.doaide.com' },
  { name: 'Trade', href: 'https://trade.doaide.com' },
];

/** The "A DoAide Product" pill, linking home to doaide.com. */
export function DoAideBadge({ className }) {
  return (
    <a
      href="https://doaide.com"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-gray-500 transition-colors hover:border-indigo-200 hover:text-gray-700',
        className
      )}
    >
      <LogoMark size={14} title="" />
      A DoAide Product
    </a>
  );
}

/** The shared DoAide footer: sibling products, the badge, and the copyright. */
export function DoAideFooter({ className }) {
  return (
    <footer className={cn('text-center', className)} data-testid="doaide-footer">
      <nav aria-label="DoAide products" className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
        {DOAIDE_PRODUCTS.map((p) =>
          p.current ? (
            <span key={p.name} aria-current="page" className="font-medium text-indigo-600">{p.name}</span>
          ) : (
            <a key={p.name} href={p.href} className="text-gray-400 transition-colors hover:text-gray-700">
              {p.name}
            </a>
          )
        )}
      </nav>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        <DoAideBadge />
        <span className="text-[11px] text-gray-400">© {new Date().getFullYear()} DoAide</span>
      </div>
    </footer>
  );
}
