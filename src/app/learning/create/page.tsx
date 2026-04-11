'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Input, Textarea, Select } from '@phfront/millennium-ui';
import { createLearningPlan } from '../actions';

export default function CreateLearningPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [schedulingType, setSchedulingType] = useState('relative');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);
      const plan = await createLearningPlan(formData);
      router.push(`/learning/${plan.id}`);
    } catch (err) {
      console.error(err);
      alert('Erro ao criar plano.');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">Novo Plano de Aprendizado</h2>
        <p className="text-text-secondary mt-1">Crie a estrutura base do seu plano. Depois você poderá organizar os dias e as tarefas.</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="title" className="text-sm font-medium text-text-primary">Título do Plano</label>
            <Input 
              id="title" 
              name="title" 
              placeholder="Ex: Plano de 30 dias — Crypto + Trading" 
              required 
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="description" className="text-sm font-medium text-text-primary">Descrição / Objetivo</label>
            <Textarea 
              id="description" 
              name="description" 
              placeholder="Desenvolver repertório de mercado crypto, trading e produto..." 
              rows={4}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">Tipo de Agendamento</label>
            <input type="hidden" name="scheduling_type" value={schedulingType} />
            <Select 
              options={[
                { value: 'relative', label: 'Ritmo Livre (Dia 1, Dia 2, sem forçar data fixa)' },
                { value: 'calendar', label: 'Calendário (Dias fixos na agenda)' }
              ]} 
              value={schedulingType}
              onChange={setSchedulingType}
              placeholder="Selecione..."
            />
            <p className="text-xs text-text-secondary mt-1">
              "Ritmo Livre" não te penaliza se você ficar dias sem estudar. Sempre que voltar, fará o próximo dia do plano.
            </p>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="outline" type="button" onClick={() => router.back()} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Plano e Adicionar Dias'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
