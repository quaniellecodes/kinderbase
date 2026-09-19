type Props = {
  name: string;
  handle: string;
  bio: string | null;
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function PublicProfileHero({ name, handle, bio }: Props) {
  return (
    <div className="bg-white rounded-card border border-gray-100 px-4 py-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
          <span className="text-xl font-medium text-white">{getInitials(name)}</span>
        </div>
        <div>
          <h1 className="text-xl font-medium text-gray-900">{name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">@{handle}</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-chip">
              Verified via KinderBase
            </span>
          </div>
        </div>
      </div>
      {bio && (
        <p className="mt-3 text-sm text-gray-600 leading-relaxed">{bio}</p>
      )}
    </div>
  );
}
