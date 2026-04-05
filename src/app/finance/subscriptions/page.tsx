import { redirect } from 'next/navigation';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { SubscriptionsList } from '@/components/finance/features/subscriptions-list/SubscriptionsList';

export default async function SubscriptionsPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <PageHeader title="Assinaturas" subtitle="Gerencie suas assinaturas ativas e inativas." />
      <SubscriptionsList />
    </div>
  );
}
