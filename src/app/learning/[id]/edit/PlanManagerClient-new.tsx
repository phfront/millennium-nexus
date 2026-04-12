'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Textarea, Card, Badge, Checkbox } from '@phfront/millennium-ui';
import { FileText, LayoutTemplate, Copy, Check, Trash2, Plus, FolderPlus, CalendarPlus, GripVertical } from 'lucide-react';
import { saveFullLearningPlan } from '@/app/learning/actions';
import { parseMarkdownToPlan, planToMarkdown, ParsedPlan, ParsedDay } from '@/lib/learningMarkdownParser';
import dynamic from 'next/dynamic';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const MDEditor = dynamic(
  () => import('@uiw/react-md-editor'),
  { ssr: false }
);

const MarkdownPreview = dynamic(
  () => import('@uiw/react-markdown-preview'),
  { ssr: false }
);

interface PlanManagerClientProps {
  plan: any;
  schedulingType?: 'relative' | 'calendar';
}

export function PlanManagerClient({ plan, schedulingType = 'relative' }: PlanManagerClientProps) {
  const router = useRouter();
  
  // Transform existing plan to ParsedPlan structure
  const initialSections = (plan.sections || []).map((s: any) => ({
    title: s.title,
    days: (plan.days || []).filter((d: any) => d.section_id === s.id).map((d: any, idx: number) => ({
      day_number: idx + 1,
      scheduled_date: d.scheduled_date ?? null,
      title: d.title || `Dia ${idx + 1}`,
      content_prompt: d.content_prompt || '',
      items: (d.items || []).map((i: any) => ({
        title: i.title,
        is_completed: i.is_completed,
        description: i.description || ''
      }))
    }))
  }));

  const initialUnsectioned = (plan.days || []).filter((d: any) => !d.section_id).map((d: any, idx: number) => ({
     day_number: idx + 1,
     scheduled_date: d.scheduled_date ?? null,
     title: d.title || `Dia ${idx + 1}`,
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

  const [parsedPlan, setParsedPlan] = useState<ParsedPlan>(initialParsedPlan);
  const [markdown, setMarkdown] = useState(planToMarkdown(initialSections, initialUnsectioned));
  const [activeTab, setActiveTab] = useState<'visual' | 'markdown'>('visual');
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmAction, setShowConfirmAction] = useState(false);

  // Keep markdown in sync when visual changes (for preview purposes)
  useEffect(() => {
     if (activeTab === 'visual') {
        setMarkdown(planToMarkdown(parsedPlan.sections, parsedPlan.unsectionedDays));
     }
  }, [parsedPlan, activeTab]);

  const handleTabSwitch = (tab: 'visual' | 'markdown') => {
     if (tab === 'markdown' && activeTab === 'visual') {
        // Convert visual to markdown
        setMarkdown(planToMarkdown(parsedPlan.sections, parsedPlan.unsectionedDays));
     }
     setActiveTab(tab);
  };

  const addSection = () => {
    setParsedPlan(prev => ({
       ...prev,
       sections: [...prev.sections, { title: 'Novo Módulo', days: [] }]
    }));
  };

  const removeSection = (sectionIdx: number) => {
    setParsedPlan(prev => {
       const copy = JSON.parse(JSON.stringify(prev));
       copy.sections.splice(sectionIdx, 1);
       return copy;
    });
  };

  const addDay = (sectionIdx: number | null) => {
    setParsedPlan(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const allDays = [...copy.unsectionedDays, ...copy.sections.flatMap((s: any) => s.days)];
      const maxDayNumber = allDays.length > 0 
        ? Math.max(...allDays.map((d: any) => d.day_number)) 
        : 0;
      
      const newDay = {
        day_number: maxDayNumber + 1,
        scheduled_date: null as string | null,
        title: `Dia ${maxDayNumber + 1}`,
        content_prompt: '',
        items: []
      };

      if (sectionIdx === null) {
        copy.unsectionedDays.push(newDay);
      } else {
        copy.sections[sectionIdx].days.push(newDay);
      }
      return copy;
    });
  };

  const removeDay = (sectionIdx: number | null, dayIdx: number) => {
    setParsedPlan(prev => {
       const copy = JSON.parse(JSON.stringify(prev));
       if (sectionIdx === null) {
          copy.unsectionedDays.splice(dayIdx, 1);
          // Recalculate day numbers
          copy.unsectionedDays.forEach((d: ParsedDay, i: number) => {
            d.day_number = i + 1;
          });
       } else {
          copy.sections[sectionIdx].days.splice(dayIdx, 1);
          // Recalculate day numbers
          copy.sections[sectionIdx].days.forEach((d: ParsedDay, i: number) => {
            d.day_number = i + 1;
          });
       }
       return copy;
    });
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

  // Reordering functions
  const reorderItems = (sectionIdx: number | null, dayIdx: number, oldIndex: number, newIndex: number) => {
    setParsedPlan(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const items = sectionIdx === null 
        ? copy.unsectionedDays[dayIdx].items 
        : copy.sections[sectionIdx].days[dayIdx].items;
      const [moved] = items.splice(oldIndex, 1);
      items.splice(newIndex, 0, moved);
      return copy;
    });
  };

  const reorderUnsectionedDays = (oldIndex: number, newIndex: number) => {
    setParsedPlan(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const [moved] = copy.unsectionedDays.splice(oldIndex, 1);
      copy.unsectionedDays.splice(newIndex, 0, moved);
      // Recalculate day numbers
      copy.unsectionedDays.forEach((d: ParsedDay, i: number) => {
        d.day_number = i + 1;
      });
      return copy;
    });
  };

  const reorderSectionDays = (sectionIdx: number, oldIndex: number, newIndex: number) => {
    setParsedPlan(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const days = copy.sections[sectionIdx].days;
      const [moved] = days.splice(oldIndex, 1);
      days.splice(newIndex, 0, moved);
      // Recalculate day numbers
      days.forEach((d: ParsedDay, i: number) => {
        d.day_number = i + 1;
      });
      return copy;
    });
  };

  const moveDayBetweenSections = (fromSectionIdx: number | null, fromDayIdx: number, toSectionIdx: number | null, toDayIdx: number) => {
    setParsedPlan(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const fromDays = fromSectionIdx === null ? copy.unsectionedDays : copy.sections[fromSectionIdx].days;
      const toDays = toSectionIdx === null ? copy.unsectionedDays : copy.sections[toSectionIdx].days;
      
      const [moved] = fromDays.splice(fromDayIdx, 1);
      toDays.splice(toDayIdx, 0, moved);
      
      // Recalculate day numbers in both sections
      fromDays.forEach((d: ParsedDay, i: number) => { d.day_number = i + 1; });
      toDays.forEach((d: ParsedDay, i: number) => { d.day_number = i + 1; });
      
      return copy;
    });
  };

  const reorderSections = (oldIndex: number, newIndex: number) => {
    setParsedPlan(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const [moved] = copy.sections.splice(oldIndex, 1);
      copy.sections.splice(newIndex, 0, moved);
      return copy;
    });
  };

  const handleSave = () => {
    if (activeTab === 'markdown') {
      // Parse markdown and set as visual
      const parsed = parseMarkdownToPlan(markdown);
      setParsedPlan(parsed);
    }
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
    } finally {
      setIsSaving(false);
    }
  };

  // Sensors for DndContext
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
            {/* Botões de ação globais */}
            <div className="flex gap-3 pb-4 border-b border-border">
               <Button onClick={addSection} variant="outline" className="gap-2">
                  <FolderPlus className="w-4 h-4" />
                  Novo Módulo
               </Button>
               <Button onClick={() => addDay(null)} variant="outline" className="gap-2">
                  <CalendarPlus className="w-4 h-4" />
                  Novo Dia (Sem Módulo)
               </Button>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event: DragEndEvent) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;

                const activeId = String(active.id);
                const overId = String(over.id);

                // Handle section reordering
                if (activeId.startsWith('sec-') && !activeId.includes('-day-') && overId.startsWith('sec-') && !overId.includes('-day-')) {
                  const oldIndex = parseInt(activeId.replace('sec-', ''));
                  const newIndex = parseInt(overId.replace('sec-', ''));
                  reorderSections(oldIndex, newIndex);
                  return;
                }

                // Handle day reordering within unsectioned
                if (activeId.startsWith('unsec-day-') && overId.startsWith('unsec-day-')) {
                  const oldIndex = parseInt(activeId.replace('unsec-day-', ''));
                  const newIndex = parseInt(overId.replace('unsec-day-', ''));
                  reorderUnsectionedDays(oldIndex, newIndex);
                  return;
                }

                // Handle day reordering within sections
                if (activeId.includes('-day-') && overId.includes('-day-')) {
                  const activeMatch = activeId.match(/sec-(\d+)-day-(\d+)/);
                  const overMatch = overId.match(/sec-(\d+)-day-(\d+)/);
                  
                  if (activeMatch && overMatch) {
                    const activeSecIdx = parseInt(activeMatch[1]);
                    const overSecIdx = parseInt(overMatch[1]);
                    const activeDayIdx = parseInt(activeMatch[2]);
                    const overDayIdx = parseInt(overMatch[2]);
                    
                    if (activeSecIdx === overSecIdx) {
                      reorderSectionDays(activeSecIdx, activeDayIdx, overDayIdx);
                    } else {
                      moveDayBetweenSections(activeSecIdx, activeDayIdx, overSecIdx, overDayIdx);
                    }
                  }
                }
              }}
            >
              <SortableContext
                items={[
                  ...parsedPlan.sections.map((_, i) => `sec-${i}`),
                  ...parsedPlan.unsectionedDays.map((_, i) => `unsec-day-${i}`),
                  ...parsedPlan.sections.flatMap((sec, si) => sec.days.map((_, di) => `sec-${si}-day-${di}`))
                ]}
                strategy={verticalListSortingStrategy}
              >
                {parsedPlan.unsectionedDays.length > 0 && (
                  <div className="space-y-4 pl-6">
                     <div className="flex items-center justify-between">
                        <Badge>Abertos (Sem Módulo)</Badge>
                        <Button onClick={() => addDay(null)} size="sm" variant="ghost" className="gap-1">
                           <Plus className="w-4 h-4" /> Adicionar Dia
                        </Button>
                     </div>
                     <SortableContext
                       items={parsedPlan.unsectionedDays.map((_, i) => `unsec-day-${i}`)}
                       strategy={verticalListSortingStrategy}
                     >
                       {parsedPlan.unsectionedDays.map((day: any, dIdx: number) => (
                          <SortableDayCard 
                            key={`unsec-day-${dIdx}`} 
                            id={`unsec-day-${dIdx}`}
                            day={day} 
                            schedulingType={schedulingType}
                            onChange={(f: string, v: any) => updateVisualDay(null, dIdx, f, v)}
                            onItemChange={(iIdx: number, f: string, v: any) => updateVisualItem(null, dIdx, iIdx, f, v)}
                            onAddItem={() => addVisualItem(null, dIdx)}
                            onRemoveItem={(iIdx: number) => removeVisualItem(null, dIdx, iIdx)}
                            onRemoveDay={() => removeDay(null, dIdx)}
                            onItemsReorder={(oldIdx: number, newIdx: number) => reorderItems(null, dIdx, oldIdx, newIdx)}
                          />
                       ))}
                     </SortableContext>
                  </div>
                )}

                <SortableContext
                  items={parsedPlan.sections.map((_, i) => `sec-${i}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {parsedPlan.sections.map((sec, sIdx) => (
                    <div key={`sec-${sIdx}`} id={`sec-${sIdx}`} className="space-y-4 border border-border rounded-lg p-4 bg-surface-2/30 pl-10 relative">
                       <div className="flex items-center gap-3 border-b border-border pb-3">
                          <div className="absolute left-2 cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-5 h-5 text-text-muted hover:text-text-primary" />
                          </div>
                          <div className="flex-1">
                             <Input 
                                value={sec.title} 
                                onChange={e => {
                                  const newP = {...parsedPlan};
                                  newP.sections[sIdx].title = e.target.value;
                                  setParsedPlan(newP);
                                }} 
                                className="bg-transparent border-none text-xl font-bold px-0 focus:ring-0 w-full text-brand-primary" 
                                placeholder="Nome do Módulo"
                             />
                          </div>
                          <div className="flex gap-1">
                             <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => addDay(sIdx)}
                                className="gap-1"
                             >
                                <CalendarPlus className="w-4 h-4" />
                                <span className="hidden sm:inline">Adicionar Dia</span>
                             </Button>
                             <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => removeSection(sIdx)}
                                className="text-danger hover:bg-danger/10"
                             >
                                <Trash2 className="w-4 h-4" />
                             </Button>
                          </div>
                       </div>
                       {sec.days.length === 0 && (
                          <div className="text-center py-6 text-text-muted">
                             <p className="text-sm">Nenhum dia neste módulo</p>
                             <Button onClick={() => addDay(sIdx)} size="sm" variant="ghost" className="mt-2 gap-1">
                                <Plus className="w-4 h-4" /> Adicionar primeiro dia
                             </Button>
                          </div>
                       )}
                       <SortableContext
                         items={sec.days.map((_, i) => `sec-${sIdx}-day-${i}`)}
                         strategy={verticalListSortingStrategy}
                       >
                         {sec.days.map((day: any, dIdx: number) => (
                            <SortableDayCard 
                              key={`sec-${sIdx}-day-${dIdx}`} 
                              id={`sec-${sIdx}-day-${dIdx}`}
                              day={day} 
                              schedulingType={schedulingType}
                              onChange={(f: string, v: any) => updateVisualDay(sIdx, dIdx, f, v)}
                              onItemChange={(iIdx: number, f: string, v: any) => updateVisualItem(sIdx, dIdx, iIdx, f, v)}
                              onAddItem={() => addVisualItem(sIdx, dIdx)}
                              onRemoveItem={(iIdx: number) => removeVisualItem(sIdx, dIdx, iIdx)}
                              onRemoveDay={() => removeDay(sIdx, dIdx)}
                              onItemsReorder={(oldIdx: number, newIdx: number) => reorderItems(sIdx, dIdx, oldIdx, newIdx)}
                            />
                         ))}
                       </SortableContext>
                    </div>
                  ))}
                </SortableContext>
              </SortableContext>
            </DndContext>
            {parsedPlan.sections.length === 0 && parsedPlan.unsectionedDays.length === 0 && (
              <div className="text-center py-12 text-text-muted">
                 <p className="text-lg mb-4">📚 Plano vazio</p>
                 <p className="text-sm mb-6">Comece criando um módulo ou um dia para organizar seu aprendizado</p>
                 <div className="flex justify-center gap-3">
                    <Button onClick={addSection} variant="outline" className="gap-2">
                       <FolderPlus className="w-4 h-4" />
                       Criar Módulo
                    </Button>
                    <Button onClick={() => addDay(null)} variant="primary" className="gap-2">
                       <CalendarPlus className="w-4 h-4" />
                       Criar Dia
                    </Button>
                 </div>
              </div>
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

function EditableRichText({ value, onChange, height = 150, placeholder = 'Clique em Editar para adicionar conteúdo...' }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = () => {
    onChange(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-2">
        <div data-color-mode="dark">
          <MDEditor 
            value={editValue} 
            onChange={val => setEditValue(val || '')} 
            height={height} 
            preview="edit" 
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={handleCancel}>Cancelar</Button>
          <Button size="sm" onClick={handleSave}>Concluir</Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="group relative rounded-md border border-border bg-surface-1/50 min-h-[60px] p-3 cursor-pointer hover:border-brand-primary/50 transition-colors"
      onClick={() => setIsEditing(true)}
    >
      {value ? (
        <div data-color-mode="dark">
          <MarkdownPreview source={value} style={{ background: 'transparent' }} />
        </div>
      ) : (
        <p className="text-text-muted text-sm italic">{placeholder}</p>
      )}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}>
          Editar
        </Button>
      </div>
    </div>
  );
}

// Sortable wrapper for Day cards
function SortableDayCard({ id, day, schedulingType, onChange, onItemChange, onAddItem, onRemoveItem, onRemoveDay, onItemsReorder }: { id: string; day: any; schedulingType?: 'relative' | 'calendar'; onChange: (field: string, value: any) => void; onItemChange: (idx: number, field: string, value: any) => void; onAddItem: () => void; onRemoveItem: (idx: number) => void; onRemoveDay?: () => void; onItemsReorder?: (oldIdx: number, newIdx: number) => void; }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        <GripVertical className="w-5 h-5 text-text-muted hover:text-text-primary" />
      </div>
      <DayEditorCard
        day={day}
        schedulingType={schedulingType}
        onChange={onChange}
        onItemChange={onItemChange}
        onAddItem={onAddItem}
        onRemoveItem={onRemoveItem}
        onRemoveDay={onRemoveDay}
        onItemsReorder={onItemsReorder}
      />
    </div>
  );
}

// Sortable wrapper for task items
function SortableTaskItem({ id, item, idx, onItemChange, onRemoveItem }: { id: string; item: any; idx: number; onItemChange: (idx: number, field: string, value: any) => void; onRemoveItem: (idx: number) => void }) {
  const index = Number(idx);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 items-start border-l-2 border-brand-primary pl-2 mb-4">
      <div className="cursor-grab active:cursor-grabbing pt-2" {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4 text-text-muted hover:text-text-primary" />
      </div>
      <Checkbox checked={item.is_completed} onCheckedChange={(checked: boolean) => onItemChange(index, 'is_completed', checked === true)} className="mt-2" />
      <div className="w-full space-y-2">
        <div className="flex gap-2 items-center">
          <Input value={item.title} onChange={e => onItemChange(index, 'title', e.target.value)} placeholder="Título da Tarefa" className="w-full" />
          <Button variant="ghost" size="icon" onClick={() => onRemoveItem(index)} className="text-danger hover:bg-danger/10 shrink-0">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <div data-color-mode="dark" className="mt-2">
          <EditableRichText
            value={item.description || ''}
            onChange={(val: string) => onItemChange(index, 'description', val)}
            height={120}
            placeholder="Clique em Editar para adicionar descrição da tarefa..."
          />
        </div>
      </div>
    </div>
  );
}

function DayEditorCard({ day, schedulingType = 'relative', onChange, onItemChange, onAddItem, onRemoveItem, onRemoveDay, onItemsReorder }: { day: any; schedulingType?: 'relative' | 'calendar'; onChange: (field: string, value: any) => void; onItemChange: (idx: number, field: string, value: any) => void; onAddItem: () => void; onRemoveItem: (idx: number) => void; onRemoveDay?: () => void; onItemsReorder?: (oldIdx: number, newIdx: number) => void; }) {
  const isCalendar = schedulingType === 'calendar';

  return (
    <Card className="p-4 space-y-3">
      <div className="flex gap-2 items-center">
        {isCalendar ? (
          <div className="flex gap-2 items-center shrink-0">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-text-muted uppercase tracking-wide">Data Agendada</label>
              <Input 
                type="date" 
                value={day.scheduled_date ?? ''} 
                onChange={e => onChange('scheduled_date', e.target.value || null)} 
                className="w-36 font-bold"
              />
            </div>
          </div>
        ) : (
          <Badge className="shrink-0 flex items-center justify-center">Dia {day.day_number}</Badge>
        )}
         <Input value={day.title} onChange={e => onChange('title', e.target.value)} placeholder="Título do Dia" className="w-full font-bold" />
         {onRemoveDay && (
            <Button variant="ghost" size="icon" onClick={onRemoveDay} className="text-danger hover:bg-danger/10 shrink-0">
              <Trash2 className="w-4 h-4" />
            </Button>
         )}
      </div>
      
      <div>
         <label className="text-xs text-text-muted font-medium mb-1 block">Instruções / Conteúdo Explicativo:</label>
         <div data-color-mode="dark">
           <EditableRichText 
             value={day.content_prompt} 
             onChange={(val: string) => onChange('content_prompt', val)} 
             height={200}
             placeholder="Clique em Editar para adicionar instruções ou conteúdo explicativo..."
           />
         </div>
      </div>
      
      <div className="bg-surface-2 rounded-md p-3 space-y-3 mt-4 border border-border">
         <div className="flex justify-between items-center mb-2">
            <label className="text-xs text-text-muted font-bold uppercase tracking-wide">Tarefas ({day.items?.length || 0})</label>
            <Button variant="ghost" size="sm" onClick={onAddItem}>+ Nova Tarefa</Button>
         </div>
         {day.items && day.items.length > 0 && (
           <DndContext
             sensors={useSensors(
               useSensor(PointerSensor),
               useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
             )}
             collisionDetection={closestCenter}
             onDragEnd={(event: DragEndEvent) => {
               const { active, over } = event;
               if (over && active.id !== over.id) {
                 const oldIndex = day.items.findIndex((_: any, i: number) => `item-${i}` === active.id);
                 const newIndex = day.items.findIndex((_: any, i: number) => `item-${i}` === over.id);
                 onItemsReorder?.(oldIndex, newIndex);
               }
             }}
           >
             <SortableContext
               items={day.items.map((_: any, i: number) => `item-${i}`)}
               strategy={verticalListSortingStrategy}
             >
               {day.items.map((item: any, idx: number) => (
                 <SortableTaskItem
                   key={`item-${idx}`}
                   id={`item-${idx}`}
                   item={item}
                   idx={idx}
                   onItemChange={onItemChange}
                   onRemoveItem={onRemoveItem}
                 />
               ))}
             </SortableContext>
           </DndContext>
         )}
      </div>
    </Card>
  );
}
