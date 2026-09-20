import { getObservations, getGoalOptions, getSaeoContext } from './saeo-actions';
import { ObservationsClient } from './ObservationsClient';

export async function ObservationsSection({ childId }: { childId: string }) {
  const [observations, goalOptions, ctx] = await Promise.all([
    getObservations(childId),
    getGoalOptions(childId),
    getSaeoContext(childId),
  ]);
  // Any center member may record observations (staff anecdotal notes).
  return (
    <ObservationsClient
      childId={childId}
      observations={observations}
      goalOptions={goalOptions}
      canEdit={!!ctx}
      photoConsent={!!ctx?.photoConsent}
    />
  );
}
