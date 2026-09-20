import { getEvaluation } from './evaluation-actions';
import { EvaluationClient } from './EvaluationClient';

export async function EvaluationSection({ childId }: { childId: string }) {
  const data = await getEvaluation(childId);
  if (!data) return null;
  return <EvaluationClient childId={childId} data={data} />;
}
