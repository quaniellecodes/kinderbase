import { notFound } from 'next/navigation';
import { getMobileRoom, getRoomFeed } from '../actions';
import { ClassroomView } from './ClassroomView';

export default async function ClassroomDetailPage({ params }: { params: { id: string } }) {
  const room = await getMobileRoom(params.id);
  if (!room) notFound();
  const feed = await getRoomFeed(params.id);
  return <ClassroomView room={room} feed={feed} />;
}
