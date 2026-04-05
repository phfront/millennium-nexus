'use client';

import { EmptyState, Icon, ModuleCard, useToast } from '@phfront/millennium-ui';
import type { Module } from '@/types/database';

interface ModuleGridProps {
  modules: Module[];
}

export function ModuleGrid({ modules }: ModuleGridProps) {
  const { toast } = useToast();

  const sorted = [...modules].sort((a, b) => a.sort_order - b.sort_order);

  if (sorted.length === 0) {
    return (
      <EmptyState
        className="py-12"
        title="Nenhum módulo cadastrado"
        description="Ainda não há módulos disponíveis no catálogo."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sorted.map((module) => (
        <ModuleCard
          key={module.id}
          icon={<Icon name={module.icon_name} fallbackName="Box" size={22} />}
          label={module.label}
          description={module.description ?? undefined}
          status={module.is_active ? 'active' : 'soon'}
          href={module.is_active ? `/${module.slug}` : undefined}
          isDisabled={!module.is_active}
          onClick={
            !module.is_active
              ? () => toast.info('Em breve!', `${module.label} ainda está em desenvolvimento.`)
              : undefined
          }
        />
      ))}
    </div>
  );
}
