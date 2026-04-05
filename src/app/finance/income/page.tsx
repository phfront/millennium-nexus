import { redirect } from 'next/navigation';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { IncomeSheet } from '@/components/finance/features/income-sheet/IncomeSheet';

export default async function IncomePage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-col gap-6 max-w-full">
      <PageHeader title="Receitas" subtitle="Gerencie suas fontes de renda por mês." />
      <IncomeSheet />
    </div>
  );
}
