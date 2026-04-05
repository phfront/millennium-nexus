'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState, ToggleMatrix, useToast } from '@phfront/millennium-ui';
import { setUserModuleDenial } from './actions';
import type { Module, Profile } from '@/types/database';

export type AdminProfileRow = Pick<Profile, 'id' | 'full_name' | 'email' | 'is_admin'>;

function denialKey(userId: string, moduleId: string) {
  return `${userId}|${moduleId}`;
}

interface AdminModuleMatrixProps {
  users: AdminProfileRow[];
  modules: Module[];
  deniedPairs: { user_id: string; module_id: string }[];
}

export function AdminModuleMatrix({ users, modules, deniedPairs }: AdminModuleMatrixProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const deniedSet = useMemo(() => new Set(deniedPairs.map((p) => denialKey(p.user_id, p.module_id))), [deniedPairs]);
  const [localDenied, setLocalDenied] = useState<Set<string>>(() => new Set(deniedSet));

  useEffect(() => {
    setLocalDenied(new Set(deniedSet));
  }, [deniedSet]);

  const onToggle = useCallback(
    (userId: string, moduleId: string, hasAccess: boolean) => {
      const key = denialKey(userId, moduleId);
      const nextDenied = !hasAccess;

      setLocalDenied((prev) => {
        const n = new Set(prev);
        if (nextDenied) n.add(key);
        else n.delete(key);
        return n;
      });

      startTransition(async () => {
        const result = await setUserModuleDenial(userId, moduleId, nextDenied);
        if (!result.ok) {
          setLocalDenied((prev) => {
            const n = new Set(prev);
            if (nextDenied) n.delete(key);
            else n.add(key);
            return n;
          });
          toast.error('Não foi possível atualizar', result.error);
          return;
        }
        router.refresh();
      });
    },
    [router, toast],
  );

  if (users.length === 0) {
    return (
      <EmptyState
        className="py-10"
        title="Nenhum utilizador encontrado"
        description="Não há perfis para gerir neste momento."
      />
    );
  }

  if (modules.length === 0) {
    return (
      <EmptyState
        className="py-10"
        title="Nenhum módulo cadastrado"
        description="Adicione módulos ao catálogo para configurar acessos."
      />
    );
  }

  const rows = users.map((u) => ({
    id: u.id,
    header: (
      <>
        <div className="font-medium text-text-primary">{u.full_name ?? '—'}</div>
        <div className="text-xs text-text-muted truncate max-w-[200px]">{u.email ?? u.id}</div>
        {u.is_admin && (
          <span className="inline-block mt-1 text-[10px] font-medium uppercase tracking-wide text-brand-primary">
            Admin
          </span>
        )}
      </>
    ),
  }));

  const columns = modules.map((m) => ({
    id: m.id,
    header: (
      <div className="flex flex-col items-center gap-1">
        <span className="text-xs text-text-primary line-clamp-2">{m.label}</span>
        <span className="text-[10px] font-mono text-text-muted">{m.slug}</span>
        {!m.is_active && (
          <span className="text-[10px] uppercase tracking-wide text-warning">inativo</span>
        )}
      </div>
    ),
  }));

  return (
    <ToggleMatrix
      cornerHeader="Utilizador"
      rows={rows}
      columns={columns}
      isChecked={(userId, moduleId) => !localDenied.has(denialKey(userId, moduleId))}
      onCheckedChange={(userId, moduleId, checked) => onToggle(userId, moduleId, checked)}
      disabled={isPending}
      switchAriaLabel={(userId, moduleId) => {
        const u = users.find((x) => x.id === userId);
        const m = modules.find((x) => x.id === moduleId);
        return `Acesso de ${u?.full_name ?? userId} a ${m?.label ?? moduleId}`;
      }}
      footer={
        <p className="p-3 text-xs text-text-muted">
          Desligar o interruptor revoga o acesso ao módulo. Utilizadores admin continuam a poder abrir /admin.
        </p>
      }
    />
  );
}
