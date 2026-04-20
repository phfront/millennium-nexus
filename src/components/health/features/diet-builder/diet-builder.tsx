'use client';

import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import {
  Accordion,
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  Modal,
  Skeleton,
  Spinner,
  StatCard,
  TimePicker,
  useAccordionItem,
  useToast,
} from '@phfront/millennium-ui';
import { useDietPlan } from '@/hooks/health/use-diet-plan';
import { FoodSearch } from '@/components/health/features/food-manager/food-search';
import {
  calcMacros,
  formatKcal,
  formatGrams,
  formatQuantity,
  sumPlannedKcalRangeFromMeals,
} from '@/lib/health/nutrition';
import type { Food, FoodSubstitution, DietPlanMealWithItems } from '@/types/nutrition';

export function DietBuilder() {
  const {
    plan, meals, isLoading,
    createPlan, renamePlan,
    addMeal, updateMeal, deleteMeal,
    addMealItem, updateMealItem, removeMealItem,
    addSubstitution, updateSubstitution, removeSubstitution,
  } = useDietPlan();
  const { toast } = useToast();

  const [newPlanName, setNewPlanName] = useState('');
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [expandedMealIds, setExpandedMealIds] = useState<string[]>([]);

  // Modal states
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [addMealName, setAddMealName] = useState('');
  const [addingMeal, setAddingMeal] = useState(false);

  const [showDeleteMealModal, setShowDeleteMealModal] = useState<{ id: string; name: string } | null>(null);
  const [deletingMeal, setDeletingMeal] = useState(false);

  const [showAddItemModal, setShowAddItemModal] = useState<{ mealId: string; mealName: string } | null>(null);

  const [showDeleteItemModal, setShowDeleteItemModal] = useState<{ mealId: string; itemId: string; foodName: string } | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  type MealItemQtyModal =
    | { mode: 'edit'; itemId: string; foodName: string; qty: number; units: number; servingUnit: string }
    | {
        mode: 'add';
        mealId: string;
        foodId: string;
        foodName: string;
        qty: number;
        units: number;
        servingUnit: string;
      };
  const [showEditQtyModal, setShowEditQtyModal] = useState<MealItemQtyModal | null>(null);
  const [savingQty, setSavingQty] = useState(false);

  // Modal apenas para adicionar substituição (edição/remoção ficam na lista)
  const [showSubsModal, setShowSubsModal] = useState<{ itemId: string; foodName: string } | null>(null);
  const [subQuantity, setSubQuantity] = useState(100);
  const [subUnits, setSubUnits] = useState(1);
  const [addingSub, setAddingSub] = useState(false);
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editSubQty, setEditSubQty] = useState(0);
  const [editSubUnits, setEditSubUnits] = useState(1);
  const [savingSubQty, setSavingSubQty] = useState(false);

  const [showEditMealModal, setShowEditMealModal] = useState<{
    mealId: string;
    name: string;
    time: string;
  } | null>(null);
  const [savingMealEdit, setSavingMealEdit] = useState(false);

  // --- Handlers ---
  async function handleCreatePlan() {
    if (!newPlanName.trim()) return;
    setCreatingPlan(true);
    try {
      await createPlan(newPlanName.trim());
      toast.success('Plano criado');
      setNewPlanName('');
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao criar');
    } finally {
      setCreatingPlan(false);
    }
  }

  async function handleAddMeal() {
    if (!addMealName.trim()) return;
    setAddingMeal(true);
    try {
      await addMeal(addMealName.trim());
      toast.success('Refeição adicionada');
      setAddMealName('');
      setShowAddMealModal(false);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao adicionar refeição');
    } finally {
      setAddingMeal(false);
    }
  }

  async function handleDeleteMeal() {
    if (!showDeleteMealModal) return;
    setDeletingMeal(true);
    try {
      await deleteMeal(showDeleteMealModal.id);
      toast.success('Refeição excluída');
      setShowDeleteMealModal(null);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao excluir');
    } finally {
      setDeletingMeal(false);
    }
  }

  function handlePickFoodToAdd(food: Food) {
    if (!showAddItemModal) return;
    const { mealId } = showAddItemModal;
    setShowAddItemModal(null);
    setShowEditQtyModal({
      mode: 'add',
      mealId,
      foodId: food.id,
      foodName: food.name,
      qty: 100,
      units: 1,
      servingUnit: food.serving_unit ?? 'g',
    });
  }

  async function handleDeleteItem() {
    if (!showDeleteItemModal) return;
    setDeletingItem(true);
    try {
      await removeMealItem(showDeleteItemModal.mealId, showDeleteItemModal.itemId);
      toast.success('Alimento removido');
      setShowDeleteItemModal(null);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao remover');
    } finally {
      setDeletingItem(false);
    }
  }

  async function handleSaveQty() {
    if (!showEditQtyModal) return;
    setSavingQty(true);
    try {
      if (showEditQtyModal.mode === 'edit') {
        await updateMealItem(showEditQtyModal.itemId, showEditQtyModal.qty, showEditQtyModal.units);
        toast.success('Quantidade atualizada');
      } else {
        await addMealItem(showEditQtyModal.mealId, showEditQtyModal.foodId, showEditQtyModal.qty, showEditQtyModal.units);
        toast.success('Alimento adicionado');
      }
      setShowEditQtyModal(null);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao salvar');
    } finally {
      setSavingQty(false);
    }
  }

  function openSubsAddModal(itemId: string, foodName: string) {
    setEditingSubId(null);
    setShowSubsModal({ itemId, foodName });
    setSubQuantity(100);
    setSubUnits(1);
  }

  async function handleAddSub(food: Food) {
    if (!showSubsModal) return;
    setAddingSub(true);
    try {
      await addSubstitution(showSubsModal.itemId, food.id, subQuantity, subUnits);
      toast.success('Substituição adicionada');
      setShowSubsModal(null);
      setSubQuantity(100);
      setSubUnits(1);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao adicionar substituição');
    } finally {
      setAddingSub(false);
    }
  }

  async function handleDeleteSub(subId: string) {
    setDeletingSubId(subId);
    try {
      await removeSubstitution(subId);
      setEditingSubId((current) => (current === subId ? null : current));
      toast.success('Substituição removida');
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao remover');
    } finally {
      setDeletingSubId(null);
    }
  }

  async function handleSaveSubQty() {
    if (!editingSubId) return;
    setSavingSubQty(true);
    try {
      await updateSubstitution(editingSubId, editSubQty, editSubUnits);
      toast.success('Quantidade atualizada');
      setEditingSubId(null);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao atualizar');
    } finally {
      setSavingSubQty(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton variant="block" className="h-12 w-full" />
        <Skeleton variant="block" className="h-32 w-full" />
        <Skeleton variant="block" className="h-32 w-full" />
      </div>
    );
  }

  // --- No active plan: create one ---
  if (!plan) {
    return (
      <EmptyState
        title="Nenhum plano ativo"
        description="Crie um plano de dieta para começar a montar refeições e substituições."
        className="py-12"
        action={
          <div className="flex flex-col sm:flex-row gap-2 w-full max-w-md">
            <div className="flex-1 min-w-0">
              <Input
                placeholder="Nome do plano (ex: Dieta Cutting)"
                value={newPlanName}
                onChange={(e) => setNewPlanName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePlan()}
                disabled={creatingPlan}
              />
            </div>
            <Button
              onClick={handleCreatePlan}
              isLoading={creatingPlan}
              leftIcon={<Plus size={16} />}
              className="shrink-0"
            >
              Criar
            </Button>
          </div>
        }
      />
    );
  }

  // --- Calculate plan totals ---
  const planTotals = meals.reduce(
    (acc, meal) => {
      for (const item of meal.items) {
        const macros = calcMacros(item.food, item.quantity_g);
        const units = item.quantity_units ?? 1;
        acc.kcal += macros.kcal * units;
        acc.protein += macros.protein * units;
        acc.carbs += macros.carbs * units;
        acc.fat += macros.fat * units;
      }
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  const planKcalRange = sumPlannedKcalRangeFromMeals(meals);
  const caloriesDisplay =
    planKcalRange.min === planKcalRange.max
      ? formatKcal(planKcalRange.min)
      : `${formatKcal(planKcalRange.min)} – ${formatKcal(planKcalRange.max)}`;

  return (
    <div className="flex flex-col gap-5">
      {/* Plan header */}
      <Card className="rounded-xl shadow-none">
        <Card.Body className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1.5 min-w-0">
              <h3 className="text-sm font-semibold text-text-primary truncate">{plan.name}</h3>
              <Badge variant="success" size="sm" className="w-fit">
                Ativo
              </Badge>
            </div>
          </div>
          <div
            className={[
              'grid grid-cols-2 gap-2 sm:grid-cols-4',
              'max-[500px]:[&>div>span.font-bold]:text-base! max-[500px]:[&>div>span.font-bold]:leading-snug!',
              'max-[500px]:[&>div>div>span]:text-[10px]! max-[500px]:[&>div>div>span]:leading-tight!',
              'max-[500px]:[&>div>span.text-xs]:text-[10px]! max-[500px]:[&>div>span.text-xs]:leading-snug!',
            ].join(' ')}
          >
            <StatCard
              label="Calorias"
              value={caloriesDisplay}
              valueSize="md"
              className="p-2.5 max-[500px]:p-2!"
              sub={
                planKcalRange.min !== planKcalRange.max
                  ? 'Mín. e máx. conforme substituições por item'
                  : undefined
              }
            />
            <StatCard
              label="Proteína"
              value={formatGrams(planTotals.protein)}
              valueSize="md"
              className="p-2.5 max-[500px]:p-2! [&_span.font-bold]:text-blue-400"
            />
            <StatCard
              label="Carboidratos"
              value={formatGrams(planTotals.carbs)}
              valueSize="md"
              className="p-2.5 max-[500px]:p-2! [&_span.font-bold]:text-amber-400"
            />
            <StatCard
              label="Gordura"
              value={formatGrams(planTotals.fat)}
              valueSize="md"
              className="p-2.5 max-[500px]:p-2! [&_span.font-bold]:text-rose-400"
            />
          </div>
        </Card.Body>
      </Card>

      {/* Meals */}
      <Accordion
        type="multiple"
        className="flex flex-col gap-3"
        value={expandedMealIds}
        onValueChange={(v) => setExpandedMealIds(Array.isArray(v) ? v : v ? [v] : [])}
      >
        {meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            onOpenAddItem={() => setShowAddItemModal({ mealId: meal.id, mealName: meal.name })}
            onOpenDeleteItem={(itemId, foodName) => setShowDeleteItemModal({ mealId: meal.id, itemId, foodName })}
            onOpenDeleteMeal={() => setShowDeleteMealModal({ id: meal.id, name: meal.name })}
            onOpenEditQty={(itemId, foodName, qty, units, servingUnit) =>
              setShowEditQtyModal({ mode: 'edit', itemId, foodName, qty, units, servingUnit })
            }
            onOpenSubsAdd={openSubsAddModal}
            editingSubId={editingSubId}
            editSubQty={editSubQty}
            editSubUnits={editSubUnits}
            savingSubQty={savingSubQty}
            deletingSubId={deletingSubId}
            onStartEditSub={(sub) => {
              setEditingSubId(sub.id);
              setEditSubQty(sub.substitute_quantity_g);
              setEditSubUnits(sub.substitute_quantity_units ?? 1);
            }}
            onChangeEditSubUnits={(u) => setEditSubUnits(u)}
            onChangeEditSubQty={(q) => setEditSubQty(q)}
            onCancelEditSub={() => setEditingSubId(null)}
            onSaveEditSub={() => void handleSaveSubQty()}
            onDeleteSub={(id) => void handleDeleteSub(id)}
            onOpenEditMeal={() =>
              setShowEditMealModal({
                mealId: meal.id,
                name: meal.name,
                time: meal.target_time?.slice(0, 5) ?? '',
              })
            }
          />
        ))}
      </Accordion>

      {/* Add meal button */}
      <Button variant="outline" onClick={() => { setAddMealName(''); setShowAddMealModal(true); }} leftIcon={<Plus size={16} />} className="w-full">
        Nova Refeição
      </Button>

      {/* ====== MODALS ====== */}

      {/* Add Meal Modal */}
      <Modal isOpen={showAddMealModal} onClose={() => !addingMeal && setShowAddMealModal(false)} title="Nova Refeição">
        <div className="flex flex-col gap-4">
          <Input
            label="Nome da refeição"
            value={addMealName}
            onChange={(e) => setAddMealName(e.target.value)}
            placeholder="Ex: Café da manhã"
            onKeyDown={(e) => e.key === 'Enter' && handleAddMeal()}
            autoFocus
            disabled={addingMeal}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAddMealModal(false)} disabled={addingMeal}>
              Cancelar
            </Button>
            <Button onClick={handleAddMeal} isLoading={addingMeal} disabled={!addMealName.trim()}>
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Meal Modal */}
      <Modal isOpen={!!showDeleteMealModal} onClose={() => !deletingMeal && setShowDeleteMealModal(null)} title="Excluir Refeição">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Tem certeza que deseja excluir <strong className="text-text-primary">{showDeleteMealModal?.name}</strong> e todos os seus alimentos?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowDeleteMealModal(null)} disabled={deletingMeal}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteMeal} isLoading={deletingMeal}>
              Excluir
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Item Modal */}
      <Modal isOpen={!!showAddItemModal} onClose={() => setShowAddItemModal(null)} title={`Adicionar alimento — ${showAddItemModal?.mealName ?? ''}`}>
        <div className="flex flex-col gap-4">
          <FoodSearch onSelect={handlePickFoodToAdd} placeholder="Buscar alimento para adicionar..." />
        </div>
      </Modal>

      {/* Delete Item Modal */}
      <Modal isOpen={!!showDeleteItemModal} onClose={() => !deletingItem && setShowDeleteItemModal(null)} title="Remover Alimento">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Remover <strong className="text-text-primary">{showDeleteItemModal?.foodName}</strong> desta refeição?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowDeleteItemModal(null)} disabled={deletingItem}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteItem} isLoading={deletingItem}>
              Remover
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Quantity Modal */}
      <Modal
        isOpen={!!showEditQtyModal}
        onClose={() => !savingQty && setShowEditQtyModal(null)}
        title={showEditQtyModal?.mode === 'add' ? 'Quantidade do alimento' : 'Editar quantidade'}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Quantidade para <strong className="text-text-primary">{showEditQtyModal?.foodName}</strong>
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              type="number"
              label="Porções"
              min={1}
              className="w-24"
              value={String(showEditQtyModal?.units ?? 1)}
              onChange={(e) =>
                setShowEditQtyModal((p) => (p ? { ...p, units: parseInt(e.target.value, 10) || 1 } : null))
              }
              disabled={savingQty}
            />
            <span className="text-sm text-text-muted pb-2.5">×</span>
            <Input
              type="number"
              label={`Quantidade (${showEditQtyModal?.servingUnit ?? 'g'} cada)`}
              min={1}
              step="any"
              className="min-w-32 flex-1"
              value={String(showEditQtyModal?.qty ?? 0)}
              onChange={(e) =>
                setShowEditQtyModal((p) => (p ? { ...p, qty: parseFloat(e.target.value) || 0 } : null))
              }
              onKeyDown={(e) => e.key === 'Enter' && handleSaveQty()}
              disabled={savingQty}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowEditQtyModal(null)} disabled={savingQty}>
              Cancelar
            </Button>
            <Button onClick={handleSaveQty} isLoading={savingQty}>
              {showEditQtyModal?.mode === 'add' ? 'Adicionar' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Nova substituição (busca de alimento) */}
      <Modal
        isOpen={!!showSubsModal}
        onClose={() => !addingSub && setShowSubsModal(null)}
        title={`Nova substituição — ${showSubsModal?.foodName ?? ''}`}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-2">
            <Input
              type="number"
              label="Porções"
              min={1}
              className="w-24"
              value={String(subUnits)}
              onChange={(e) => setSubUnits(parseInt(e.target.value, 10) || 1)}
              disabled={addingSub}
            />
            <span className="text-sm text-text-muted pb-2.5">×</span>
            <Input
              type="number"
              label="Gramas"
              min={1}
              step="any"
              className="w-28"
              value={String(subQuantity)}
              onChange={(e) => setSubQuantity(parseFloat(e.target.value) || 100)}
              disabled={addingSub}
            />
          </div>
          {addingSub ? (
            <div className="flex items-center justify-center gap-2 py-6 text-text-muted">
              <Spinner size="md" />
              <span className="text-sm">Adicionando...</span>
            </div>
          ) : (
            <FoodSearch onSelect={handleAddSub} placeholder="Buscar substituto..." />
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!showEditMealModal}
        onClose={() => !savingMealEdit && setShowEditMealModal(null)}
        title="Editar refeição"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Nome da refeição"
            value={showEditMealModal?.name ?? ''}
            onChange={(e) =>
              setShowEditMealModal((p) => (p ? { ...p, name: e.target.value } : null))
            }
            placeholder="Ex: Café da manhã"
            disabled={savingMealEdit}
          />
          <TimePicker
            label="Horário"
            value={showEditMealModal?.time || undefined}
            onChange={(t) => setShowEditMealModal((p) => (p ? { ...p, time: t ?? '' } : null))}
            minuteStep={5}
            clearable
            disabled={savingMealEdit}
          />
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              variant="ghost"
              onClick={async () => {
                if (!showEditMealModal) return;
                setSavingMealEdit(true);
                try {
                  await updateMeal(showEditMealModal.mealId, { target_time: null });
                  setShowEditMealModal((p) => (p ? { ...p, time: '' } : null));
                  toast.success('Horário removido');
                } catch (e) {
                  toast.error('Erro', e instanceof Error ? e.message : 'Falha ao remover horário');
                } finally {
                  setSavingMealEdit(false);
                }
              }}
              disabled={savingMealEdit || !showEditMealModal?.time}
              className="text-danger"
            >
              Remover horário
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowEditMealModal(null)} disabled={savingMealEdit}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!showEditMealModal) return;
                  const trimmed = showEditMealModal.name.trim();
                  if (!trimmed) {
                    toast.error('Erro', 'Informe o nome da refeição.');
                    return;
                  }
                  setSavingMealEdit(true);
                  try {
                    await updateMeal(showEditMealModal.mealId, {
                      name: trimmed,
                      target_time: showEditMealModal.time || null,
                    });
                    toast.success('Refeição atualizada');
                    setShowEditMealModal(null);
                  } catch (e) {
                    toast.error('Erro', e instanceof Error ? e.message : 'Falha ao salvar');
                  } finally {
                    setSavingMealEdit(false);
                  }
                }}
                isLoading={savingMealEdit}
                disabled={!showEditMealModal?.name.trim()}
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function FoodItemAccordionHeader({
  item,
  units,
  macrosKcal,
  onOpenEditQty,
  onOpenDeleteItem,
}: {
  item: DietPlanMealWithItems['items'][number];
  units: number;
  macrosKcal: number;
  onOpenEditQty: () => void;
  onOpenDeleteItem: () => void;
}) {
  const { isExpanded, toggle, triggerId, contentId } = useAccordionItem();
  const subCount = (item.substitutions ?? []).length;
  const substTitle =
    subCount === 0
      ? 'Nenhuma substituição cadastrada'
      : subCount === 1
        ? '1 substituição cadastrada'
        : `${subCount} substituições cadastradas`;

  return (
    <div className="flex w-full items-center bg-surface-2/40 hover:bg-surface-3/35 transition-colors">
      <button
        type="button"
        id={triggerId}
        aria-controls={contentId}
        aria-expanded={isExpanded}
        onClick={toggle}
        className="flex-1 min-w-0 flex flex-col items-stretch gap-1 px-3 py-2 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-inset"
      >
        <span className="text-sm text-text-primary truncate pr-1">{item.food.name}</span>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums text-text-secondary">
          <span>
            {units > 1 && <span>{units}× </span>}
            {formatQuantity(item.quantity_g, item.food.serving_unit)}
          </span>
          <span className="text-text-muted">{macrosKcal} kcal</span>
          <span className="text-text-muted whitespace-nowrap" title={substTitle}>
            {subCount === 0 ? '0 subst.' : `${subCount} subst.`}
          </span>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-0 border-l border-border/50 px-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8! min-h-8! w-8! min-w-8! shrink-0 rounded-none p-0"
          aria-label="Editar quantidade"
          title="Editar quantidade"
          onClick={(e) => {
            e.preventDefault();
            onOpenEditQty();
          }}
          leftIcon={<Icon name="Pencil" size={14} />}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8! min-h-8! w-8! min-w-8! shrink-0 rounded-none p-0 text-text-muted hover:text-danger"
          aria-label="Remover alimento"
          title="Remover alimento"
          onClick={(e) => {
            e.preventDefault();
            onOpenDeleteItem();
          }}
          leftIcon={<Icon name="Trash2" size={14} />}
        />
        <button
          type="button"
          aria-label={isExpanded ? 'Ocultar substituições' : 'Ver substituições'}
          aria-controls={contentId}
          onClick={toggle}
          className="flex h-8 w-8 shrink-0 items-center justify-center text-text-muted hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
        >
          <ChevronDown
            className={[
              'w-4 h-4 transition-transform duration-300 ease-out',
              isExpanded ? 'rotate-180' : 'rotate-0',
            ].join(' ')}
          />
        </button>
      </div>
    </div>
  );
}

