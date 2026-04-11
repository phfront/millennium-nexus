import { fetchLearningPlan } from '../actions';
import { notFound } from 'next/navigation';
import { Card, Button, Badge } from '@phfront/millennium-ui';
import { Target, CheckCircle2, Circle, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import type { LearningPlanDayWithItems } from '@/types/learning';
import { AddDayForm } from './AddDayForm';

export default async function LearningPlanDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const plan = await fetchLearningPlan(resolvedParams.id);

  if (!plan) {
    notFound();
  }

  // Group days by section
  const sectionsMap = new Map<string | null, LearningPlanDayWithItems[]>();
  
  if (plan.days) {
    plan.days.forEach((day: LearningPlanDayWithItems) => {
      const g = sectionsMap.get(day.section_id) || [];
      g.push(day);
      sectionsMap.set(day.section_id, g);
    });
  }

  // For un-sectioned days
  const unsectionedDays = sectionsMap.get(null) || [];
  
  // Sort days
  unsectionedDays.sort((a, b) => a.day_number - b.day_number);
  
  const sections = (plan.sections || []).sort((a: any, b: any) => a.order_index - b.order_index);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-2">{plan.title}</h1>
          {plan.description && (
            <p className="text-text-secondary text-lg leading-relaxed">{plan.description}</p>
          )}
        </div>
        <Link href={`/learning/${plan.id}/edit`}>
           <Button variant="outline"><Target className="w-4 h-4 mr-2" /> Gerenciar Plano</Button>
        </Link>
      </div>

      {unsectionedDays.length === 0 && sections.length === 0 && (
        <Card className="p-8 text-center bg-surface-2 border-dashed">
          <Target className="h-10 w-10 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-1">Caminho Vazio</h3>
          <p className="text-text-secondary mb-6 max-w-sm mx-auto">Não há dias nem módulos cadastrados para este plano ainda.</p>
        </Card>
      )}

      <div className="space-y-12">
        {unsectionedDays.length > 0 && (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {unsectionedDays.map((day) => (
              <DayNode key={day.id} day={day} planId={plan.id} />
            ))}
          </div>
        )}

        {sections.map((section: any) => {
          const sectionDays = sectionsMap.get(section.id) || [];
          sectionDays.sort((a, b) => a.day_number - b.day_number);

          return (
            <div key={section.id} className="space-y-6">
              <h2 className="text-2xl font-bold text-text-primary border-b border-border pb-2 inline-block relative bg-surface-1 z-10 px-2">{section.title}</h2>
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:to-transparent">
                {sectionDays.map(day => (
                  <DayNode key={day.id} day={day} planId={plan.id} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

function DayNode({ day, planId }: { day: LearningPlanDayWithItems, planId: string }) {
  const isCompleted = day.is_completed;
  const itemsCount = day.items?.length || 0;
  const completedItemsCount = day.items?.filter(i => i.is_completed).length || 0;

  return (
    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
      <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-surface-1 bg-surface-2 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5 text-brand-primary" fill="currentColor" />
        ) : (
          <Circle className="h-5 w-5 text-text-muted" />
        )}
      </div>

      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border bg-surface-2 transition-colors hover:border-brand-primary/50 cursor-pointer">
        <Link href={`/learning/${planId}/day/${day.id}`} className="block h-full">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-primary">
              Dia {day.day_number}
            </span>
            {isCompleted && <Badge variant="success" className="text-[10px] px-1.5 py-0">Concluído</Badge>}
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-1">{day.title || 'Sessão de Estudo'}</h3>
          
          {itemsCount > 0 && (
             <div className="flex items-center gap-1.5 mt-3 text-sm text-text-secondary">
               <CheckCircle className="h-4 w-4" />
               <span>{completedItemsCount}/{itemsCount} itens</span>
             </div>
          )}
        </Link>
      </div>
    </div>
  );
}
