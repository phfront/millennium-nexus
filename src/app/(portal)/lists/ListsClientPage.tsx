'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLists } from '@/hooks/lists/use-lists';
import { ListCard } from './components/ListCard';
import { CreateListModal } from './components/CreateListModal';
import type { List, Household, HouseholdMember } from '@/types/database';
import type { ListWithCounts } from '@/hooks/lists/use-lists';
import { Button } from '@phfront/millennium-ui';
import { Plus } from 'lucide-react';

type HouseholdWithMembers = Household & { members: HouseholdMember[] };

interface ListsClientPageProps {
  initialLists: (List & { item_count: number; checked_count: number })[];
  households: HouseholdWithMembers[];
}

export function ListsClientPage({ initialLists, households }: ListsClientPageProps) {
  const { lists: hookLists, refetch } = useLists();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);

  const lists: ListWithCounts[] =
    hookLists.length > 0 ? hookLists : (initialLists as ListWithCounts[]);

  // Função para buscar o nome do household de uma lista
  function householdName(householdId: string | null): string | undefined {
    if (!householdId) return undefined;
    return households.find((h) => h.id === householdId)?.name;
  }

  // Separa listas pessoais e por household
  const personalLists = lists.filter((l) => !l.household_id);

  // Agrupa por household
  const householdGroups: Record<string, ListWithCounts[]> = {};
  for (const list of lists) {
    if (list.household_id) {
      if (!householdGroups[list.household_id]) {
        householdGroups[list.household_id] = [];
      }
      householdGroups[list.household_id].push(list);
    }
  }

  const allEmpty = lists.length === 0;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Listas</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Pessoais e partilhadas com o seu grupo
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreate(true)}
          leftIcon={<Plus size={15} />}
        >
          <span className="hidden sm:inline">Nova lista</span>
        </Button>
      </div>

      {allEmpty ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-3 text-3xl">
            🛒
          </div>
          <div>
            <p className="font-semibold text-text-primary">Nenhuma lista ainda</p>
            <p className="text-sm text-text-muted mt-1 max-w-xs">
              Crie a sua primeira lista — supermercado, tarefas, viagem, o que quiser.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setShowCreate(true)}
            leftIcon={<Plus size={15} />}
          >
            Criar lista
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Listas pessoais */}
          {personalLists.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide px-1">
                Pessoais
              </p>
              <div className="space-y-2">
                {personalLists.map((list) => (
                  <ListCard key={list.id} list={list} />
                ))}
              </div>
            </section>
          )}

          {/* Listas por household */}
          {Object.entries(householdGroups).map(([hhId, hhLists]) => {
            const name = householdName(hhId) ?? 'Grupo';
            return (
              <section key={hhId} className="space-y-2">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wide px-1">
                  🏠 {name}
                </p>
                <div className="space-y-2">
                  {hhLists.map((list) => (
                    <ListCard key={list.id} list={list} householdName={name} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateListModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            refetch();
            router.refresh();
          }}
        />
      )}
    </>
  );
}
