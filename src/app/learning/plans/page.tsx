import { fetchLearningPlans } from '../actions';
import { Button } from '@phfront/millennium-ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { LearningPlansTable } from '@/components/learning/LearningPlansTable';

export default async function LearningPlansPage() {
  const plans = await fetchLearningPlans();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Meus Planos de Aprendizado</h2>
          <p className="text-text-secondary mt-1">Acompanhe seu progresso dia a dia.</p>
        </div>
        <Link href="/learning/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Plano
          </Button>
        </Link>
      </div>

      <LearningPlansTable plans={plans} />
    </div>
  );
}
