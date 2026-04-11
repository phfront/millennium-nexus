'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Textarea, Card, Badge, Checkbox } from '@phfront/millennium-ui';
import { FileText, LayoutTemplate, Copy, Check, Trash2 } from 'lucide-react';
import { saveFullLearningPlan } from '@/app/learning/actions';
import { parseMarkdownToPlan, planToMarkdown, ParsedPlan } from '@/lib/learningMarkdownParser';
import dynamic from 'next/dynamic';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const MDEditor = dynamic(
  () => import('@uiw/react-md-editor'),
  { ssr: false }
);

interface PlanManagerClientProps {
  plan: any;
}

export function PlanManagerClient({ plan }: PlanManagerClientProps) {
  const router = useRouter();
  
  // Transform existing plan to ParsedPlan structure
  const initialSections = (plan.sections || []).map((s: any) => ({
    title: s.title,
    days: (plan.days || []).filter((d: any) => d.section_id === s.id).map((d: any) => ({
      day_number: d.day_number,
      title: d.title || `Dia ${d.day_number}`,
      content_prompt: d.content_prompt || '',
      items: (d.items || []).map((i: any) => ({
        title: i.title,
        is_completed: i.is_completed,
        description: i.description || ''
      }))
    }))
  }));

  const initialUnsectioned = (plan.days || []).filter((d: any) => !d.section_id).map((d: any) => ({
     day_number: d.day_number,
     title: d.title || `Dia ${d.day_number}`,
     content_prompt: d.content_prompt || '',
     items: (d.items || []).map((i: any) => ({
       title: i.title,
       is_completed: i.is_completed,
       description: i.description || ''
     }))
  }));

  const initialParsedPlan: ParsedPlan = {
     sections: initialSections,
     unsectionedDays: initialUnsectioned
  };

  const initialMarkdown = planToMarkdown(initialParsedPlan.sections, initialParsedPlan.unsectionedDays);

  const [activeTab, setActiveTab] = useState<'visual' | 'markdown'>('markdown');
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [parsedPlan, setParsedPlan] = useState<ParsedPlan>(initialParsedPlan);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmAction, setShowConfirmAction] = useState(false);

  // Sync back and forth
  useEffect(() => {
    if (activeTab === 'visual') {
      try {
        const parsed = parseMarkdownToPlan(markdown);
        setParsedPlan(parsed);
      } catch (e) {
        console.error('Error parsing markdown', e);
      }
    }
  }, [activeTab, markdown]);

  // We are keeping UI simple: when in Visual mode, the markdown is the source of truth, 
  // but if we wanted full 2-way dragging, we would sync both. Here, given they want markdown power, 
  // we let Markdown be the master, and the Visual just a preview for now.
  // Wait, the requirement was "editar o plano inteiro e ter um botao salvar, basicamente duas visoes, visao dos componentes e visao editor markdown".
  // Let's implement editing in Visual as making changes to parsedPlan, and when switching to Markdown, we stringify it back.
  
  const handleTabSwitch = (tab: 'visual' | 'markdown') => {
    if (tab === 'markdown' && activeTab === 'visual') {
      // Sync from visual to markdown
      const md = planToMarkdown(parsedPlan.sections, parsedPlan.unsectionedDays);
      setMarkdown(md);
    }
    setActiveTab(tab);
  };

  const updateVisualDay = (sectionIdx: number | null, dayIdx: number, field: string, value: string) => {
     setParsedPlan(prev => {
        const copy = JSON.parse(JSON.stringify(prev));
        if (sectionIdx === null) {
           copy.unsectionedDays[dayIdx][field] = value;
        } else {
           copy.sections[sectionIdx].days[dayIdx][field] = value;
        }
        return copy;
     });
  };

  const updateVisualItem = (sectionIdx: number | null, dayIdx: number, itemIdx: number, field: string, value: any) => {
     setParsedPlan(prev => {
        const copy = JSON.parse(JSON.stringify(prev));
        if (sectionIdx === null) {
           copy.unsectionedDays[dayIdx].items[itemIdx][field] = value;
        } else {
           copy.sections[sectionIdx].days[dayIdx].items[itemIdx][field] = value;
        }
        return copy;
     });
  };

  const addVisualItem = (sectionIdx: number | null, dayIdx: number) => {
     setParsedPlan(prev => {
        const copy = JSON.parse(JSON.stringify(prev));
        if (sectionIdx === null) {
           copy.unsectionedDays[dayIdx].items.push({ title: '', is_completed: false, description: '' });
        } else {
           copy.sections[sectionIdx].days[dayIdx].items.push({ title: '', is_completed: false, description: '' });
        }
        return copy;
     });
  };

  const removeVisualItem = (sectionIdx: number | null, dayIdx: number, itemIdx: number) => {
     setParsedPlan(prev => {
        const copy = JSON.parse(JSON.stringify(prev));
        if (sectionIdx === null) {
           copy.unsectionedDays[dayIdx].items.splice(itemIdx, 1);
        } else {
           copy.sections[sectionIdx].days[dayIdx].items.splice(itemIdx, 1);
        }
        return copy;
     });
  };

  const handleSave = () => {
    // Show confirm if it's destructive? The user said "pode deletar, mas exiba modal".
    // We don't have a built-in Modal component in the UI snippet, so we simulate a confirm state or use standard window.confirm.
    setShowConfirmAction(true);
  };

  const confirmSave = async () => {
    setShowConfirmAction(false);
    setIsSaving(true);
    try {
      let finalPlanToSave = parsedPlan;
      if (activeTab === 'markdown') {
        finalPlanToSave = parseMarkdownToPlan(markdown);
      }
      await saveFullLearningPlan(plan.id, finalPlanToSave);
      router.push(`/learning/${plan.id}`);
    } catch (e) {
      alert('Erro ao salvar o plano.');
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <Button
          onClick={() => handleTabSwitch('visual')}
          variant={activeTab === 'visual' ? 'primary' : 'outline'}
        >
          <LayoutTemplate className="w-4 h-4 mr-2" /> Visual
        </Button>
        <Button
          onClick={() => handleTabSwitch('markdown')}
          variant={activeTab === 'markdown' ? 'primary' : 'outline'}
        >
          <FileText className="w-4 h-4 mr-2" /> Markdown
        </Button>
      </div>

      {activeTab === 'markdown' && (
         <div className="space-y-2">
            <p className="text-sm text-text-secondary mb-2">Utilize `#` para Semanas/Módulos, `## Dia X: Titulo` para Dias e `- [ ]` para tarefas. A identação sob uma tarefa representa sua descrição.</p>
            <div data-color-mode="dark">
              <MDEditor 
                 height={600}
                 value={markdown}
                 onChange={val => setMarkdown(val || '')}
              />
            </div>
         </div>
      )}

      {activeTab === 'visual' && (
         <div className="space-y-8">
            {parsedPlan.unsectionedDays.length > 0 && (
              <div className="space-y-4">
                 <Badge>Abertos (Sem Módulo)</Badge>
                 {parsedPlan.unsectionedDays.map((day, dIdx) => (
                    <DayEditorCard 
                      key={`unsec-${dIdx}`} 
                      day={day} 
                      onChange={(f: string, v: any) => updateVisualDay(null, dIdx, f, v)}
                      onItemChange={(iIdx: number, f: string, v: any) => updateVisualItem(null, dIdx, iIdx, f, v)}
                      onAddItem={() => addVisualItem(null, dIdx)}
                      onRemoveItem={(iIdx: number) => removeVisualItem(null, dIdx, iIdx)}
                    />
                 ))}
              </div>
            )}
            {parsedPlan.sections.map((sec, sIdx) => (
              <div key={`sec-${sIdx}`} className="space-y-4">
                 <h2 className="text-xl font-bold border-b border-border pb-2 text-brand-primary">
                    <Input value={sec.title} onChange={e => {
                      const newP = {...parsedPlan};
                      newP.sections[sIdx].title = e.target.value;
                      setParsedPlan(newP);
                    }} className="bg-transparent border-none text-xl font-bold px-0 focus:ring-0 w-full" />
                 </h2>
                 {sec.days.map((day, dIdx) => (
                    <DayEditorCard 
                      key={`sec-${sIdx}-day-${dIdx}`} 
                      day={day} 
                      onChange={(f: string, v: any) => updateVisualDay(sIdx, dIdx, f, v)}
                      onItemChange={(iIdx: number, f: string, v: any) => updateVisualItem(sIdx, dIdx, iIdx, f, v)}
                      onAddItem={() => addVisualItem(sIdx, dIdx)}
                      onRemoveItem={(iIdx: number) => removeVisualItem(sIdx, dIdx, iIdx)}
                    />
                 ))}
              </div>
            ))}
            {parsedPlan.sections.length === 0 && parsedPlan.unsectionedDays.length === 0 && (
              <p className="text-center text-text-muted py-8">Nenhum dado encontrado. Tente inserir no modo Markdown!</p>
            )}
         </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface-1 border-t border-border flex justify-end z-40">
         <div className="w-full max-w-4xl mx-auto flex justify-end gap-4">
           {showConfirmAction ? (
              <div className="flex items-center gap-3 animate-fade-in bg-danger/10 text-danger px-4 py-1.5 rounded-md border border-danger/20">
                <span className="text-sm font-semibold">Tem certeza? Dias excluídos do texto perderão todo o progresso (anotações).</span>
                <Button size="sm" variant="outline" onClick={() => setShowConfirmAction(false)}>Cancelar</Button>
                <Button size="sm" onClick={confirmSave} disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar e Sobrescrever'}</Button>
              </div>
           ) : (
              <>
                 <Button variant="outline" onClick={() => router.push(`/learning/${plan.id}`)}>Cancelar</Button>
                 <Button onClick={handleSave}>Salvar Alterações Globais</Button>
              </>
           )}
         </div>
      </div>
    </div>
  );
}

function DayEditorCard({ day, onChange, onItemChange, onAddItem, onRemoveItem }: any) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex gap-2">
         <Badge className="shrink-0 flex items-center justify-center">Dia {day.day_number}</Badge>
         <Input value={day.title} onChange={e => onChange('title', e.target.value)} placeholder="Título do Dia" className="w-full font-bold" />
      </div>
      
      <div>
         <label className="text-xs text-text-muted font-medium mb-1 block">Instruções / Conteúdo Explicativo:</label>
         <div data-color-mode="dark">
           <MDEditor value={day.content_prompt} onChange={val => onChange('content_prompt', val || '')} height={150} preview="edit" />
         </div>
      </div>
      
      <div className="bg-surface-2 rounded-md p-3 space-y-3 mt-4 border border-border">
         <div className="flex justify-between items-center mb-2">
            <label className="text-xs text-text-muted font-bold uppercase tracking-wide">Tarefas ({day.items?.length || 0})</label>
            <Button variant="ghost" size="sm" onClick={onAddItem}>+ Nova Tarefa</Button>
         </div>
         {day.items?.map((item: any, idx: number) => (
           <div key={idx} className="flex gap-2 items-start border-l-2 border-brand-primary pl-2 mb-4">
             <Checkbox checked={item.is_completed} onCheckedChange={checked => onItemChange(idx, 'is_completed', checked)} className="mt-2" />
             <div className="w-full space-y-2">
                <div className="flex gap-2 items-center">
                  <Input value={item.title} onChange={e => onItemChange(idx, 'title', e.target.value)} placeholder="Título da Tarefa" size="sm" className="w-full" />
                  <Button variant="ghost" size="icon" onClick={() => onRemoveItem(idx)} className="text-danger hover:bg-danger/10 flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div data-color-mode="dark">
                  <MDEditor value={item.description || ''} onChange={val => onItemChange(idx, 'description', val || '')} height={100} preview="edit" />
                </div>
             </div>
           </div>
         ))}
      </div>
    </Card>
  );
}
