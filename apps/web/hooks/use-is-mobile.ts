'use client';

import { useEffect, useState } from 'react';
import { isNative } from '@/lib/mobile/capacitor';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(isNative);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches || isNative);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches || isNative);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
