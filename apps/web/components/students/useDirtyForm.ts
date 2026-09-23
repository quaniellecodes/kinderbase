'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return a === b;
}

/**
 * Batched dirty-form state for inline (PencilField) editing.
 *
 * Compares each field against a baseline; `save()` sends only the changed
 * fields to `onSave`, then advances the baseline and refreshes the route so the
 * server data re-renders. Installs a `beforeunload` guard while anything is
 * dirty. `initial` is snapshotted once (further prop changes are ignored — the
 * post-save `router.refresh()` re-mounts callers that pass a keyed baseline).
 */
export function useDirtyForm<T extends Record<string, unknown>>(
  initial: T,
  onSave: (patch: Partial<T>) => Promise<void>,
) {
  const router = useRouter();
  const [base, setBase] = useState<T>(initial);
  const [values, setValues] = useState<T>(initial);
  const [saving, setSaving] = useState(false);

  const dirtyKeys = useMemo(
    () => (Object.keys(values) as (keyof T)[]).filter((k) => !valuesEqual(values[k], base[k])),
    [values, base],
  );
  const count = dirtyKeys.length;

  const setValue = useCallback((key: keyof T, v: unknown) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  }, []);

  const isDirty = useCallback((key: keyof T) => dirtyKeys.includes(key), [dirtyKeys]);

  const discard = useCallback(() => setValues(base), [base]);

  const save = useCallback(async () => {
    if (count === 0 || saving) return;
    setSaving(true);
    try {
      const patch = Object.fromEntries(dirtyKeys.map((k) => [k, values[k]])) as Partial<T>;
      await onSave(patch);
      setBase(values); // advance baseline → dirty clears
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [count, saving, dirtyKeys, values, onSave, router]);

  useEffect(() => {
    if (count === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [count]);

  return { values, setValue, isDirty, count, saving, discard, save };
}
