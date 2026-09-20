import { Star, StarHalf } from 'lucide-react';
import { toStars } from '@kinderbase/core';

export function Stars({ score, size = 14 }: { score: number; size?: number }) {
  const { full, half, empty } = toStars(score);
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} size={size} className="fill-amber-400 text-amber-400" />
      ))}
      {half && <StarHalf size={size} className="fill-amber-400 text-amber-400" />}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} size={size} className="text-gray-200" />
      ))}
    </span>
  );
}
