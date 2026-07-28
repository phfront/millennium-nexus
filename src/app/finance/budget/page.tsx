import { redirect } from 'next/navigation';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { BudgetView } from '@/components/finance/features/budget/BudgetView';

export default async function BudgetPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-full max-w-full flex-col">
      <PageHeader
        title="Orçamento"
        subtitle="Quanto da sua renda líquida vai para obrigações, para o que é opcional e para investir."
      />
      <BudgetView />
    </div>
  );
}
