'use client';

import { useState, useTransition } from 'react';
import { Card, Button, Badge, DataTable, Modal } from '@phfront/millennium-ui';
import { Calendar, Clock, Plus, Play, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { LearningPlan } from '@/types/learning';
import { deleteLearningPlan } from '@/app/learning/actions';

interface LearningPlansTableProps {
  plans: any[]; // Using any because we injected progress fields in the action
}

export function LearningPlansTable({ plans }: LearningPlansTableProps) {
  const [planToDelete, setPlanToDelete] = useState<any>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const handleDelete = async () => {
    if (!planToDelete) return;
    
    startDeleteTransition(async () => {
      try {
        await deleteLearningPlan(planToDelete.id);
        setPlanToDelete(null);
      } catch (e) {
        alert('Erro ao excluir o plano.');
      }
    });
  };

  const columns = [
    {
      key: 'title' as const,
      header: 'Plano',
      width: '30%',
      render: (plan: LearningPlan) => (
        <div className="font-medium text-text-primary">{plan.title}</div>
      ),
    },
    {
      key: 'status' as const,
      header: 'Status',
      width: '15%',
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
      width: '15%',
      render: (plan: LearningPlan) => (
        <div className="flex items-center gap-1 text-text-secondary">
          {plan.scheduling_type === 'calendar' ? <Calendar className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          <span className="text-sm">{plan.scheduling_type === 'calendar' ? 'Data Fixa' : 'Ritmo Livre'}</span>
        </div>
      ),
    },
    {
      key: 'progress' as const,
      header: 'Progresso',
      width: '20%',
      render: (plan: any) => (
        <div className="flex flex-col gap-1.5 w-full pr-4">
          <div className="flex justify-between items-center text-[10px] font-bold text-text-muted">
             <span>{plan.completed_items || 0}/{plan.total_items || 0} tarefas</span>
             <span>{plan.progress || 0}%</span>
          </div>
          <div className="w-full bg-surface-3 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-brand-primary h-full transition-all duration-500 rounded-full" 
              style={{ width: `${plan.progress || 0}%` }} 
            />
          </div>
        </div>
      ),
    },
    {
      key: 'actions' as const,
      header: 'Ações',
      width: '20%',
      render: (plan: any) => (
        <div className="flex items-center gap-1">
          <Link href={`/learning/${plan.id}`}>
             <Button variant="ghost" size="icon" className="h-8 w-8 text-brand-primary hover:bg-brand-primary/10 group" title="Executar Plano">
                <Play className="h-4 w-4 fill-brand-primary/20 group-hover:fill-brand-primary transition-colors" />
             </Button>
          </Link>
          <Link href={`/learning/${plan.id}/edit`}>
             <Button variant="ghost" size="icon" className="h-8 w-8 text-text-secondary hover:bg-surface-3" title="Editar Estrutura">
                <Pencil className="h-4 w-4" />
             </Button>
          </Link>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-danger hover:bg-danger/10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPlanToDelete(plan);
            }}
            title="Excluir Plano"
          >
             <Trash2 className="h-4 w-4" />
          </Button>
       </div>
      ),
    },
  ];

  const emptyAction = (
    <Link href="/learning/create">
      <Button variant="outline">Criar Plano</Button>
    </Link>
  );

  return (
    <>
      <div className="block md:hidden flex flex-col gap-4">
        {plans.length === 0 ? (
          <Card className="p-6 text-center">
            <h3 className="font-medium mb-1">Nenhum plano encontrado</h3>
            <p className="text-sm text-text-secondary mb-4">Você ainda não tem nenhum plano de estudo. Que tal criar um novo plano estruturado em dias?</p>
            {emptyAction}
          </Card>
        ) : plans.map((plan) => (
          <Card key={plan.id} className="p-4 flex flex-col gap-4">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h3 className="font-semibold text-text-primary mb-2.5">{plan.title}</h3>
                <div className="flex items-center gap-2">
                  {plan.status === 'completed' ? (
                    <Badge variant="success">Concluído</Badge>
                  ) : plan.status === 'in_progress' ? (
                    <Badge variant="info">Em Andamento</Badge>
                  ) : (
                    <Badge variant="muted">Planejamento</Badge>
                  )}
                  <div className="flex items-center gap-1 text-text-secondary text-xs bg-surface-2 px-2 py-0.5 rounded-full">
                    {plan.scheduling_type === 'calendar' ? <Calendar className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    <span>{plan.scheduling_type === 'calendar' ? 'Data Fixa' : 'Ritmo Livre'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-1.5 w-full">
              <div className="flex justify-between items-center text-[10px] font-bold text-text-muted uppercase tracking-wider">
                 <span>{plan.completed_items || 0}/{plan.total_items || 0} tarefas</span>
                 <span>{plan.progress || 0}%</span>
              </div>
              <div className="w-full bg-surface-3 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-brand-primary h-full transition-all duration-500 rounded-full" 
                  style={{ width: `${plan.progress || 0}%` }} 
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-1 pt-3 border-t border-surface-3 mt-1">
              <Link href={`/learning/${plan.id}`} className="mr-auto">
                 <Button variant="ghost" size="sm" className="h-8 text-brand-primary hover:bg-brand-primary/10 gap-1.5 font-medium px-2 group">
                    <Play className="h-3.5 w-3.5 fill-brand-primary/20 group-hover:fill-brand-primary transition-colors" /> {plan.status === 'completed' ? 'Revisar' : 'Continuar'}
                 </Button>
              </Link>
              <Link href={`/learning/${plan.id}/edit`}>
                 <Button variant="ghost" size="icon" className="h-8 w-8 text-text-secondary hover:bg-surface-3" title="Editar Estrutura">
                    <Pencil className="h-4 w-4" />
                 </Button>
              </Link>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-danger hover:bg-danger/10"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPlanToDelete(plan);
                }}
                title="Excluir Plano"
              >
                 <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="hidden md:block p-0">
        <Card className="p-0 overflow-hidden">
          <DataTable
            columns={columns}
            data={plans}
            emptyTitle="Nenhum plano encontrado"
            emptyDescription="Você ainda não tem nenhum plano de estudo. Que tal criar um novo plano estruturado em dias?"
            emptyAction={emptyAction}
          />
        </Card>
      </div>

      <Modal
        isOpen={!!planToDelete}
        onClose={() => setPlanToDelete(null)}
        title="Excluir Plano"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">Esta ação não pode ser desfeita. Todo o progresso e notas serão perdidos.</p>
          </div>
          <p className="text-sm text-text-secondary">
            Deseja realmente excluir o plano <span className="font-bold text-text-primary">"{planToDelete?.title}"</span>?
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setPlanToDelete(null)} disabled={isDeleting}>Cancelar</Button>
            <Button variant="primary" onClick={handleDelete} className="bg-danger hover:bg-danger-hover border-danger" disabled={isDeleting}>
              {isDeleting ? 'Excluindo...' : 'Sim, Excluir'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
