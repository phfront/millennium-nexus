'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, Skeleton, useToast } from '@phfront/millennium-ui';
import { useWeightLogs } from '@/hooks/health/use-weight-logs';
import { formatDatePtBR } from '@/lib/health/projection';

const PAGE_SIZE = 20;

export function WeightHistory() {
  const { toast } = useToast();
  const { logs, isLoading, deleteLog } = useWeightLogs();
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const sorted = [...logs].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  const total = sorted.length;
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setConfirmId(null);
    try {
      await deleteLog(id);
      toast.success('Registro excluído', 'O peso foi removido do histórico.');
    } catch {
      toast.error('Erro ao excluir', 'Tente novamente.');
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} variant="block" className="h-12 w-full" />)}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-16 text-text-muted text-sm">
        <p className="text-3xl mb-3">⚖️</p>
        <p className="font-medium text-text-primary">Nenhum registro ainda</p>
        <p className="mt-1">Registre seu primeiro peso para começar.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col divide-y divide-border bg-surface-2 rounded-xl overflow-hidden border border-border">
        {paginated.map((log, i) => {
          const prev = sorted[sorted.indexOf(log) + 1];
          const diff = prev ? log.weight - prev.weight : null;
          const diffSign = diff === null ? '' : diff < 0 ? '−' : diff > 0 ? '+' : '';
          const diffColor = diff === null ? '' : diff < 0 ? 'text-success' : diff > 0 ? 'text-danger' : 'text-text-muted';

          return (
            <div key={log.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary">{formatDatePtBR(log.logged_at)}</p>
                {log.note && <p className="text-xs text-text-muted truncate">{log.note}</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {diff !== null && (
                  <span className={`text-xs font-semibold tabular-nums ${diffColor}`}>
                    {diffSign}{Math.abs(diff).toFixed(1)} kg
                  </span>
                )}
                <span className="text-sm font-bold tabular-nums text-text-primary w-16 text-right">
                  {log.weight.toFixed(1)} kg
                </span>
                {confirmId === log.id ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="danger"
                      isLoading={deletingId === log.id}
                      onClick={() => handleDelete(log.id)}
                    >
                      Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(log.id)}
                    className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    aria-label="Excluir registro"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-muted">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span>{page} / {totalPages}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
