'use client';

import { Card, Button, Badge, DataTable } from '@phfront/millennium-ui';
import { Plus, X } from 'lucide-react';
import type { Module } from '@/types/database';

interface ModuleWithStatus extends Module {
  isActive: boolean;
}

interface ModulesTableProps {
  modules: ModuleWithStatus[];
  toggleAction: (formData: FormData) => void;
}

export function ModulesTable({ modules, toggleAction }: ModulesTableProps) {
  const columns = [
    {
      key: 'label' as const,
      header: 'Módulo',
      width: '35%',
      render: (module: ModuleWithStatus) => (
        <div>
          <div className="font-medium text-text-primary">{module.label}</div>
          {module.description && (
            <div className="text-sm text-text-secondary truncate max-w-xs">
              {module.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status' as const,
      header: 'Status',
      width: '20%',
      render: (module: ModuleWithStatus) =>
        module.isActive ? (
          <Badge variant="success">Ativo</Badge>
        ) : (
          <Badge variant="muted">Inativo</Badge>
        ),
    },
    {
      key: 'actions' as const,
      header: '',
      width: '20%',
      render: (module: ModuleWithStatus) => (
        <form action={toggleAction} className="inline">
          <input type="hidden" name="moduleId" value={module.id} />
          <input
            type="hidden"
            name="action"
            value={module.isActive ? 'deactivate' : 'activate'}
          />
          <Button
            type="submit"
            variant={module.isActive ? 'outline' : 'primary'}
            size="sm"
          >
            {module.isActive ? (
              <>
                <X className="h-4 w-4 mr-1" />
                Desativar
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Ativar
              </>
            )}
          </Button>
        </form>
      ),
    },
  ];

  return (
    <Card className="p-0 overflow-hidden">
      <DataTable
        columns={columns}
        data={modules}
        emptyTitle="Nenhum módulo disponível"
        emptyDescription="Não há módulos disponíveis para ativação no momento."
      />
    </Card>
  );
}
