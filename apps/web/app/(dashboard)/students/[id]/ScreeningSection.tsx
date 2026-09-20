import { getScreenings } from './screening-actions';
import { ScreeningClient } from './ScreeningClient';

export async function ScreeningSection({ childId }: { childId: string }) {
  const data = await getScreenings(childId);
  if (!data) return null;
  return <ScreeningClient childId={childId} data={data} />;
}
