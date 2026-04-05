import { redirect } from 'next/navigation';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { SpreadsheetSettingsForm } from '@/components/finance/features/settings/SpreadsheetSettingsForm';
import { ExpenseReminderSettingsForm } from '@/components/finance/features/settings/ExpenseReminderSettingsForm';

export default async function FinanceSettingsPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto">
      <PageHeader
        title="Configurações"
        subtitle="Preferências do Nexus Finance que se aplicam a todas as planilhas e ao seletor de mês do dashboard."
      />
      <SpreadsheetSettingsForm />
      <ExpenseReminderSettingsForm />
    </div>
  );
}
