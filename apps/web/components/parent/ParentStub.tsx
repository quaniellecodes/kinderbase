// Placeholder tab body for the parent shell. The four tabs are built as features
// in the next parent session (PARENT-DECISIONS §8 build order); this session ships
// the shell, auth, gating, and navigation.
export function ParentStub({ title, sub, note }: { title: string; sub: string; note?: string }) {
  return (
    <div className="p-5">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <p className="text-sm text-gray-500 mt-1">{sub}</p>
      <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-400">{note ?? 'Coming in the next parent session.'}</p>
      </div>
    </div>
  );
}
