import { redirect } from 'next/navigation';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { MonthHistoryTable } from '@/components/finance/features/month-history/MonthHistoryTable';

export default async function FinanceHistoryPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <PageHeader
        title="Histórico mensal"
        subtitle="Resumos arquivados ao fecho de cada mês. Os totais refletem o momento do arquivo; podes continuar a editar meses passados nas planilhas sem alterar estes registos."
      />
      <MonthHistoryTable />
    </div>
  );
}
