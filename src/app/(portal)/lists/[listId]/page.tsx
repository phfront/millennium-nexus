import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { fetchListById, fetchListItems } from '@/lib/lists/queries';
import { fetchUserHouseholds } from '@/lib/households/queries';
import { ListDetailClient } from './ListDetailClient';

interface Props {
  params: Promise<{ listId: string }>;
}

async function ListDetailContent({ listId }: { listId: string }) {
  const user = await getUser();
  if (!user) return null;

  const [list, initialItems, households] = await Promise.all([
    fetchListById(listId),
    fetchListItems(listId),
    fetchUserHouseholds(user.id),
  ]);

  if (!list) notFound();

  const householdName = list.household_id
    ? households.find((h) => h.id === list.household_id)?.name
    : undefined;

  return (
    <ListDetailClient
      list={list}
      initialItems={initialItems}
      householdName={householdName}
    />
  );
}

export default async function ListDetailPage({ params }: Props) {
  const { listId } = await params;

  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-10 w-64 rounded-lg bg-surface-3 animate-pulse" />
          <div className="h-12 rounded-2xl bg-surface-3 animate-pulse" />
          <div className="space-y-2 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-surface-3 animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <ListDetailContent listId={listId} />
    </Suspense>
  );
}
