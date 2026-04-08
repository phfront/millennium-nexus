import { Suspense } from 'react';
import { getUser } from '@/lib/auth';
import { fetchUserHouseholds } from '@/lib/households/queries';
import { PageHeader, EmptyState } from '@phfront/millennium-ui';
import { HouseholdsClientPage } from './HouseholdsClientPage';

async function HouseholdsContent() {
  const user = await getUser();
  if (!user) return null;

  const households = await fetchUserHouseholds(user.id);

  return <HouseholdsClientPage initialHouseholds={households} />;
}

export default function HouseholdsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-48 rounded-lg bg-surface-3 animate-pulse" />
          <div className="h-20 rounded-2xl bg-surface-3 animate-pulse" />
          <div className="h-20 rounded-2xl bg-surface-3 animate-pulse" />
        </div>
      }
    >
      <HouseholdsContent />
    </Suspense>
  );
}
