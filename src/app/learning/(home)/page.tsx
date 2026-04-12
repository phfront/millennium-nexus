import Link from 'next/link';
import { Button, Card, Badge } from '@phfront/millennium-ui';
import { Plus, Target, Calendar, BookOpen, ArrowRight } from 'lucide-react';
import { fetchLearningPlans } from '../actions';

export default async function LearningHomePage() {
  const plans = await fetchLearningPlans();

  const activePlans = plans.filter((p: any) => p.status === 'in_progress');
  const completedPlans = plans.filter((p: any) => p.status === 'completed');
  const planningPlans = plans.filter((p: any) => p.status === 'planning');

  const activePlansList = activePlans.slice(0, 3);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Aprendizado</h2>
          <p className="text-text-secondary mt-1">Gerencie seus planos de estudo e acompanhe seu progresso.</p>
        </div>
        <Link href="/learning/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Plano
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-primary/10 rounded-lg">
              <BookOpen className="h-5 w-5 text-brand-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{activePlans.length}</p>
              <p className="text-sm text-text-secondary">Planos Ativos</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-bg rounded-lg">
              <Target className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{completedPlans.length}</p>
              <p className="text-sm text-text-secondary">Concluídos</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-surface-3 rounded-lg">
              <Calendar className="h-5 w-5 text-text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{planningPlans.length}</p>
              <p className="text-sm text-text-secondary">Em Planejamento</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Plans */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Planos Ativos</h3>
          <Link href="/learning/plans">
            <Button variant="outline" size="sm">
              Ver Todos
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>

        {activePlansList.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center mx-auto mb-4">
              <Target className="h-8 w-8 text-brand-primary" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">Nenhum plano ativo</h3>
            <p className="text-text-secondary max-w-sm mx-auto mb-6">
              Você não tem planos de estudo em andamento. Inicie um plano ou crie um novo.
            </p>
            <Link href="/learning/create">
              <Button>Criar Primeiro Plano</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePlansList.map((plan: any) => (
              <Link key={plan.id} href={`/learning/${plan.id}`}>
                <Card className="p-4 hover:border-brand-primary/50 transition-colors cursor-pointer group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2 bg-surface-3 rounded-lg group-hover:bg-brand-primary/10 transition-colors">
                      <Target className="h-4 w-4 text-brand-primary" />
                    </div>
                    {plan.status === 'completed' ? (
                      <Badge variant="success">Concluído</Badge>
                    ) : plan.status === 'in_progress' ? (
                      <Badge variant="info">Em Andamento</Badge>
                    ) : (
                      <Badge variant="muted">Planejamento</Badge>
                    )}
                  </div>
                  <h4 className="font-medium text-text-primary line-clamp-2">{plan.title}</h4>
                  {plan.description && (
                    <p className="text-sm text-text-secondary line-clamp-2 mt-1">{plan.description}</p>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
