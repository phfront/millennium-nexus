import { fetchLearningPlans } from './actions';
import { Card, Button, Badge } from '@phfront/millennium-ui';
import { Target, Plus, Calendar, Clock } from 'lucide-react';
import Link from 'next/link';

export default async function LearningDashboard() {
  const plans = await fetchLearningPlans();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Meus Planos de Aprendizado</h2>
          <p className="text-text-secondary mt-1">Acompanhe seu progresso dia a dia.</p>
        </div>
        <Link href="/learning/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Plano
          </Button>
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 mt-8 border border-dashed border-border rounded-xl bg-surface-2/50 text-center">
          <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center mb-4">
            <Target className="h-8 w-8 text-brand-primary" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Nenhum plano encontrado</h3>
          <p className="text-text-secondary max-w-sm mb-6">
            Você ainda não tem nenhum plano de estudo. Que tal criar um novo plano estruturado em dias?
          </p>
          <Link href="/learning/create">
            <Button variant="outline">Começar um Plano</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan: any) => (
            <Link key={plan.id} href={`/learning/${plan.id}`}>
              <Card className="flex flex-col h-full hover:border-brand-primary/50 transition-colors cursor-pointer group">
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-surface-3 rounded-lg group-hover:bg-brand-primary/10 transition-colors">
                      <Target className="h-5 w-5 text-brand-primary" />
                    </div>
                    {plan.status === 'completed' ? (
                      <Badge variant="success">Concluído</Badge>
                    ) : plan.status === 'in_progress' ? (
                      <Badge variant="accent">Em Andamento</Badge>
                    ) : (
                      <Badge variant="default">Planejamento</Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg text-text-primary mb-2 line-clamp-2">
                    {plan.title}
                  </h3>
                  {plan.description && (
                    <p className="text-sm text-text-secondary line-clamp-3 mb-4 flex-1">
                      {plan.description}
                    </p>
                  )}
                  
                  <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-xs text-text-secondary">
                    <div className="flex items-center gap-1">
                      {plan.scheduling_type === 'calendar' ? <Calendar className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      <span>{plan.scheduling_type === 'calendar' ? 'Data Fixa' : 'Ritmo Livre'}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
