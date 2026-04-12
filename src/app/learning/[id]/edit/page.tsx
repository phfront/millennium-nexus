import Link from 'next/link';
import { fetchLearningPlan } from '@/app/learning/actions';
import { notFound } from 'next/navigation';
import { PlanManagerClientWrapper } from './PlanManagerClientWrapper';
import { Card, Badge, Button } from '@phfront/millennium-ui';
import { ArrowLeft, Calendar, Target, Clock } from 'lucide-react';

export default async function EditLearningPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const plan = await fetchLearningPlan(resolvedParams.id);

  if (!plan) notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header com voltar */}
      <div className="flex items-center gap-4">
        <Link
          href={`/learning/${plan.id}`}
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Gerenciar Plano</h1>
        </div>
      </div>

      <PlanManagerClientWrapper plan={plan} schedulingType={plan.scheduling_type} />
    </div>
  );
}
