import { redirect } from 'next/navigation';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { Planning } from '@/components/finance/features/planning/Planning';

export default async function PlanningPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-full max-w-full flex-col">
      <PageHeader
        title="Planejamento"
        subtitle="Compras que você quer fazer e como ficam os próximos meses. Nada aqui é lançado."
      />
      <Planning />
    </div>
  );
}
