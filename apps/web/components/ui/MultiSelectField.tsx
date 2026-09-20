'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Badge } from './Badge';
import { Input } from './Field';
import { cn } from '@/lib/utils';

type Props = {
  value: string[];
  options: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  allowAdd?: boolean;
  className?: string;
};

/** Searchable chip multi-select with inline "+ Add" for values not in the list. */
export function MultiSelectField({ value, options, onChange, placeholder = 'Search…', allowAdd = true, className }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const available = options.filter((o) => !value.includes(o) && o.toLowerCase().includes(q));
  const canAdd = allowAdd && q.length > 0 && !options.some((o) => o.toLowerCase() === q) && !value.some((v) => v.toLowerCase() === q);

  function add(v: string) {
    if (!value.includes(v)) onChange([...value, v]);
    setQuery('');
  }

  return (
    <div className={cn('space-y-2', className)}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <Badge key={v} tone="blue" className="gap-1">
              {v}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="text-blue-400 hover:text-blue-700">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
      {(available.length > 0 || canAdd) && (
        <div className="flex flex-wrap gap-1.5">
          {available.slice(0, 12).map((o) => (
            <button key={o} type="button" onClick={() => add(o)} className="text-xs px-2 py-0.5 rounded-chip bg-gray-100 text-gray-600 hover:bg-gray-200">
              {o}
            </button>
          ))}
          {canAdd && (
            <button type="button" onClick={() => add(query.trim())} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-chip border border-dashed border-gray-300 text-gray-500 hover:border-gray-400">
              <Plus className="w-3 h-3" /> Add &ldquo;{query.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
