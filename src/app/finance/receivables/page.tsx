import { redirect } from 'next/navigation';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { ReceivablesList } from '@/components/finance/features/receivables-list/ReceivablesList';

export default async function ReceivablesPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <PageHeader title="Cobranças" subtitle="Valores que outras pessoas te devem." />
      <ReceivablesList />
    </div>
  );
}
