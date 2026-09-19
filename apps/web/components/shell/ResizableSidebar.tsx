'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'kb_sidebar_width';
const DEFAULT_WIDTH = 180;
const MIN_WIDTH = 140;
const MAX_WIDTH = 320;

export function ResizableSidebar({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) setWidth(parsed);
    }
  }, []);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const startX = e.clientX;
    const startWidth = sidebarRef.current?.offsetWidth ?? width;

    function onMouseMove(e: MouseEvent) {
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + e.clientX - startX));
      setWidth(next);
    }

    function onMouseUp(e: MouseEvent) {
      const final = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + e.clientX - startX));
      setWidth(final);
      localStorage.setItem(STORAGE_KEY, String(final));
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [width]);

  return (
    <div
      ref={sidebarRef}
      className="hidden md:flex relative flex-shrink-0 sticky top-0 h-screen"
      style={{ width }}
    >
      {/* Sidebar content fills the container */}
      <div className="flex flex-col w-full border-r border-gray-100 bg-white h-full overflow-y-auto overflow-x-hidden">
        {children}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={startDrag}
        className={`absolute top-0 right-0 w-1 h-full cursor-ew-resize group z-10 ${isDragging ? 'bg-brand/30' : ''}`}
      >
        {/* Visible hit-target highlight on hover */}
        <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-brand/20 transition-colors rounded-full" />
      </div>
    </div>
  );
}