function MealAccordionHeader({
  meal,
  mealMacros,
  onOpenEditMeal,
}: {
  meal: DietPlanMealWithItems;
  mealMacros: { kcal: number; protein: number; carbs: number; fat: number };
  onOpenEditMeal: () => void;
}) {
  const { isExpanded, toggle, triggerId, contentId } = useAccordionItem();

  return (
    <div className="flex w-full items-stretch bg-surface-2 hover:bg-surface-3 transition-[background-color] duration-200 ease-out">
      <button
        type="button"
        id={triggerId}
        aria-controls={contentId}
        aria-expanded={isExpanded}
        onClick={toggle}
        className="flex-1 min-w-0 flex flex-col gap-0.5 items-start px-4 py-3 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 focus-visible:ring-inset"
      >
        <span className="text-sm font-semibold text-text-primary truncate w-full">{meal.name}</span>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-text-muted">
            <Icon name="Clock" size={12} />
            <span className="text-xs tabular-nums">{meal.target_time ? meal.target_time.slice(0, 5) : '--:--'}</span>
          </span>
          <span className="text-xs tabular-nums text-text-muted">{formatKcal(mealMacros.kcal)} kcal</span>
          <span className="text-xs text-text-muted">
            {meal.items.length} {meal.items.length === 1 ? 'item' : 'itens'}
          </span>
        </div>
      </button>
      <div className="flex items-stretch shrink-0 self-stretch border-l border-border/60">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-auto min-h-10 w-10 shrink-0 rounded-none"
          aria-label="Editar refeição"
          title="Editar nome e horário"
          onClick={(e) => {
            e.preventDefault();
            onOpenEditMeal();
          }}
          leftIcon={<Icon name="Pencil" size={18} />}
        />
        <button
          type="button"
          aria-label={isExpanded ? 'Recolher refeição' : 'Expandir refeição'}
          aria-controls={contentId}
          onClick={toggle}
          className="flex items-center justify-center w-10 shrink-0 text-text-muted hover:text-text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50"
        >
          <ChevronDown
            className={[
              'w-5 h-5 transition-transform duration-300 ease-out',
              isExpanded ? 'rotate-180' : 'rotate-0',
            ].join(' ')}
          />
        </button>
      </div>
    </div>
  );
}

