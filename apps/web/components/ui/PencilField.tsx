'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Input, Textarea, Select } from './Field';
import { MultiSelectField } from './MultiSelectField';
import { Badge } from './Badge';
import { cn } from '@/lib/utils';

type FieldType = 'text' | 'textarea' | 'date' | 'select' | 'boolean' | 'multiselect';

type Props = {
  label: string;
  value: string | string[] | boolean | null;
  onChange: (v: string | string[] | boolean) => void;
  type?: FieldType;
  options?: { value: string; label: string }[];
  multiOptions?: string[];
  editable?: boolean;
  dirty?: boolean;
  placeholder?: string;
  className?: string;
};

/**
 * Inline click-to-edit field. Controlled: the parent owns `value` and gets
 * `onChange`; dirty styling is driven by the parent's `dirty` flag. Read mode
 * shows the value with a pencil affordance; clicking swaps in the right control.
 * Booleans and multiselects edit in place (no read/edit toggle).
 */
export function PencilField({
  label,
  value,
  onChange,
  type = 'text',
  options,
  multiOptions,
  editable = true,
  dirty = false,
  placeholder = '—',
  className,
}: Props) {
  const [editing, setEditing] = useState(false);

  const labelRow = (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
      {dirty && <span className="w-1.5 h-1.5 rounded-full bg-status-amber" title="Unsaved change" />}
    </div>
  );

  // Boolean: always-on toggle.
  if (type === 'boolean') {
    const on = value === true;
    return (
      <div className={cn('py-2', className)}>
        {labelRow}
        <button
          type="button"
          disabled={!editable}
          onClick={() => onChange(!on)}
          className={cn(
            'mt-1 relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50',
            on ? 'bg-brand' : 'bg-gray-200',
          )}
          role="switch"
          aria-checked={on}
        >
          <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', on ? 'translate-x-4' : 'translate-x-0.5')} />
        </button>
      </div>
    );
  }

  // Multiselect: chips in read mode, MultiSelectField when editing.
  if (type === 'multiselect') {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div className={cn('py-2', className)}>
        {labelRow}
        {editable && editing ? (
          <div className="mt-1.5">
            <MultiSelectField value={arr} options={multiOptions ?? []} onChange={(next) => onChange(next)} />
            <button type="button" onClick={() => setEditing(false)} className="mt-1 text-xs text-brand font-medium">
              Done
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!editable}
            onClick={() => setEditing(true)}
            className="mt-1 flex items-center gap-1.5 flex-wrap text-left group disabled:cursor-default"
          >
            {arr.length > 0 ? (
              arr.map((v) => (
                <Badge key={v} tone="neutral" size="sm">
                  {v}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-gray-300">{placeholder}</span>
            )}
            {editable && <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100" />}
          </button>
        )}
      </div>
    );
  }

  const strValue = typeof value === 'string' ? value : '';
  const displayText =
    type === 'select' ? options?.find((o) => o.value === strValue)?.label ?? '' : strValue;

  return (
    <div className={cn('py-2', className)}>
      {labelRow}
      {editable && editing ? (
        <div className="mt-1 flex items-start gap-2">
          {type === 'textarea' ? (
            <Textarea
              autoFocus
              value={strValue}
              rows={3}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setEditing(false)}
            />
          ) : type === 'select' ? (
            <Select
              autoFocus
              value={strValue}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setEditing(false)}
            >
              {options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              autoFocus
              type={type === 'date' ? 'date' : 'text'}
              value={strValue}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setEditing(false);
                if (e.key === 'Escape') setEditing(false);
              }}
            />
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={!editable}
          onClick={() => setEditing(true)}
          className="mt-0.5 flex items-center gap-1.5 text-left w-full group disabled:cursor-default"
        >
          <span className={cn('text-sm', displayText ? 'text-gray-900' : 'text-gray-300')}>
            {displayText || placeholder}
          </span>
          {editable && <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 flex-shrink-0" />}
        </button>
      )}
    </div>
  );
}
