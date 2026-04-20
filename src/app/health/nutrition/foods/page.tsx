'use client';

import { PageHeader } from '@phfront/millennium-ui';
import { FoodList } from '@/components/health/features/food-manager/food-list';
import { useCurrentUser } from '@/hooks/use-current-user';

export default function FoodsPage() {
  const user = useCurrentUser();
  const isAdmin = user?.profile?.is_admin ?? false;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <PageHeader title="Alimentos" subtitle="Gerencie seu catálogo de alimentos." />
      <div className="p-4 bg-surface-2 rounded-xl border border-border">
        <FoodList isAdmin={isAdmin} />
      </div>
    </div>
  );
}
