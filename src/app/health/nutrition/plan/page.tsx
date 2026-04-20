import { redirect } from 'next/navigation';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { DietBuilderClient } from '@/components/health/features/diet-builder/diet-builder-client';

export default async function DietPlanPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <PageHeader title="Minha Dieta" subtitle="Crie e edite seu plano alimentar." />
      <DietBuilderClient />
    </div>
  );
}
