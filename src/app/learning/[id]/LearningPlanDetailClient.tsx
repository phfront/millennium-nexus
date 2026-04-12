'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, Button, Badge, Accordion, Modal } from '@phfront/millennium-ui';
import {
  Target,
  CheckCircle2,
  Circle,
  Play,
  BookOpen,
  ChevronRight,
  ListChecks,
  ArrowRight,
  AlertTriangle,
  Loader2,
  Bell,
} from 'lucide-react';
import type {
  LearningPlanWithDetails,
  LearningPlanDayWithItems,
  LearningPlanSection,
  LearningDayItem,
} from '@/types/learning';
import { startLearningPlan } from '../actions';
import { LearningPlanNotificationConfig } from './LearningPlanNotificationConfig';
import dynamic from 'next/dynamic';
import '@uiw/react-markdown-preview/markdown.css';

const MarkdownPreview = dynamic(() => import('@uiw/react-markdown-preview'), {
  ssr: false,
});

interface Props {
  plan: LearningPlanWithDetails;
}

export function LearningPlanDetailClient({ plan }: Props) {
  const router = useRouter();
  const [showStartModal, setShowStartModal] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);

  const handleStartPlan = async () => {
    setIsStarting(true);
    try {
      await startLearningPlan(plan.id);
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsStarting(false);
      setShowStartModal(false);
    }
  };

  // Group days by section
  const sectionsMap = new Map<string | null, LearningPlanDayWithItems[]>();

  if (plan.days) {
    plan.days.forEach((day: LearningPlanDayWithItems) => {
      const g = sectionsMap.get(day.section_id) || [];
      g.push(day);
      sectionsMap.set(day.section_id, g);
    });
  }

  const unsectionedDays = (sectionsMap.get(null) || []).sort(
    (a, b) => a.day_number - b.day_number,
  );

  const sections = (plan.sections || []).sort(
    (a: LearningPlanSection, b: LearningPlanSection) =>
      a.order_index - b.order_index,
  );

  // Progress stats
  const allDays = plan.days || [];
  const totalDays = allDays.length;
  const completedDays = allDays.filter((d) => d.is_completed).length;
  const progressPercent = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

  const sectionIds = sections.map((s: LearningPlanSection) => s.id);
  const defaultExpanded = unsectionedDays.length > 0
    ? ['unsectioned', ...sectionIds]
    : sectionIds;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-2">
            {plan.title}
          </h1>
          {plan.description && (
            <p className="text-text-secondary text-lg leading-relaxed">
              {plan.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {plan.status === 'in_progress' && (
            <Button variant="outline" onClick={() => setShowNotifModal(true)}>
              <Bell className="w-4 h-4 mr-2" /> Notificações
            </Button>
          )}
          <Link href={`/learning/${plan.id}/edit`}>
            <Button variant="outline">
              <Target className="w-4 h-4 mr-2" /> Gerenciar Plano
            </Button>
          </Link>
        </div>
      </div>

      {/* Start plan CTA */}
      {plan.status === 'planning' && (
        <Card className="p-6 bg-surface-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-brand-primary/30 border-2 shadow-sm">
          <div>
            <h3 className="font-bold text-text-primary mb-1 text-lg">
              Pronto para começar?
            </h3>
            <p className="text-sm text-text-secondary">
              Suas datas serão geradas automaticamente e distribuídas com base
              nos dias da semana definidos no plano.
            </p>
          </div>
          <Button
            onClick={() => setShowStartModal(true)}
            variant="primary"
            className="whitespace-nowrap px-6"
          >
            <Play className="w-4 h-4 mr-2 fill-current" /> Iniciar Plano
          </Button>
        </Card>
      )}

      {/* Start plan confirmation modal */}
      <Modal
        isOpen={showStartModal}
        onClose={() => !isStarting && setShowStartModal(false)}
        title="Iniciar Plano de Aprendizado"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-brand-primary/10 text-brand-primary p-4 rounded-xl border border-brand-primary/20">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium leading-relaxed">
              Ao iniciar o plano, as datas serão geradas automaticamente com base nos dias da semana configurados. Deseja continuar?
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setShowStartModal(false)}
              disabled={isStarting}
            >
              Cancelar
            </Button>
            <Button onClick={handleStartPlan} disabled={isStarting}>
              {isStarting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                'Confirmar e Iniciar'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Global progress bar */}
      {totalDays > 0 && (
        <Card className="p-4 bg-surface-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text-primary">
              Progresso Geral
            </span>
            <span className="text-sm text-text-secondary">
              {completedDays}/{totalDays} dias concluídos ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </Card>
      )}

      {/* Next day card */}
      {plan.status === 'in_progress' && (() => {
        const sortedDays = [...allDays].sort((a, b) => a.day_number - b.day_number);
        const nextDay = sortedDays.find((d) => !d.is_completed);
        if (!nextDay) return null;
        const dayItems = nextDay.items || [];
        const doneItems = dayItems.filter((i) => i.is_completed).length;
        const totalItems = dayItems.length;
        return (
          <Card className="p-5 bg-surface-2 border-2 border-brand-primary/40 shadow-md">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Badge className="shrink-0 min-w-7 h-7 flex items-center justify-center">
                  {nextDay.day_number}
                </Badge>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary mb-0.5">
                    Próximo Dia
                  </p>
                  <p className="font-bold text-text-primary truncate">
                    {nextDay.title || 'Sessão de Estudo'}
                  </p>
                  {totalItems > 0 && (
                    <p className="text-xs text-text-secondary mt-0.5">
                      {doneItems}/{totalItems} itens concluídos
                    </p>
                  )}
                </div>
              </div>
              <Link href={`/learning/${plan.id}/day/${nextDay.id}`}>
                <Button variant="primary" className="gap-1.5 shrink-0 whitespace-nowrap">
                  Continuar
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </Card>
        );
      })()}

      {/* Notification config modal */}
      <Modal
        isOpen={showNotifModal}
        onClose={() => setShowNotifModal(false)}
        title="Notificações do Plano"
      >
        <LearningPlanNotificationConfig planId={plan.id} />
      </Modal>

      {/* Empty state */}
      {unsectionedDays.length === 0 && sections.length === 0 && (
        <Card className="p-8 text-center bg-surface-2 border-dashed">
          <Target className="h-10 w-10 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-1">
            Caminho Vazio
          </h3>
          <p className="text-text-secondary mb-6 max-w-sm mx-auto">
            Não há dias nem módulos cadastrados para este plano ainda.
          </p>
        </Card>
      )}

      {/* Modules + Days accordion */}
      {(sections.length > 0 || unsectionedDays.length > 0) && (
        <Accordion
          type="multiple"
          defaultValue={defaultExpanded}
          className="space-y-4"
        >
          {/* Unsectioned days */}
          {unsectionedDays.length > 0 && (
            <Accordion.Item
              value="unsectioned"
              className="border-border bg-surface-2/30 rounded-xl overflow-hidden border shadow-sm"
            >
              <Accordion.Trigger className="hover:bg-surface-3/50 px-4 py-3">
                <div className="flex items-center gap-3 w-full">
                  <BookOpen className="w-5 h-5 text-brand-primary shrink-0" />
                  <span className="font-bold text-text-primary flex-1 text-left">
                    Dias Avulsos
                  </span>
                  <SectionProgress
                    days={unsectionedDays}
                  />
                </div>
              </Accordion.Trigger>
              <Accordion.Content className="px-4 pb-4">
                <DaysAccordion days={unsectionedDays} planId={plan.id} />
              </Accordion.Content>
            </Accordion.Item>
          )}

          {/* Sections */}
          {sections.map((section: LearningPlanSection) => {
            const sectionDays = (sectionsMap.get(section.id) || []).sort(
              (a, b) => a.day_number - b.day_number,
            );

            return (
              <Accordion.Item
                key={section.id}
                value={section.id}
                className="border-border bg-surface-2/30 rounded-xl overflow-hidden border shadow-sm"
              >
                <Accordion.Trigger className="hover:bg-surface-3/50 px-4 py-3">
                  <div className="flex items-center gap-3 w-full">
                    <BookOpen className="w-5 h-5 text-brand-primary shrink-0" />
                    <span className="font-bold text-text-primary flex-1 text-left">
                      {section.title}
                    </span>
                    <SectionProgress days={sectionDays} />
                  </div>
                </Accordion.Trigger>
                <Accordion.Content className="px-4 pb-4">
                  {sectionDays.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-6">
                      Nenhum dia cadastrado neste módulo.
                    </p>
                  ) : (
                    <DaysAccordion days={sectionDays} planId={plan.id} />
                  )}
                </Accordion.Content>
              </Accordion.Item>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */

function SectionProgress({ days }: { days: LearningPlanDayWithItems[] }) {
  const total = days.length;
  const completed = days.filter((d) => d.is_completed).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-20 h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-primary rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-text-secondary whitespace-nowrap">
        {completed}/{total}
      </span>
    </div>
  );
}

function DaysAccordion({
  days,
  planId,
}: {
  days: LearningPlanDayWithItems[];
  planId: string;
}) {
  return (
    <Accordion type="multiple" className="space-y-2 pt-2">
      {days.map((day) => {
        const itemsCount = day.items?.length || 0;
        const completedItems = day.items?.filter((i) => i.is_completed).length || 0;

        return (
          <Accordion.Item
            key={day.id}
            value={day.id}
            className="border-border bg-surface-2 rounded-lg overflow-hidden border"
          >
            <Accordion.Trigger className="hover:bg-surface-3 px-3 py-2.5">
              <div className="flex items-center gap-3 w-full">
                <div className="shrink-0">
                  {day.is_completed ? (
                    <CheckCircle2 className="h-5 w-5 text-brand-primary" fill="currentColor" />
                  ) : (
                    <Circle className="h-5 w-5 text-text-muted" />
                  )}
                </div>
                <Badge className="shrink-0 min-w-7 h-6 flex items-center justify-center text-xs">
                  {day.day_number}
                </Badge>
                <span className="font-semibold text-text-primary flex-1 text-left text-sm truncate">
                  {day.title || 'Sessão de Estudo'}
                </span>
                {day.is_completed && (
                  <Badge variant="success" className="text-[10px] px-1.5 py-0 shrink-0">
                    Concluído
                  </Badge>
                )}
                {itemsCount > 0 && (
                  <span className="text-xs text-text-secondary shrink-0">
                    {completedItems}/{itemsCount}
                  </span>
                )}
              </div>
            </Accordion.Trigger>
            <Accordion.Content className="px-3 pb-3">
              <DayContent day={day} planId={planId} />
            </Accordion.Content>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}

function DayContent({
  day,
  planId,
}: {
  day: LearningPlanDayWithItems;
  planId: string;
}) {
  const items = [...(day.items || [])].sort(
    (a, b) => a.order_index - b.order_index,
  );

  return (
    <div className="space-y-4 pt-2">
      {/* Content / instructions */}
      {day.content_prompt && (
        <div className="rounded-lg bg-surface-1/50 border border-border p-4">
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Instruções / Contexto
          </h4>
          <div data-color-mode="dark">
            <MarkdownPreview
              source={day.content_prompt}
              style={{ background: 'transparent' }}
            />
          </div>
        </div>
      )}

      {/* Items */}
      {items.length > 0 && (
        <Accordion type="multiple" className="space-y-1">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </Accordion>
      )}

      {/* Go to execution */}
      <div className="flex justify-end pt-1">
        <Link href={`/learning/${planId}/day/${day.id}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ListChecks className="w-4 h-4" />
            Ir para execução
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function ItemRow({ item }: { item: LearningDayItem }) {
  const hasDescription = !!item.description;

  if (!hasDescription) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-surface-1/30">
        <div className="shrink-0">
          {item.is_completed ? (
            <CheckCircle2 className="h-4 w-4 text-brand-primary" fill="currentColor" />
          ) : (
            <Circle className="h-4 w-4 text-text-muted" />
          )}
        </div>
        <span
          className={`text-sm ${item.is_completed ? 'text-text-muted line-through' : 'text-text-primary'}`}
        >
          {item.title}
        </span>
      </div>
    );
  }

  return (
    <Accordion.Item
      value={item.id}
      className="border-border bg-surface-1/30 rounded-md overflow-hidden border-0"
    >
      <Accordion.Trigger className="hover:bg-surface-2 px-3 py-2">
        <div className="flex items-center gap-2.5 w-full">
          <div className="shrink-0">
            {item.is_completed ? (
              <CheckCircle2 className="h-4 w-4 text-brand-primary" fill="currentColor" />
            ) : (
              <Circle className="h-4 w-4 text-text-muted" />
            )}
          </div>
          <span
            className={`text-sm flex-1 text-left ${item.is_completed ? 'text-text-muted line-through' : 'text-text-primary'}`}
          >
            {item.title}
          </span>
        </div>
      </Accordion.Trigger>
      <Accordion.Content className="px-3 pb-3 pl-9">
        <div data-color-mode="dark">
          <MarkdownPreview
            source={item.description || ''}
            style={{ background: 'transparent' }}
          />
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
