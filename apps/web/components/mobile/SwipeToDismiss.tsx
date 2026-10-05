'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

/**
 * Drag a row to the right to dismiss it. A red "delete" track is revealed on the
 * left as you drag; past the threshold the row slides off and collapses, and
 * `onDismiss` fires. A real tap (no drag) passes through to inner links/buttons —
 * a drag swallows the click so it doesn't also navigate. `touch-action: pan-y`
 * keeps vertical scrolling intact.
 */
export function SwipeToDismiss({ children, onDismiss, threshold = 110 }: { children: ReactNode; onDismiss: () => void; threshold?: number }) {
  const [dx, setDx] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);
  const widthRef = useRef(0);
  const rowRef = useRef<HTMLDivElement>(null);

  function down(e: React.PointerEvent) {
    startX.current = e.clientX;
    moved.current = false;
    widthRef.current = rowRef.current?.offsetWidth ?? 320;
    rowRef.current?.setPointerCapture?.(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (startX.current == null) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 6) moved.current = true;
    setDx(Math.max(0, delta)); // rightward only
  }
  function end() {
    if (startX.current == null) return;
    const past = dx > threshold;
    startX.current = null;
    if (past) {
      setDismissing(true);
      setDx(widthRef.current);
      window.setTimeout(onDismiss, 180);
    } else {
      setDx(0);
    }
  }
  function clickCapture(e: React.MouseEvent) {
    // A drag just happened — don't let the inner Link/button also fire.
    if (moved.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  return (
    <div className="relative overflow-hidden" style={{ maxHeight: dismissing ? 0 : 400, transition: dismissing ? 'max-height 180ms ease' : undefined }}>
      <div className="absolute inset-y-0 left-0 flex items-center pl-4 bg-status-red text-white" style={{ width: Math.min(dx, threshold + 24), opacity: dx > 10 ? 1 : 0 }}>
        <Trash2 className="w-4 h-4" />
      </div>
      <div
        ref={rowRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onClickCapture={clickCapture}
        className="bg-white"
        style={{ transform: `translateX(${dx}px)`, transition: startX.current == null ? 'transform 180ms ease' : undefined, touchAction: 'pan-y' }}
      >
        {children}
      </div>
    </div>
  );
}
