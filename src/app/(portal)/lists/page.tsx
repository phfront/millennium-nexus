import { Suspense } from 'react';
import { getUser } from '@/lib/auth';
import { fetchUserLists } from '@/lib/lists/queries';
import { fetchUserHouseholds } from '@/lib/households/queries';
import { ListsClientPage } from './ListsClientPage';

async function ListsContent() {
  const user = await getUser();
  if (!user) return null;

  const [lists, households] = await Promise.all([
    fetchUserLists(user.id),
    fetchUserHouseholds(user.id),
  ]);

  return <ListsClientPage initialLists={lists} households={households} />;
}

export default function ListsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-8 w-48 rounded-lg bg-surface-3 animate-pulse" />
          <div className="h-20 rounded-2xl bg-surface-3 animate-pulse" />
          <div className="h-20 rounded-2xl bg-surface-3 animate-pulse" />
          <div className="h-20 rounded-2xl bg-surface-3 animate-pulse" />
        </div>
      }
    >
      <ListsContent />
    </Suspense>
  );
}
