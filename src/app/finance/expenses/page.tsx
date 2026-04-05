import { redirect } from 'next/navigation';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { ExpensesSheet } from '@/components/finance/features/expenses-sheet/ExpensesSheet';

export default async function ExpensesPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-col gap-6 max-w-full">
      <PageHeader title="Despesas" subtitle="Controle suas despesas recorrentes por categoria." />
      <ExpensesSheet />
    </div>
  );
}
