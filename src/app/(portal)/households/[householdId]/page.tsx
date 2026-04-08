import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { fetchHouseholdById } from '@/lib/households/queries';
import { HouseholdDetailClient } from './HouseholdDetailClient';

interface Props {
  params: Promise<{ householdId: string }>;
}

async function HouseholdDetailContent({ householdId }: { householdId: string }) {
  const user = await getUser();
  if (!user) return null;

  const household = await fetchHouseholdById(householdId);
  if (!household) notFound();

  return <HouseholdDetailClient household={household} currentUserId={user.id} />;
}

export default async function HouseholdDetailPage({ params }: Props) {
  const { householdId } = await params;

  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-48 rounded-lg bg-surface-3 animate-pulse" />
          <div className="h-40 rounded-2xl bg-surface-3 animate-pulse" />
        </div>
      }
    >
      <HouseholdDetailContent householdId={householdId} />
    </Suspense>
  );
}
