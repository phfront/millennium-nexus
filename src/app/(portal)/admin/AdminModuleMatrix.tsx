'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  Card,
  EmptyState,
  Switch,
  ToggleMatrix,
  useToast,
} from '@phfront/millennium-ui';
import { setUserModuleDenial } from './actions';
import type { Module, Profile } from '@/types/database';

export type AdminProfileRow = Pick<Profile, 'id' | 'full_name' | 'email' | 'is_admin' | 'avatar_url'>;

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
      <div className="flex items-start gap-3">
        <Avatar src={u.avatar_url} name={u.full_name ?? undefined} size="sm" className="shrink-0" />
        <div className="min-w-0">
          <div className="font-medium text-text-primary">{u.full_name ?? '—'}</div>
          <div className="max-w-[200px] truncate text-xs text-text-muted">{u.email ?? u.id}</div>
          {u.is_admin && (
            <span className="mt-1 inline-block text-[10px] font-medium uppercase tracking-wide text-brand-primary">
              Admin
            </span>
          )}
        </div>
      </div>
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

  const matrixFooterNote =
    'Desligar o interruptor revoga o acesso ao módulo. Utilizadores admin continuam a poder abrir /admin.';

  const matrixFooter = <p className="p-3 text-xs text-text-muted">{matrixFooterNote}</p>;

  return (
    <>
      <div className="hidden min-w-0 md:block">
        <ToggleMatrix
          cornerHeader="Utilizador"
          rows={rows}
          columns={columns}
          isChecked={(userId, moduleId) => !localDenied.has(denialKey(userId, moduleId))}
          onCheckedChange={(userId, moduleId, checked) => onToggle(userId, moduleId, checked)}
          disabled={isPending}
          minTableWidth={Math.max(520, 200 + modules.length * 96)}
          switchAriaLabel={(userId, moduleId) => {
            const u = users.find((x) => x.id === userId);
            const m = modules.find((x) => x.id === moduleId);
            return `Acesso de ${u?.full_name ?? userId} a ${m?.label ?? moduleId}`;
          }}
          footer={matrixFooter}
        />
      </div>

      <div className="space-y-4 md:hidden">
        {users.map((u) => (
          <Card key={u.id}>
            <Card.Header className="flex-row items-start gap-3 border-b border-border py-3">
              <Avatar src={u.avatar_url} name={u.full_name ?? undefined} size="md" className="shrink-0" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="font-medium text-text-primary">{u.full_name ?? '—'}</div>
                <div className="break-all text-xs text-text-muted">{u.email ?? u.id}</div>
                {u.is_admin && (
                  <span className="inline-block text-[10px] font-medium uppercase tracking-wide text-brand-primary">
                    Admin
                  </span>
                )}
              </div>
            </Card.Header>
            <Card.Body className="space-y-0 divide-y divide-border py-2">
              {modules.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">{m.label}</p>
                    <p className="font-mono text-xs text-text-muted">{m.slug}</p>
                    {!m.is_active && (
                      <span className="mt-0.5 inline-block text-[10px] uppercase tracking-wide text-warning">
                        inativo
                      </span>
                    )}
                  </div>
                  <Switch
                    checked={!localDenied.has(denialKey(u.id, m.id))}
                    disabled={isPending}
                    aria-label={`Acesso de ${u.full_name ?? u.id} a ${m.label}`}
                    onCheckedChange={(checked) => onToggle(u.id, m.id, checked)}
                  />
                </div>
              ))}
            </Card.Body>
          </Card>
        ))}
        <p className="px-0.5 text-xs text-text-muted">{matrixFooterNote}</p>
      </div>
    </>
  );
}
