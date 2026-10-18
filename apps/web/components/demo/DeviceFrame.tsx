'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The demo device frame (docs/sessions/10-DEMO-PHONE-POLISH.md §1). One component
 * taking a `src`, shared by the sandbox and any future screenshots.
 *
 * The phone is the prototype's exact geometry — 390×830 usable, 10px bezel, outer
 * corner 34px, inner 26px, and crucially NO drawn notch: 390 is the width every
 * screen was laid out against, and a notch would overlap the app header. On a short
 * window we SCALE the whole phone (transform-origin: top center) rather than shrink
 * the screen box, so the 390-wide layout never reflows. The app inside owns its
 * scroll; the screen box clips.
 */
export type DeviceSpec = { w: number; h: number; radius: number; bezel: number };

export function DeviceFrame({ src, device, title = 'KinderBase' }: { src: string; device: DeviceSpec; title?: string }) {
  const outerW = device.w + device.bezel * 2;
  const outerH = device.h + device.bezel * 2;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const recompute = () => {
      const availW = el.clientWidth;
      const top = el.getBoundingClientRect().top;
      const availH = window.innerHeight - top - 16;
      const s = Math.min(1, availW / outerW, availH / outerH);
      setScale(s > 0 && Number.isFinite(s) ? s : 1);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    window.addEventListener('resize', recompute);
    return () => { ro.disconnect(); window.removeEventListener('resize', recompute); };
  }, [outerW, outerH]);

  return (
    // Reserve the scaled footprint so neighbours lay out against the real size.
    <div ref={wrapRef} className="w-full" style={{ height: outerH * scale }}>
      <div
        className="mx-auto bg-[#1a1a18]"
        style={{
          width: outerW,
          height: outerH,
          padding: device.bezel,
          borderRadius: device.radius,
          boxShadow: '0 22px 60px rgba(0,0,0,.24)',
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        <div className="bg-white overflow-hidden relative" style={{ width: device.w, height: device.h, borderRadius: device.radius - device.bezel }}>
          <iframe src={src} title={title} className="block border-0" style={{ width: device.w, height: device.h }} />
        </div>
      </div>
    </div>
  );
}
