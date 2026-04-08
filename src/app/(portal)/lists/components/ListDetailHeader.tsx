'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { deleteList, updateList } from '@/lib/lists/actions';
import type { List } from '@/types/database';
import { ArrowLeft, Archive, Trash2, Users, Edit2 } from 'lucide-react';
import { EditListModal } from './EditListModal';

interface ListDetailHeaderProps {
  list: List;
  pendingCount: number;
  checkedCount: number;
  estimatedTotal: number;
  householdName?: string;
}

export function ListDetailHeader({
  list,
  pendingCount,
  checkedCount,
  householdName,
  estimatedTotal,
}: ListDetailHeaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showEdit, setShowEdit] = useState(false);
  const totalItems = pendingCount + checkedCount;

  function handleArchive() {
    startTransition(async () => {
      await updateList(list.id, { is_archived: true });
      router.push('/lists');
    });
  }

  function handleDelete() {
    if (!confirm('Excluir esta lista? Esta ação não pode ser desfeita.')) return;
    startTransition(async () => {
      await deleteList(list.id);
      router.push('/lists');
    });
  }

  return (
    <div className="flex items-start gap-3 mb-6">
      <Link
        href="/lists"
        className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={16} />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{list.icon}</span>
          <h1 className="text-xl font-bold text-text-primary truncate">{list.name}</h1>
        </div>

        <div className="flex items-center flex-wrap gap-3 mt-1">
          <p className="text-xs text-text-muted">
            {totalItems === 0
              ? 'Sem itens'
              : `${checkedCount}/${totalItems} concluídos`}
          </p>
          {householdName && (
            <span className="inline-flex items-center gap-1 text-xs text-text-muted">
              <Users size={10} />
              {householdName}
            </span>
          )}
          {estimatedTotal > 0 && (
            <span className="inline-flex items-center rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">
              ~R$ {estimatedTotal.toFixed(2).replace('.', ',')}
            </span>
          )}
        </div>

        {/* Barra de progresso */}
        {totalItems > 0 && (
          <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-surface-3 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(checkedCount / totalItems) * 100}%`,
                backgroundColor:
                  checkedCount === totalItems ? '#22c55e' : 'var(--color-brand-primary)',
              }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setShowEdit(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
          title="Editar lista"
        >
          <Edit2 size={15} />
        </button>
        <button
          onClick={handleArchive}
          disabled={isPending}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
          title="Arquivar lista"
        >
          <Archive size={15} />
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
          title="Excluir lista"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {showEdit && (
        <EditListModal
          list={list}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}
