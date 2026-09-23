import { notFound } from 'next/navigation';
import { getStudentDocuments } from './documents-actions';
import { DocumentsEditor } from './DocumentsEditor';

export async function DocumentsPanel({ childId }: { childId: string }) {
  const documents = await getStudentDocuments(childId);
  if (!documents) notFound();
  return <DocumentsEditor childId={childId} documents={documents} />;
}
