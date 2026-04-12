"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

// Generate a deterministic ID based on content to ensure SSR/client consistency
function generateStableId(
  prefix: string,
  content: string,
  index: number,
): string {
  // Simple hash function for deterministic IDs
  let hash = 0;
  const str = `${prefix}-${content}-${index}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `${prefix}-${Math.abs(hash).toString(36)}-${index}`;
}
import {
  Button,
  Input,
  Textarea,
  Select,
  Card,
  Badge,
  Checkbox,
  Accordion,
  Modal,
} from "@phfront/millennium-ui";
import {
  FileText,
  LayoutTemplate,
  Copy,
  Check,
  Trash2,
  Plus,
  FolderPlus,
  CalendarPlus,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Calendar,
  Target,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { WEEK_DAY_LABELS } from "@/lib/daily-goals/scheduling";
import { saveFullLearningPlan } from "@/app/learning/actions";
import {
  parseMarkdownToPlan,
  planToMarkdown,
  ParsedPlan,
  ParsedDay,
  ParsedSection,
  ParsedItem,
} from "@/lib/learningMarkdownParser";
import dynamic from "next/dynamic";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

const MarkdownPreview = dynamic(() => import("@uiw/react-markdown-preview"), {
  ssr: false,
});

interface PlanManagerClientProps {
  plan: any;
  schedulingType?: "relative" | "calendar";
}

export function PlanManagerClient({
  plan,
  schedulingType: initialSchedulingType = "relative",
}: PlanManagerClientProps) {
  const router = useRouter();

  // Transform existing plan to ParsedPlan structure with IDs - memoized to avoid regeneration
  // Using generateStableId for SSR/client consistency
  const initialParsedPlan = useMemo(() => {
    const sections = (plan.sections || [])
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((s: any, sIdx: number) => ({
        title: s.title,
        days: (plan.days || [])
          .filter((d: any) => d.section_id === s.id)
          .sort((a: any, b: any) => a.day_number - b.day_number)
          .map((d: any, dIdx: number) => ({
            _id:
              d._id ||
              generateStableId(
                "day",
                `${s.title}-${d.title}-${d.scheduled_date}`,
                dIdx,
              ),
            day_number: d.day_number,
            scheduled_date: d.scheduled_date ?? null,
            title: d.title || `Dia ${d.day_number}`,
            content_prompt: d.content_prompt || "",
            items: (d.items || [])
              .sort((a: any, b: any) => a.order_index - b.order_index)
              .map((i: any, iIdx: number) => ({
                _id:
                  i._id ||
                  generateStableId("item", `${i.title}-${i.is_completed}`, iIdx),
                title: i.title,
                is_completed: i.is_completed,
                description: i.description || "",
              })),
          })),
      }));

    const unsectionedDays = (plan.days || [])
      .filter((d: any) => !d.section_id)
      .sort((a: any, b: any) => a.day_number - b.day_number)
      .map((d: any, idx: number) => ({
        _id:
          d._id ||
          generateStableId("unsec-day", `${d.title}-${d.scheduled_date}`, idx),
        day_number: d.day_number,
        scheduled_date: d.scheduled_date ?? null,
        title: d.title || `Dia ${d.day_number}`,
        content_prompt: d.content_prompt || "",
        items: (d.items || [])
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((i: any, iIdx: number) => ({
            _id:
              i._id ||
              generateStableId(
                "unsec-item",
                `${i.title}-${i.is_completed}`,
                iIdx,
              ),
            title: i.title,
            is_completed: i.is_completed,
            description: i.description || "",
          })),
      }));

    return { sections, unsectionedDays };
  }, [plan.id]); // Only regenerate when plan ID changes

  const initialMarkdown = useMemo(
    () =>
      planToMarkdown(
        initialParsedPlan.sections,
        initialParsedPlan.unsectionedDays,
      ),
    [initialParsedPlan],
  );

  const statusLabels: Record<string, string> = {
    planning: "Planejamento",
    in_progress: "Em Andamento",
    completed: "Concluído",
    paused: "Pausado",
  };

  const statusVariants: Record<
    string,
    "muted" | "info" | "success" | "warning"
  > = {
    planning: "muted",
    in_progress: "info",
    completed: "success",
    paused: "warning",
  };

  const [activeTab, setActiveTab] = useState<"visual" | "markdown">("visual");
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [parsedPlan, setParsedPlan] = useState<ParsedPlan>(initialParsedPlan);
  const [activeDays, setActiveDays] = useState<number[] | null>(
    plan.active_days ?? null,
  );
  const [title, setTitle] = useState(plan.title || "");
  const [description, setDescription] = useState(plan.description || "");
  const [schedulingType, setSchedulingType] = useState<"relative" | "calendar">(
    initialSchedulingType,
  );
  const [goals, setGoals] = useState(plan.goals || "");
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmAction, setShowConfirmAction] = useState(false);
  const [isReorderingMode, setIsReorderingMode] = useState(false);

  // Memoized IDs for DnD - must be at top level, not inside JSX
  const sectionIds = useMemo(
    () => parsedPlan.sections.map((_, i) => `sec-${i}`),
    [parsedPlan.sections],
  );
  const unsectionedDayIds = useMemo(
    () => parsedPlan.unsectionedDays.map((d: any) => d._id),
    [parsedPlan.unsectionedDays],
  );

  // DnD sensors - must be at top level, not inside JSX
  const sectionsSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const unsectionedDaysSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Sync back and forth
  useEffect(() => {
    if (activeTab === "visual") {
      try {
        const parsed = parseMarkdownToPlan(markdown);
        setParsedPlan(parsed);
      } catch (e) {
        console.error("Error parsing markdown", e);
      }
    }
  }, [activeTab, markdown]);

  // Functions to add/remove sections and days in visual mode
  const addSection = () => {
    setParsedPlan((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy.sections.push({
        title: `Novo Módulo ${copy.sections.length + 1}`,
        days: [],
      });
      return copy;
    });
  };

  const removeSection = (sIdx: number) => {
    setParsedPlan((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy.sections.splice(sIdx, 1);
      return copy;
    });
  };

  const addDay = (sectionIdx: number) => {
    setParsedPlan((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const allDays = copy.sections.flatMap((s: any) => s.days);
      const maxDayNumber =
        allDays.length > 0
          ? Math.max(...allDays.map((d: any) => d.day_number))
          : 0;

      const newDay = {
        _id: generateStableId(
          "new-day",
          `day-${maxDayNumber + 1}-${Date.now()}`,
          0,
        ),
        day_number: maxDayNumber + 1,
        scheduled_date: null as string | null,
        title: `Dia ${maxDayNumber + 1}`,
        content_prompt: "",
        items: [],
      };

      copy.sections[sectionIdx].days.push(newDay);
      return copy;
    });
  };

  const removeDay = (sectionIdx: number, dayIdx: number) => {
    setParsedPlan((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy.sections[sectionIdx].days.splice(dayIdx, 1);
      return copy;
    });
  };

  const handleTabSwitch = (tab: "visual" | "markdown") => {
    if (tab === "markdown" && activeTab === "visual") {
      // Sync from visual to markdown
      const md = planToMarkdown(
        parsedPlan.sections,
        parsedPlan.unsectionedDays,
      );
      setMarkdown(md);
    }
    setActiveTab(tab);
  };

  const updateVisualDay = (
    sectionIdx: number,
    dayIdx: number,
    field: string,
    value: string,
  ) => {
    setParsedPlan((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy.sections[sectionIdx].days[dayIdx][field] = value;
      return copy;
    });
  };

  const updateVisualItem = (
    sectionIdx: number,
    dayIdx: number,
    itemIdx: number,
    field: string,
    value: any,
  ) => {
    setParsedPlan((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy.sections[sectionIdx].days[dayIdx].items[itemIdx][field] = value;
      return copy;
    });
  };

  const addVisualItem = (sectionIdx: number, dayIdx: number) => {
    setParsedPlan((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const itemCount = copy.sections[sectionIdx].days[dayIdx].items.length;
      const newItem = {
        _id: generateStableId(
          "new-item",
          `item-${dayIdx}-${itemCount}-${Date.now()}`,
          itemCount,
        ),
        title: "",
        is_completed: false,
        description: "",
      };
      copy.sections[sectionIdx].days[dayIdx].items.push(newItem);
      return copy;
    });
  };

  const removeVisualItem = (
    sectionIdx: number,
    dayIdx: number,
    itemIdx: number,
  ) => {
    setParsedPlan((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy.sections[sectionIdx].days[dayIdx].items.splice(itemIdx, 1);
      return copy;
    });
  };

  // Reordering functions
  const reorderItems = (
    sectionIdx: number,
    dayIdx: number,
    oldIndex: number,
    newIndex: number,
  ) => {
    console.log("reorderItems called:", {
      sectionIdx,
      dayIdx,
      oldIndex,
      newIndex,
    });
    setParsedPlan((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const items = copy.sections[sectionIdx].days[dayIdx].items;
      console.log(
        "Before reorder:",
        items.map((i: any) => i._id),
      );
      const [moved] = items.splice(oldIndex, 1);
      items.splice(newIndex, 0, moved);
      console.log(
        "After reorder:",
        items.map((i: any) => i._id),
      );
      return copy;
    });
  };

  const reorderUnsectionedDays = (oldIndex: number, newIndex: number) => {
    setParsedPlan((prev) => {
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

  const reorderSectionDays = (
    sectionIdx: number,
    oldIndex: number,
    newIndex: number,
  ) => {
    setParsedPlan((prev) => {
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

  const moveDayBetweenSections = (
    fromSectionIdx: number,
    fromDayIdx: number,
    toSectionIdx: number,
    toDayIdx: number,
  ) => {
    setParsedPlan((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const fromDays = copy.sections[fromSectionIdx].days;
      const toDays = copy.sections[toSectionIdx].days;

      const [moved] = fromDays.splice(fromDayIdx, 1);
      toDays.splice(toDayIdx, 0, moved);

      // Recalculate day numbers in both sections
      fromDays.forEach((d: ParsedDay, i: number) => {
        d.day_number = i + 1;
      });
      toDays.forEach((d: ParsedDay, i: number) => {
        d.day_number = i + 1;
      });

      return copy;
    });
  };

  const reorderSections = (oldIndex: number, newIndex: number) => {
    setParsedPlan((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const [moved] = copy.sections.splice(oldIndex, 1);
      copy.sections.splice(newIndex, 0, moved);
      return copy;
    });
  };

  const handleSave = () => {
    if (
      schedulingType === "calendar" &&
      (!activeDays || activeDays.length === 0)
    ) {
      alert(
        "É obrigatório selecionar pelo menos um dia da semana para o plano no formato calendário.",
      );
      return;
    }
    setShowConfirmAction(true);
  };

  const confirmSave = async () => {
    setIsSaving(true);
    try {
      let finalPlanToSave = parsedPlan;
      if (activeTab === "markdown") {
        finalPlanToSave = parseMarkdownToPlan(markdown);
      }
      await saveFullLearningPlan(plan.id, finalPlanToSave, activeDays, {
        title,
        description,
        goals,
        scheduling_type: schedulingType,
      });
      setShowConfirmAction(false);
      router.push(`/learning`);
    } catch (e) {
      alert("Erro ao salvar o plano.");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Card com informações do plano */}
      <Card className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-4">
              <div>
                <label className="text-sm font-medium text-text-primary mb-1.5 block">
                  Título do Plano
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Formação Fullstack..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-text-primary mb-1.5 block">
                  Resumo / Descrição
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Adicione uma breve descrição sobre este plano..."
                  rows={4}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={statusVariants[plan.status] || "muted"}>
                {statusLabels[plan.status] || plan.status}
              </Badge>
              <Button onClick={handleSave} size="sm" variant="primary">
                Salvar Alterações
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm pt-2">
            <div className="min-w-[260px]">
              <label className="text-sm font-medium text-text-primary mb-1.5 block">
                Tipo de Agendamento
              </label>
              <Select
                options={[
                  {
                    value: "relative",
                    label: "Ritmo Livre (Dia 1, Dia 2, sem forçar data fixa)",
                  },
                  {
                    value: "calendar",
                    label: "Calendário (Dias fixos na agenda)",
                  },
                ]}
                value={schedulingType}
                onChange={(value: any) => {
                  setSchedulingType(value);
                  if (value === "relative") {
                    setActiveDays(null);
                  }
                }}
                placeholder="Selecione..."
              />
            </div>
            {plan.target_date && (
              <div className="flex items-center gap-1 text-text-secondary">
                <Calendar className="h-4 w-4" />
                <span>
                  Meta: {new Date(plan.target_date).toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border mt-2">
            <label className="text-sm font-medium text-text-primary mb-1.5 block">
              Objetivos Principais
            </label>
            <div data-color-mode="dark">
              <EditableRichText
                value={goals}
                onChange={(val: string) => setGoals(val)}
                placeholder="Descreva o que espera alcançar ao completar esta trilha..."
                height={150}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <Button
          onClick={() => handleTabSwitch("visual")}
          variant={activeTab === "visual" ? "primary" : "outline"}
        >
          <LayoutTemplate className="w-4 h-4 mr-2" /> Visual
        </Button>
        <Button
          onClick={() => handleTabSwitch("markdown")}
          variant={activeTab === "markdown" ? "primary" : "outline"}
        >
          <FileText className="w-4 h-4 mr-2" /> Markdown
        </Button>
      </div>

      {schedulingType === "calendar" && (
        <div className="flex flex-col gap-2 mb-6 bg-surface-2 p-4 rounded-xl border border-border">
          <label className="text-sm font-medium text-text-secondary">
            Dias da semana disponíveis para o plano
            <span className="ml-1 text-xs font-normal text-danger">
              (obrigatório)
            </span>
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {WEEK_DAY_LABELS.map((label, dow) => {
              const isActive = activeDays !== null && activeDays.includes(dow);
              return (
                <button
                  key={dow}
                  type="button"
                  onClick={() => {
                    setActiveDays((prev) => {
                      if (prev === null) return [dow];
                      const next = prev.includes(dow)
                        ? prev.filter((d) => d !== dow)
                        : [...prev, dow].sort();
                      return next;
                    });
                  }}
                  className={[
                    "w-10 h-10 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                    isActive
                      ? "bg-brand-primary text-white"
                      : "bg-surface-3 text-text-muted hover:bg-surface-4",
                  ].join(" ")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "markdown" && (
        <div className="space-y-2">
          <p className="text-sm text-text-secondary mb-2">
            Utilize `#` para Semanas/Módulos, `## Dia X: Titulo` para Dias e `-
            [ ]` para tarefas. A identação sob uma tarefa representa sua
            descrição.
          </p>
          <div data-color-mode="dark">
            <MDEditor
              height={600}
              value={markdown}
              onChange={(val) => setMarkdown(val || "")}
            />
          </div>
        </div>
      )}

      {activeTab === "visual" && (
        <div className="space-y-8">
          {/* Botões de ação globais */}
          <div className="flex gap-3 pb-4 border-b border-border items-center justify-between">
            <Button onClick={addSection} variant="outline" className="gap-2">
              <FolderPlus className="w-4 h-4" />
              Novo Módulo
            </Button>
            <Button
              onClick={() => setIsReorderingMode(!isReorderingMode)}
              variant={isReorderingMode ? "primary" : "outline"}
              className="gap-2"
              title="Ativar modo de reordenação"
            >
              <GripVertical className="w-4 h-4" />
              <span className="hidden sm:inline">Reordenar</span>
            </Button>
          </div>

          <DndContext
            id="sections-dnd"
            sensors={sectionsSensors}
            collisionDetection={closestCenter}
            onDragEnd={(event: DragEndEvent) => {
              const { active, over } = event;
              if (!over || active.id === over.id) return;

              const activeId = String(active.id);
              const overId = String(over.id);

              // Handle section reordering
              if (activeId.startsWith("sec-") && overId.startsWith("sec-")) {
                const oldIndex = parseInt(activeId.replace("sec-", ""));
                const newIndex = parseInt(overId.replace("sec-", ""));
                reorderSections(oldIndex, newIndex);
                return;
              }

              // Handle day reordering within/across sections (find by _id)
              let activeSecIdx = -1,
                activeDayIdx = -1;
              let overSecIdx = -1,
                overDayIdx = -1;

              parsedPlan.sections.forEach((sec: any, si: number) => {
                sec.days.forEach((d: any, di: number) => {
                  if (d._id === activeId) {
                    activeSecIdx = si;
                    activeDayIdx = di;
                  }
                  if (d._id === overId) {
                    overSecIdx = si;
                    overDayIdx = di;
                  }
                });
              });

              if (activeSecIdx !== -1 && overSecIdx !== -1) {
                if (activeSecIdx === overSecIdx) {
                  reorderSectionDays(activeSecIdx, activeDayIdx, overDayIdx);
                } else {
                  moveDayBetweenSections(
                    activeSecIdx,
                    activeDayIdx,
                    overSecIdx,
                    overDayIdx,
                  );
                }
              }
            }}
          >
            <SortableContext
              items={sectionIds}
              strategy={verticalListSortingStrategy}
            >
              <Accordion
                type="multiple"
                defaultValue={sectionIds}
                className="space-y-4"
              >
                {parsedPlan.sections.map((sec, sIdx) => (
                  <SortableModuleCard
                    key={`sec-${sIdx}`}
                    id={`sec-${sIdx}`}
                    sec={sec}
                    sIdx={sIdx}
                    schedulingType={schedulingType}
                    onTitleChange={(val: string) => {
                      const newP = { ...parsedPlan };
                      newP.sections[sIdx].title = val;
                      setParsedPlan(newP);
                    }}
                    onAddDay={() => addDay(sIdx)}
                    onRemoveSection={() => removeSection(sIdx)}
                    updateVisualDay={updateVisualDay}
                    updateVisualItem={updateVisualItem}
                    addVisualItem={addVisualItem}
                    removeVisualItem={removeVisualItem}
                    removeDay={removeDay}
                    reorderItems={reorderItems}
                    isReorderingMode={isReorderingMode}
                  />
                ))}
              </Accordion>
            </SortableContext>
          </DndContext>
          {parsedPlan.sections.length === 0 && (
            <div className="text-center py-12 text-text-muted">
              <p className="text-lg mb-4">📚 Plano vazio</p>
              <p className="text-sm mb-6">
                Comece criando um módulo para organizar seu aprendizado
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  onClick={addSection}
                  variant="primary"
                  className="gap-2"
                >
                  <FolderPlus className="w-4 h-4" />
                  Criar Primeiro Módulo
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={showConfirmAction}
        onClose={() => !isSaving && setShowConfirmAction(false)}
        title="Salvar Alterações do Plano"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-danger/10 text-danger p-4 rounded-xl border border-danger/20">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium leading-relaxed">
              Tem certeza? Ao salvar, as mudanças se tornarão definitivas. Se
              você excluiu dias do conteúdo visual que já estavam em andamento,
              eles perderão todo o progresso (anotações e tarefas).
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setShowConfirmAction(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button onClick={confirmSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Confirmar e Salvar"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function EditableRichText({
  value,
  onChange,
  height = 150,
  placeholder = "Clique em Editar para adicionar conteúdo...",
}: any) {
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

  return (
    <>
      {isEditing ? (
        <div className="space-y-2">
          <div data-color-mode="dark">
            <MDEditor
              value={editValue}
              onChange={(val) => setEditValue(val || "")}
              height={height}
              preview="edit"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave}>
              Concluir
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="group relative rounded-md border border-border bg-surface-1/50 min-h-[60px] p-3 cursor-pointer hover:border-brand-primary/50 transition-colors"
          onClick={() => setIsEditing(true)}
        >
          {value ? (
            <div data-color-mode="dark">
              <MarkdownPreview
                source={value}
                style={{ background: "transparent" }}
              />
            </div>
          ) : (
            <p className="text-text-muted text-sm italic">{placeholder}</p>
          )}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
            >
              Editar
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// Sortable wrapper for task items
function SortableTaskItem({
  id,
  item,
  idx,
  onItemChange,
  onRemoveItem,
  isReorderingMode,
}: {
  id: string;
  item: any;
  idx: number;
  onItemChange: (idx: number, field: string, value: any) => void;
  onRemoveItem: (idx: number) => void;
  isReorderingMode?: boolean;
}) {
  // Ensure id is never undefined to prevent hook errors
  const safeId = id || item._id || `fallback-item-${idx}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: safeId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-2 items-start ${isReorderingMode ? "border-l-2 border-brand-primary pl-2" : ""} mb-4`}
    >
      {isReorderingMode && (
        <div
          className="cursor-grab active:cursor-grabbing pt-2"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4 text-text-muted hover:text-text-primary" />
        </div>
      )}
      <Checkbox
        checked={item.is_completed}
        onCheckedChange={(checked: boolean) =>
          onItemChange(idx, "is_completed", checked === true)
        }
        className="mt-2"
      />
      <div className="w-full space-y-2">
        <div className="flex gap-2 items-center">
          <Input
            value={item.title}
            onChange={(e) => onItemChange(Number(idx), "title", e.target.value)}
            placeholder="Título da Tarefa"
            className="w-full"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemoveItem(Number(idx))}
            className="text-danger hover:bg-danger/10 shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <div data-color-mode="dark" className="mt-2">
          <EditableRichText
            value={item.description || ""}
            onChange={(val: string) => onItemChange(idx, "description", val)}
            height={120}
            placeholder="Clique em Editar para adicionar descrição da tarefa..."
          />
        </div>
      </div>
    </div>
  );
}

function DayEditorCard({
  day,
  schedulingType = "relative",
  onChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onRemoveDay,
  onItemsReorder,
  isReorderingMode,
}: any) {
  const isCalendar = schedulingType === "calendar";

  // Sensors must be declared at top level, not conditionally
  const itemSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // useMemo must be at top level, not inside JSX conditionals
  const taskItemIds = useMemo(
    () => day.items?.map((item: any) => item._id) || [],
    [day.items],
  );

  return (
    <Accordion type="single" defaultValue="day-content" className="w-full">
      <Accordion.Item
        value="day-content"
        className="border-border bg-surface-2"
      >
        <Accordion.Trigger className="bg-surface-2 hover:bg-surface-3">
          <div className="flex gap-3 items-center w-full">
            <div className="shrink-0 flex items-center">
              <Badge className="flex items-center justify-center min-w-[28px] h-7">
                {day.day_number}
              </Badge>
            </div>
            <div
              className="flex-1 min-w-0"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Input
                value={day.title}
                onChange={(e) => onChange("title", e.target.value)}
                placeholder="Título do Dia"
                className="w-full font-bold h-9 bg-surface-2 border-border"
              />
            </div>
            {onRemoveDay && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemoveDay();
                }}
                className="text-danger hover:bg-danger/10 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </Accordion.Trigger>

        <Accordion.Content>
          <div className="space-y-4 pt-1">
            <div>
              <label className="text-xs text-text-muted font-medium mb-1 block">
                Instruções / Conteúdo Explicativo:
              </label>
              <div data-color-mode="dark">
                <EditableRichText
                  value={day.content_prompt}
                  onChange={(val: string) => onChange("content_prompt", val)}
                  height={200}
                  placeholder="Clique em Editar para adicionar instruções ou conteúdo explicativo..."
                />
              </div>
            </div>

            {/* Accordion de Tarefas */}
            <Accordion type="single" className="w-full">
              <Accordion.Item
                value="tasks"
                className="border-border bg-surface-1"
              >
                <Accordion.Trigger className="bg-surface-1 hover:bg-surface-2 py-2 px-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-text-muted">
                      Tarefas
                    </span>
                    <span className="text-xs bg-brand-primary/20 text-brand-primary px-2 py-0.5 rounded-full">
                      {day.items?.length || 0}
                    </span>
                  </div>
                </Accordion.Trigger>
                <Accordion.Content>
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={onAddItem}>
                        + Nova Tarefa
                      </Button>
                    </div>
                    <DndContext
                      id={`tasks-dnd-${day._id}`}
                      sensors={itemSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event: DragEndEvent) => {
                        const { active, over } = event;
                        console.log("Task drag end:", {
                          active: active.id,
                          over: over?.id,
                          items: day.items.map((i: any) => i._id),
                        });
                        if (over && active.id !== over.id) {
                          const oldIndex = day.items.findIndex(
                            (item: any) => item._id === active.id,
                          );
                          const newIndex = day.items.findIndex(
                            (item: any) => item._id === over.id,
                          );
                          console.log("Task reorder:", {
                            oldIndex,
                            newIndex,
                            activeId: active.id,
                            overId: over.id,
                          });
                          if (oldIndex !== -1 && newIndex !== -1) {
                            onItemsReorder?.(oldIndex, newIndex);
                          }
                        }
                      }}
                    >
                      <SortableContext
                        items={taskItemIds}
                        strategy={verticalListSortingStrategy}
                      >
                        {day.items?.map((item: any, idx: number) => (
                          <SortableTaskItem
                            key={item._id}
                            id={item._id}
                            item={item}
                            idx={idx}
                            onItemChange={onItemChange}
                            onRemoveItem={onRemoveItem}
                            isReorderingMode={isReorderingMode}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            </Accordion>
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion>
  );
}

// Separate component to handle section days with proper hook placement
function SectionDays({
  sec,
  sIdx,
  schedulingType,
  updateVisualDay,
  updateVisualItem,
  addVisualItem,
  removeVisualItem,
  removeDay,
  reorderItems,
  isReorderingMode,
}: any) {
  // useMemo must be at top level of this component
  const dayIds = useMemo(() => sec.days.map((d: any) => d._id), [sec.days]);

  return (
    <SortableContext items={dayIds} strategy={verticalListSortingStrategy}>
      {sec.days.map((day: any, dIdx: number) => (
        <SortableDayCard
          key={day._id}
          id={day._id}
          day={day}
          schedulingType={schedulingType}
          onChange={(f: string, v: any) => updateVisualDay(sIdx, dIdx, f, v)}
          onItemChange={(iIdx: number, f: string, v: any) =>
            updateVisualItem(sIdx, dIdx, iIdx, f, v)
          }
          onAddItem={() => addVisualItem(sIdx, dIdx)}
          onRemoveItem={(iIdx: number) => removeVisualItem(sIdx, dIdx, iIdx)}
          onRemoveDay={() => removeDay(sIdx, dIdx)}
          onItemsReorder={(oldIdx: number, newIdx: number) =>
            reorderItems(sIdx, dIdx, oldIdx, newIdx)
          }
          isReorderingMode={isReorderingMode}
        />
      ))}
    </SortableContext>
  );
}

function SortableDayCard({
  id,
  day,
  schedulingType,
  onChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onRemoveDay,
  onItemsReorder,
  isReorderingMode,
}: any) {
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
    <div
      ref={setNodeRef}
      style={style}
      className="flex gap-3 items-start relative mb-2"
    >
      {isReorderingMode && (
        <div
          className="mt-2 shrink-0 cursor-grab active:cursor-grabbing p-1.5 hover:bg-surface-4 rounded transition-colors touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4 text-text-muted" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <DayEditorCard
          day={day}
          schedulingType={schedulingType}
          onChange={onChange}
          onItemChange={onItemChange}
          onAddItem={onAddItem}
          onRemoveItem={onRemoveItem}
          onRemoveDay={onRemoveDay}
          onItemsReorder={onItemsReorder}
          isReorderingMode={isReorderingMode}
        />
      </div>
    </div>
  );
}

function SortableModuleCard({
  id,
  sec,
  sIdx,
  schedulingType,
  onTitleChange,
  onAddDay,
  onRemoveSection,
  updateVisualDay,
  updateVisualItem,
  addVisualItem,
  removeVisualItem,
  removeDay,
  reorderItems,
  isReorderingMode,
}: any) {
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
    <div
      ref={setNodeRef}
      style={style}
      className="flex gap-3 items-start relative"
    >
      {isReorderingMode && (
        <div
          className="mt-2 shrink-0 cursor-grab active:cursor-grabbing p-1.5 hover:bg-surface-4 rounded transition-colors touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4 text-text-muted" />
        </div>
      )}
      <Accordion.Item
        value={id}
        className="flex-1 min-w-0 border-border bg-surface-2/30 rounded-xl overflow-hidden border shadow-sm"
      >
        <Accordion.Trigger className="hover:bg-surface-3/50 px-4 py-3 transition-colors">
          <div className="flex items-center gap-3 w-full">
            <div
              className="flex-1 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <Input
                value={sec.title}
                onChange={(e) => onTitleChange(e.target.value)}
                className="w-full font-bold h-9 bg-surface-2 border-border"
                placeholder={`Módulo ${sIdx + 1}: ${sec.title ? "" : "Digite o título..."}`}
              />
            </div>
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="sm"
                variant="ghost"
                onClick={onAddDay}
                className="gap-1 hover:bg-brand-primary/10 text-brand-primary h-8"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Dia</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRemoveSection}
                className="text-danger hover:bg-danger/10 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Accordion.Trigger>
        <Accordion.Content className="px-4 pb-4">
          <div className="pt-4 space-y-4">
            {sec.days.length === 0 && (
              <div className="text-center py-8 bg-surface-1/50 rounded-xl border border-dashed border-border">
                <p className="text-sm text-text-muted">
                  Nenhum dia cadastrado para este módulo
                </p>
                <Button
                  onClick={onAddDay}
                  size="sm"
                  variant="ghost"
                  className="mt-2 gap-2 text-brand-primary"
                >
                  <Plus className="w-4 h-4" /> Adicionar Primeiro Dia
                </Button>
              </div>
            )}
            <SectionDays
              sec={sec}
              sIdx={sIdx}
              schedulingType={schedulingType}
              updateVisualDay={updateVisualDay}
              updateVisualItem={updateVisualItem}
              addVisualItem={addVisualItem}
              removeVisualItem={removeVisualItem}
              removeDay={removeDay}
              reorderItems={reorderItems}
              isReorderingMode={isReorderingMode}
            />
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </div>
  );
}
