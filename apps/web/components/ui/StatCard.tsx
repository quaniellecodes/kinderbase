type Props = {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'default' | 'green' | 'red';
};

const valueTone: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-gray-900',
  green: 'text-green-700',
  red: 'text-red-600',
};

export function StatCard({ label, value, sub, tone = 'default' }: Props) {
  return (
    <div className="bg-white rounded-card border border-gray-100 p-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-2xl font-medium mt-1 ${valueTone[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}
