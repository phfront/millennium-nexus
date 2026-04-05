import { redirect } from 'next/navigation';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { MonthlyDashboard } from '@/components/finance/features/monthly-dashboard/MonthlyDashboard';

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <PageHeader title="Nexus Finance" subtitle="Visão geral das suas finanças." />
      <MonthlyDashboard />
    </div>
  );
}
