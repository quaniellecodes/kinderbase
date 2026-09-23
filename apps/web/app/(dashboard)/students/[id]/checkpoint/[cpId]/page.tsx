import { notFound } from 'next/navigation';
import { getCheckpointDetail } from '../checkpoint-actions';
import { CheckpointRating } from '../CheckpointRating';

export default async function CheckpointPage({ params }: { params: { id: string; cpId: string } }) {
  const detail = await getCheckpointDetail(params.cpId);
  if (!detail || detail.childId !== params.id) notFound();
  return <CheckpointRating detail={detail} />;
}
