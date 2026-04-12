import { fetchLearningPlan } from '../actions';
import { notFound } from 'next/navigation';
import { LearningPlanDetailClient } from './LearningPlanDetailClient';

export default async function LearningPlanDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const plan = await fetchLearningPlan(resolvedParams.id);

  if (!plan) {
    notFound();
  }

  return <LearningPlanDetailClient plan={plan} />;
}
