'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button, Checkbox, useToast } from '@phfront/millennium-ui';
import { toggleDayItem, updateDayNotes, updateItemNotes, completeDay } from '@/app/learning/actions';
import { CheckCircle2, Circle } from 'lucide-react';
import type { LearningPlanDayWithItems, LearningDayItem } from '@/types/learning';
import dynamic from 'next/dynamic';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const MDEditor = dynamic(
  () => import('@uiw/react-md-editor'),
  { ssr: false }
);

const MarkdownPreview = dynamic(
  () => import('@uiw/react-markdown-preview'),
  { ssr: false }
);

export function DayExecutionClient({ day, planId }: { day: LearningPlanDayWithItems, planId: string }) {
  const router = useRouter();
  
  // Local state for optimistic updates
  const [items, setItems] = useState<LearningDayItem[]>(
    [...(day.items || [])].sort((a, b) => a.order_index - b.order_index)
  );
  const [notes, setNotes] = useState(day.user_notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleted, setIsCompleted] = useState(day.is_completed);
  const { toast } = useToast();

  const handleToggleItem = async (itemId: string, currentStatus: boolean) => {
    // Optimistic update
    setItems(items.map(i => i.id === itemId ? { ...i, is_completed: !currentStatus } : i));
    try {
      await toggleDayItem(itemId, !currentStatus);
    } catch (err) {
      console.error(err);
      // Revert if error
      setItems(items.map(i => i.id === itemId ? { ...i, is_completed: currentStatus } : i));
    }
  };

  const handleSaveNotes = async (value: string) => {
    setNotes(value);
    setIsSaving(true);
    try {
      await updateDayNotes(day.id, value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveItemNotes = async (itemId: string, value: string) => {
    setItems(items.map(i => i.id === itemId ? { ...i, user_notes: value } : i));
    try {
      await updateItemNotes(itemId, value);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteDay = async () => {
    const newStatus = !isCompleted;
    setIsCompleted(newStatus);
    try {
      await completeDay(day.id, newStatus);
      if (newStatus) {
         // Optionally confetti or just redirect back
         router.push(`/learning/${planId}`);
      }
    } catch (err) {
      console.error(err);
      setIsCompleted(!newStatus);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <span className="text-brand-primary font-bold text-sm tracking-wider uppercase mb-1 block">Dia {day.day_number}</span>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary">{day.title || 'Sessão de Estudo'}</h1>
        </div>
      </div>

      {day.content_prompt && (
        <Card className="p-6 bg-surface-2 border-dashed">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Instruções / Contexto</h3>
          <div className="prose prose-sm prose-invert max-w-none text-text-primary">
             {/* Simple pre-wrap for now, ideally react-markdown */}
             <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
               {day.content_prompt}
             </div>
          </div>
        </Card>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-brand-primary" />
            Checklist do Dia
          </h3>
          <Card className="divide-y divide-border overflow-hidden">
            {items.map((item) => (
              <div key={item.id} className="p-4 hover:bg-surface-2 transition-colors group border-b border-border last:border-0">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleToggleItem(item.id, item.is_completed)}>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                       checked={item.is_completed}
                       onCheckedChange={() => handleToggleItem(item.id, item.is_completed)}
                    />
                  </div>
                  <span className={`text-base font-medium select-none transition-colors ${item.is_completed ? 'text-text-muted line-through' : 'text-text-primary group-hover:text-brand-primary'}`}>
                    {item.title}
                  </span>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm text-brand-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                      Link
                    </a>
                  )}
                </div>
                {item.description && (
                  <div
                    className={`mt-2 pl-8 prose prose-sm max-w-none text-xs leading-relaxed cursor-pointer ${item.is_completed ? 'text-text-muted' : 'text-text-secondary'}`}
                    onClick={() => {
                      navigator.clipboard.writeText(item.description || '');
                      toast.success('Copiado para a área de transferência');
                    }}
                  >
                    <MarkdownPreview source={item.description} style={{ background: 'transparent', pointerEvents: 'none' }} />
                  </div>
                )}
                <div className="mt-3 pl-8">
                  <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1 block">Anotações</label>
                  <EditableRichText
                    value={item.user_notes || ''}
                    onSave={(val) => handleSaveItemNotes(item.id, val)}
                    height={150}
                    placeholder="Clique para adicionar anotações..."
                  />
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">Anotações / Respostas</h3>
        <Card className="p-4" data-color-mode="dark">
          <EditableRichText
            value={notes}
            onSave={handleSaveNotes}
            height={300}
            placeholder="Clique para adicionar anotações gerais do dia..."
          />
          <div className="flex justify-end mt-2">
            <span className="text-xs text-text-muted">{isSaving ? 'Salvando...' : ''}</span>
          </div>
        </Card>
      </div>

      <div className="fixed bottom-0 md:bottom-6 left-0 right-0 p-4 md:px-0 bg-surface-1 md:bg-transparent border-t border-border md:border-t-0 z-40 md:relative flex justify-end">
        <div className="w-full md:w-auto max-w-3xl mx-auto md:mx-0 flex justify-end">
           <Button 
             size="lg" 
             className="w-full md:w-auto font-semibold"
             variant={isCompleted ? 'outline' : 'primary'}
             onClick={handleCompleteDay}
           >
             {isCompleted ? 'Desmarcar Conclusão' : 'Concluir Dia de Estudo'}
           </Button>
        </div>
      </div>
    </div>
  );
}

function EditableRichText({ value, onSave, height = 150, placeholder = 'Clique para adicionar conteúdo...' }: { value: string; onSave: (val: string) => void; height?: number; placeholder?: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-2" data-color-mode="dark">
        <MDEditor
          value={editValue}
          onChange={(val) => setEditValue(val || '')}
          height={height}
          preview="edit"
        />
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={handleCancel}>Cancelar</Button>
          <Button size="sm" onClick={handleSave}>Salvar</Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative rounded-md border border-border bg-surface-1/50 min-h-[60px] p-3 cursor-pointer hover:border-brand-primary/50 transition-colors"
      onClick={() => { setEditValue(value); setIsEditing(true); }}
    >
      {value ? (
        <div data-color-mode="dark">
          <MarkdownPreview source={value} style={{ background: 'transparent' }} />
        </div>
      ) : (
        <p className="text-text-muted text-sm italic">{placeholder}</p>
      )}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditValue(value); setIsEditing(true); }}>
          Editar
        </Button>
      </div>
    </div>
  );
}
