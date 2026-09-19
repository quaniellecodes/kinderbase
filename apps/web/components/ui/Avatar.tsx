// Initials avatar with a deterministic color, matching the colored circles used
// across the app (e.g. ActivityFeed). No image column exists on users/children.

const COLORS = [
  'bg-orange-500',
  'bg-blue-600',
  'bg-emerald-700',
  'bg-amber-700',
  'bg-indigo-600',
  'bg-rose-500',
  'bg-teal-600',
  'bg-violet-600',
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length]!;
}

const SIZES = { sm: 'w-8 h-8 text-[11px]', md: 'w-10 h-10 text-xs', lg: 'w-12 h-12 text-sm' };

export function Avatar({ name, size = 'md' }: { name: string; size?: keyof typeof SIZES }) {
  return (
    <div
      className={`${SIZES[size]} ${colorFor(name)} rounded-full flex items-center justify-center text-white font-medium flex-shrink-0`}
      title={name}
    >
      {initials(name)}
    </div>
  );
}
