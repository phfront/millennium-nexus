import { fetchLearningPlan } from '@/app/learning/actions';
import { notFound } from 'next/navigation';
import { DayExecutionClient } from './DayExecutionClient';
import { LearningPlanDayWithItems } from '@/types/learning';

export default async function LearningDayExecution({ params }: { params: Promise<{ id: string, day_id: string }> }) {
  const resolvedParams = await params;
  const plan = await fetchLearningPlan(resolvedParams.id);

  if (!plan) notFound();

  // Find the exact day
  let currentDay: LearningPlanDayWithItems | undefined;
  if (plan.days) {
    currentDay = plan.days.find((d: LearningPlanDayWithItems) => d.id === resolvedParams.day_id);
  }

  if (!currentDay) notFound();

  return <DayExecutionClient day={currentDay} planId={plan.id} />;
}
