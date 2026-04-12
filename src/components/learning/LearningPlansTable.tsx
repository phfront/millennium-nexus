'use client';

import { Card, Button, Badge, DataTable } from '@phfront/millennium-ui';
import { Calendar, Clock, Plus } from 'lucide-react';
import Link from 'next/link';
import type { LearningPlan } from '@/types/learning';

interface LearningPlansTableProps {
  plans: LearningPlan[];
}

export function LearningPlansTable({ plans }: LearningPlansTableProps) {
  const columns = [
    {
      key: 'title' as const,
      header: 'Plano',
      width: '40%',
      render: (plan: LearningPlan) => (
        <div className="font-medium text-text-primary">{plan.title}</div>
      ),
    },
    {
      key: 'status' as const,
      header: 'Status',
      width: '25%',
      render: (plan: LearningPlan) => {
        if (plan.status === 'completed') {
          return <Badge variant="success">Concluído</Badge>;
        } else if (plan.status === 'in_progress') {
          return <Badge variant="info">Em Andamento</Badge>;
        } else {
          return <Badge variant="muted">Planejamento</Badge>;
        }
      },
    },
    {
      key: 'scheduling_type' as const,
      header: 'Tipo',
      width: '20%',
      render: (plan: LearningPlan) => (
        <div className="flex items-center gap-1 text-text-secondary">
          {plan.scheduling_type === 'calendar' ? <Calendar className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          <span className="text-sm">{plan.scheduling_type === 'calendar' ? 'Data Fixa' : 'Ritmo Livre'}</span>
        </div>
      ),
    },
    {
      key: 'actions' as const,
      header: '',
      width: '15%',
      render: (plan: LearningPlan) => (
        <Link href={`/learning/${plan.id}`} className="text-brand-primary hover:underline text-sm">
          Ver detalhes
        </Link>
      ),
    },
  ];

  const emptyAction = (
    <Link href="/learning/create">
      <Button variant="outline">Criar Plano</Button>
    </Link>
  );

  return (
    <Card className="p-0 overflow-hidden">
      <DataTable
        columns={columns}
        data={plans}
        emptyTitle="Nenhum plano encontrado"
        emptyDescription="Você ainda não tem nenhum plano de estudo. Que tal criar um novo plano estruturado em dias?"
        emptyAction={emptyAction}
      />
    </Card>
  );
}
