import { TabBar, Alert } from '@/components/ui';
import { getSaeoContext } from './saeo-actions';
import { AssessmentSection } from './AssessmentSection';
import { ObservationsSection } from './ObservationsSection';
import { ScreeningSection } from './ScreeningSection';
import { EvaluationSection } from './EvaluationSection';

const SUB = [
  { key: 'assessment', label: 'Assessment' },
  { key: 'observations', label: 'Observations' },
  { key: 'screening', label: 'Screening' },
  { key: 'evaluation', label: 'Evaluation' },
];

export async function SaeoPanel({ childId, sub }: { childId: string; sub: string }) {
  const ctx = await getSaeoContext(childId);
  const active = SUB.some((s) => s.key === sub) ? sub : 'assessment';

  return (
    <div>
      <TabBar items={SUB} active={active} hrefFor={(k) => `/students/${childId}?tab=saeo&saeo=${k}`} className="mb-4" />

      {!ctx?.hasFramework && (active === 'assessment' || active === 'observations') && (
        <Alert tone="indigo" className="mb-4">
          The {ctx?.view === 'preschool' ? 'Preschool' : 'Infant/Toddler'} ELOF content isn’t loaded for this age view yet,
          so goal-based tools are limited for this child.
        </Alert>
      )}

      {active === 'assessment' ? (
        <AssessmentSection childId={childId} />
      ) : active === 'observations' ? (
        <ObservationsSection childId={childId} />
      ) : active === 'screening' ? (
        <ScreeningSection childId={childId} />
      ) : (
        <EvaluationSection childId={childId} />
      )}
    </div>
  );
}
