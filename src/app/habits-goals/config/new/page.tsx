import { PageHeader } from '@phfront/millennium-ui';
import { GoalFormWrapper } from './goal-form-wrapper';

export default function NewGoalPage() {
  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto">
      <PageHeader title="Nova meta" subtitle="Configure um novo tracker para o seu dia." />
      <GoalFormWrapper />
    </div>
  );
}
