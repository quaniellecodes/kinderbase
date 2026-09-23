import { notFound } from 'next/navigation';
import { getMobileRoom, getRoomFeed, getLessonPlan, getRoutine, getRoomOptions } from '../actions';
import { ClassroomView } from './ClassroomView';

export default async function ClassroomDetailPage({ params }: { params: { id: string } }) {
  const room = await getMobileRoom(params.id);
  if (!room) notFound();
  const [feed, plan, routine, rooms] = await Promise.all([
    getRoomFeed(params.id),
    getLessonPlan(params.id),
    getRoutine(params.id),
    getRoomOptions(params.id),
  ]);
  return <ClassroomView room={room} feed={feed} plan={plan} routine={routine} rooms={rooms} />;
}
