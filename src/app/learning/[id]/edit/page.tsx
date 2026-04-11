import { fetchLearningPlan } from '@/app/learning/actions';
import { notFound } from 'next/navigation';
import { PlanManagerClient } from './PlanManagerClient';

export default async function EditLearningPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const plan = await fetchLearningPlan(resolvedParams.id);

  if (!plan) notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-text-primary">Gerenciar Plano: {plan.title}</h1>
        <p className="text-text-secondary">Estruture os módulos, dias e checklists do seu plano de aprendizado.</p>
      </div>
      
      <PlanManagerClient plan={plan} />
    </div>
  );
}
