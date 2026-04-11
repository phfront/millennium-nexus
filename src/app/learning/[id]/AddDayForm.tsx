'use client';

import { useState } from 'react';
import { Button, Input, Textarea, Card } from '@phfront/millennium-ui';
import { Plus } from 'lucide-react';
import { addLearningDay } from '@/app/learning/actions';
import { useParams } from 'next/navigation';

export function AddDayForm({ nextDayNumber }: { nextDayNumber: number }) {
  const params = useParams();
  const planId = params.id as string;
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const dayNumber = parseInt(formData.get('day_number') as string);
    const title = formData.get('title') as string;
    const prompt = formData.get('content_prompt') as string;

    try {
      await addLearningDay(planId, null, dayNumber, title, prompt);
      setIsOpen(false);
    } catch (err) {
      alert('Erro ao adicionar dia.');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <div className="flex justify-center mt-8">
        <Button onClick={() => setIsOpen(true)} variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Novo Dia
        </Button>
      </div>
    );
  }

  return (
    <Card className="p-6 mt-8 max-w-lg mx-auto">
      <h3 className="text-lg font-semibold text-text-primary mb-4">Adicionar Novo Dia</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-1 space-y-1">
             <label className="text-sm font-medium text-text-primary">Dia</label>
             <Input name="day_number" type="number" defaultValue={nextDayNumber} required min={1} />
          </div>
          <div className="col-span-3 space-y-1">
             <label className="text-sm font-medium text-text-primary">Título</label>
             <Input name="title" placeholder="Ex: O que é crypto de verdade" required />
          </div>
        </div>

        <div className="space-y-1">
            <label className="text-sm font-medium text-text-primary">Instruções / Conteúdo</label>
            <Textarea 
              name="content_prompt" 
              placeholder="(Opcional) Texto em markdown de apoio para esse dia" 
              rows={4}
            />
        </div>
        
        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-4">
          <Button variant="outline" type="button" onClick={() => setIsOpen(false)} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Adicionar Dia'}</Button>
        </div>
      </form>
    </Card>
  );
}
