'use client';

/** Sets the `kb_demo_now` cookie that getClock() honors under DEMO_MODE, then reloads. */
export function DevClock({ current }: { current: string }) {
  function set(value: string) {
    const iso = new Date(value).toISOString();
    document.cookie = `kb_demo_now=${encodeURIComponent(iso)}; path=/; max-age=86400`;
    location.reload();
  }
  function clear() {
    document.cookie = 'kb_demo_now=; path=/; max-age=0';
    location.reload();
  }
  const presets = ['09:00', '12:30', '15:10'];
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-xs font-medium text-gray-500">Demo clock:</span>
      <input
        type="datetime-local"
        defaultValue={current}
        onChange={(e) => e.target.value && set(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-2 py-1"
      />
      {presets.map((t) => (
        <button
          key={t}
          onClick={() => set(`${current.slice(0, 10)}T${t}`)}
          className="text-xs px-2 py-1 rounded-chip border border-gray-200 hover:bg-gray-50"
        >
          {t}
        </button>
      ))}
      <button onClick={clear} className="text-xs px-2 py-1 rounded-chip border border-gray-200 hover:bg-gray-50">
        Real time
      </button>
    </div>
  );
}
