import Link from 'next/link';
import { cn } from '@/lib/utils';

export type TabItem = { key: string; label: string; badge?: number };

type Props = {
  items: TabItem[];
  active: string;
  /** Button-mode: called on click. */
  onSelect?: (key: string) => void;
  /** Link-mode: returns an href per tab (takes precedence over onSelect). */
  hrefFor?: (key: string) => string;
  className?: string;
  /** Equal-width tabs (used in modals); default is left-aligned scrollable. */
  fill?: boolean;
};

export function TabBar({ items, active, onSelect, hrefFor, className, fill }: Props) {
  return (
    <div className={cn('flex border-b border-gray-100 overflow-x-auto', fill ? '' : 'gap-5', className)}>
      {items.map((t) => {
        const isActive = t.key === active;
        const cls = cn(
          'text-sm py-2.5 font-medium transition-colors whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5',
          fill && 'flex-1 justify-center',
          isActive ? 'text-brand border-b-2 border-brand' : 'text-gray-400 hover:text-gray-600'
        );
        const inner = (
          <>
            {t.label}
            {t.badge != null && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">{t.badge}</span>
            )}
          </>
        );
        return hrefFor ? (
          <Link key={t.key} href={hrefFor(t.key)} className={cls}>{inner}</Link>
        ) : (
          <button key={t.key} type="button" onClick={() => onSelect?.(t.key)} className={cls}>{inner}</button>
        );
      })}
    </div>
  );
}
