import { redirect } from 'next/navigation';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { OneTimeSheet } from '@/components/finance/features/one-time-sheet/OneTimeSheet';

export default async function OneTimePage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-col gap-6 max-w-full">
      <PageHeader
        title="Lançamentos pontuais"
        subtitle="Receitas ou despesas não recorrentes, organizadas por mês."
      />
      <OneTimeSheet />
    </div>
  );
}
