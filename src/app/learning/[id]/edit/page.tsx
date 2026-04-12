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

  const statusLabels: Record<string, string> = {
    planning: 'Planejamento',
    in_progress: 'Em Andamento',
    completed: 'Concluído',
    paused: 'Pausado',
  };

  const statusVariants: Record<string, 'muted' | 'info' | 'success' | 'warning'> = {
    planning: 'muted',
    in_progress: 'info',
    completed: 'success',
    paused: 'warning',
  };

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

      {/* Card com informações do plano */}
      <Card className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-text-primary">{plan.title}</h2>
              {plan.description && (
                <p className="text-text-secondary mt-1">{plan.description}</p>
              )}
            </div>
            <Badge variant={statusVariants[plan.status] || 'muted'}>
              {statusLabels[plan.status] || plan.status}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1 text-text-secondary">
              {plan.scheduling_type === 'calendar' ? <Calendar className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              <span>{plan.scheduling_type === 'calendar' ? 'Data Fixa' : 'Ritmo Livre'}</span>
            </div>
            {plan.start_date && (
              <div className="flex items-center gap-1 text-text-secondary">
                <Target className="h-4 w-4" />
                <span>Início: {new Date(plan.start_date).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
            {plan.target_date && (
              <div className="flex items-center gap-1 text-text-secondary">
                <Calendar className="h-4 w-4" />
                <span>Meta: {new Date(plan.target_date).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </div>

          {plan.goals && (
            <div className="pt-4 border-t border-border">
              <p className="text-sm font-medium text-text-primary mb-1">Objetivos:</p>
              <p className="text-sm text-text-secondary">{plan.goals}</p>
            </div>
          )}
        </div>
      </Card>

      <PlanManagerClientWrapper plan={plan} schedulingType={plan.scheduling_type} />
    </div>
  );
}