// --- MealCard (Accordion.Item; modals no pai) ---
interface MealCardProps {
  meal: DietPlanMealWithItems;
  onOpenAddItem: () => void;
  onOpenDeleteItem: (itemId: string, foodName: string) => void;
  onOpenDeleteMeal: () => void;
  onOpenEditQty: (itemId: string, foodName: string, qty: number, units: number, servingUnit: string) => void;
  onOpenSubsAdd: (itemId: string, foodName: string) => void;
  editingSubId: string | null;
  editSubQty: number;
  editSubUnits: number;
  savingSubQty: boolean;
  deletingSubId: string | null;
  onStartEditSub: (sub: FoodSubstitution) => void;
  onChangeEditSubUnits: (units: number) => void;
  onChangeEditSubQty: (qty: number) => void;
  onCancelEditSub: () => void;
  onSaveEditSub: () => void;
  onDeleteSub: (subId: string) => void;
  onOpenEditMeal: () => void;
}

function MealCard({
  meal,
  onOpenAddItem,
  onOpenDeleteItem,
  onOpenDeleteMeal,
  onOpenEditQty,
  onOpenSubsAdd,
  editingSubId,
  editSubQty,
  editSubUnits,
  savingSubQty,
  deletingSubId,
  onStartEditSub,
  onChangeEditSubUnits,
  onChangeEditSubQty,
  onCancelEditSub,
  onSaveEditSub,
  onDeleteSub,
  onOpenEditMeal,
}: MealCardProps) {
  const [expandedFoodIds, setExpandedFoodIds] = useState<string[]>([]);

  const mealMacros = meal.items.reduce(
    (acc, item) => {
      const m = calcMacros(item.food, item.quantity_g);
      const units = item.quantity_units ?? 1;
      return {
        kcal: acc.kcal + m.kcal * units,
        protein: acc.protein + m.protein * units,
        carbs: acc.carbs + m.carbs * units,
        fat: acc.fat + m.fat * units,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return (
    <Accordion.Item value={meal.id} className="rounded-xl">
      <MealAccordionHeader meal={meal} mealMacros={mealMacros} onOpenEditMeal={onOpenEditMeal} />

      <Accordion.Content>
        <div className="flex flex-col gap-3 -mt-1">
          <Accordion
            type="multiple"
            className="flex flex-col gap-2"
            value={expandedFoodIds}
            onValueChange={(v) => setExpandedFoodIds(Array.isArray(v) ? v : v ? [v] : [])}
          >
            {meal.items.map((item) => {
              const macros = calcMacros(item.food, item.quantity_g);
              const units = item.quantity_units ?? 1;
              const subs = item.substitutions ?? [];
              const macrosKcal = Math.round(macros.kcal * units);

              return (
                <Accordion.Item
                  key={item.id}
                  value={item.id}
                  className="rounded-lg border border-border/60 bg-surface-2/25 overflow-hidden shadow-none"
                >
                  <FoodItemAccordionHeader
                    item={item}
                    units={units}
                    macrosKcal={macrosKcal}
                    onOpenEditQty={() =>
                      onOpenEditQty(item.id, item.food.name, item.quantity_g, units, item.food.serving_unit ?? 'g')
                    }
                    onOpenDeleteItem={() => onOpenDeleteItem(item.id, item.food.name)}
                  />
                  <Accordion.Content>
                    <div className="px-2 pb-2">
                      <Card className="shadow-none border-dashed border-border bg-surface-3/40">
                        <Card.Body className="p-2.5 pl-3 flex flex-col gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                      Substituições
                    </p>
                    {subs.length === 0 ? (
                      <p className="text-xs text-text-muted">Nenhuma substituição cadastrada.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {subs.map((sub) => {
                          const sm = sub.substitute_food
                            ? calcMacros(sub.substitute_food, sub.substitute_quantity_g)
                            : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
                          const u = sub.substitute_quantity_units ?? 1;
                          const isEditing = editingSubId === sub.id;
                          return (
                            <li
                              key={sub.id}
                              className="flex items-start justify-between gap-2 text-xs border-b border-border/60 pb-2 last:border-0 last:pb-0"
                            >
                              <div className="min-w-0 flex-1 flex flex-col gap-1">
                                {isEditing ? (
                                  <div className="flex flex-wrap items-end gap-1.5">
                                    <Input
                                      type="number"
                                      min={1}
                                      className="w-14 h-8 text-xs"
                                      value={String(editSubUnits)}
                                      onChange={(e) =>
                                        onChangeEditSubUnits(parseInt(e.target.value, 10) || 1)
                                      }
                                      disabled={savingSubQty}
                                    />
                                    <span className="text-[10px] text-text-muted pb-2">×</span>
                                    <Input
                                      type="number"
                                      min={1}
                                      step="any"
                                      className="w-20 h-8 text-xs"
                                      value={String(editSubQty)}
                                      onChange={(e) =>
                                        onChangeEditSubQty(parseFloat(e.target.value) || 0)
                                      }
                                      onKeyDown={(e) => e.key === 'Enter' && onSaveEditSub()}
                                      disabled={savingSubQty}
                                    />
                                    <span className="text-[10px] text-text-muted pb-2">
                                      {sub.substitute_food?.serving_unit ?? 'g'}
                                    </span>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-text-secondary">{sub.substitute_food?.name ?? '—'}</span>
                                    <span className="text-text-muted tabular-nums">
                                      {u > 1 && `${u}× `}
                                      {sub.substitute_food
                                        ? formatQuantity(sub.substitute_quantity_g, sub.substitute_food.serving_unit ?? 'g')
                                        : '—'}
                                      <span> · {Math.round(sm.kcal * u)} kcal</span>
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                {isEditing ? (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={onSaveEditSub}
                                      isLoading={savingSubQty}
                                      disabled={savingSubQty}
                                    >
                                      Salvar
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={onCancelEditSub}
                                      disabled={savingSubQty}
                                    >
                                      Cancelar
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      aria-label="Editar substituição"
                                      title="Editar quantidade"
                                      onClick={() => onStartEditSub(sub)}
                                      leftIcon={<Icon name="Pencil" size={14} />}
                                    />
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      aria-label="Remover substituição"
                                      title="Remover substituição"
                                      onClick={() => onDeleteSub(sub.id)}
                                      isLoading={deletingSubId === sub.id}
                                      className="text-text-muted hover:text-danger"
                                      leftIcon={<Icon name="Trash2" size={14} />}
                                    />
                                  </>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      leftIcon={<Plus size={14} />}
                      className="w-full shrink-0"
                      onClick={() => onOpenSubsAdd(item.id, item.food.name)}
                    >
                      Adicionar substituição
                    </Button>
                        </Card.Body>
                      </Card>
                    </div>
                  </Accordion.Content>
                </Accordion.Item>
              );
            })}
          </Accordion>

          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" variant="ghost" leftIcon={<Plus size={14} />} onClick={onOpenAddItem}>
              Adicionar alimento
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Icon name="Trash2" size={14} />}
              onClick={onOpenDeleteMeal}
              className="ml-auto text-danger hover:text-danger"
            >
              Excluir refeição
            </Button>
          </div>
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
