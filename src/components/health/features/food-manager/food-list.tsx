'use client';

import { useState } from 'react';
import { Pencil, Plus, Search, Trash2, Globe, User, X } from 'lucide-react';
import { Button, Input, Skeleton, useToast } from '@phfront/millennium-ui';
import { useFoods } from '@/hooks/health/use-foods';
import { useDebounce } from '@/hooks/use-debounce';
import type { Food } from '@/types/nutrition';

interface FoodListProps {
  isAdmin?: boolean;
}

export function FoodList({ isAdmin = false }: FoodListProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const { foods, isLoading, createFood, updateFood, deleteFood } = useFoods(debouncedSearch);
  const { toast } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<Food>>({});

  const [showInlineForm, setShowInlineForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFood, setNewFood] = useState({
    name: '',
    kcal_per_100g: 0,
    protein_per_100g: 0,
    carbs_per_100g: 0,
    fat_per_100g: 0,
    serving_unit: 'g',
  });

  const trimmedQuery = debouncedSearch.trim();
  const showNoResultsCta = !isLoading && trimmedQuery.length > 0 && foods.length === 0;

  function startEdit(food: Food) {
    setEditingId(food.id);
    setEditValues({
      name: food.name,
      kcal_per_100g: food.kcal_per_100g,
      protein_per_100g: food.protein_per_100g,
      carbs_per_100g: food.carbs_per_100g,
      fat_per_100g: food.fat_per_100g,
      serving_unit: food.serving_unit ?? 'g',
    });
  }

  async function handleSave() {
    if (!editingId) return;
    try {
      await updateFood(editingId, editValues);
      toast.success('Alimento atualizado');
      setEditingId(null);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao atualizar');
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir "${name}"?`)) return;
    try {
      await deleteFood(id);
      toast.success('Alimento excluído');
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao excluir');
    }
  }

  function openCreateFromSearch() {
    setNewFood((prev) => ({
      ...prev,
      name: trimmedQuery,
      kcal_per_100g: 0,
      protein_per_100g: 0,
      carbs_per_100g: 0,
      fat_per_100g: 0,
      serving_unit: 'g',
    }));
    setShowInlineForm(true);
  }

  async function handleCreate(isGlobal = false) {
    if (!newFood.name.trim()) return;
    setCreating(true);
    try {
      await createFood({ ...newFood, name: newFood.name.trim() }, isGlobal);
      toast.success('Alimento cadastrado', newFood.name.trim());
      setShowInlineForm(false);
      setNewFood({
        name: '',
        kcal_per_100g: 0,
        protein_per_100g: 0,
        carbs_per_100g: 0,
        fat_per_100g: 0,
        serving_unit: 'g',
      });
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao cadastrar');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Buscar e filtrar</h3>
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar ou cadastrar alimento..."
          leftIcon={<Search size={16} />}
        />
      </div>

      {showNoResultsCta && !showInlineForm ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border bg-surface-3/50 px-4 py-3">
          <p className="text-sm text-text-secondary">
            Nenhum alimento encontrado para &quot;{trimmedQuery}&quot;.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Plus size={16} />}
            onClick={openCreateFromSearch}
            className="shrink-0 self-start sm:self-auto"
          >
            Cadastrar novo
          </Button>
        </div>
      ) : null}

      {showInlineForm ? (
        <div className="p-4 rounded-lg border border-brand-primary/30 bg-surface-2 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-text-primary">Cadastrar alimento</h4>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Fechar"
              onClick={() => setShowInlineForm(false)}
              leftIcon={<X size={16} />}
            />
          </div>
          <Input
            label="Nome do alimento"
            value={newFood.name}
            onChange={(e) => setNewFood((p) => ({ ...p, name: e.target.value }))}
            placeholder="Nome do alimento"
            disabled={creating}
          />
          <div className="grid grid-cols-2 gap-2">
            {(['kcal_per_100g', 'protein_per_100g', 'carbs_per_100g', 'fat_per_100g'] as const).map((field) => {
              const labels: Record<string, string> = {
                kcal_per_100g: 'Calorias',
                protein_per_100g: 'Proteína (g)',
                carbs_per_100g: 'Carboidratos (g)',
                fat_per_100g: 'Gordura (g)',
              };
              return (
                <Input
                  key={field}
                  type="number"
                  label={labels[field]}
                  min={0}
                  step={0.1}
                  value={String(newFood[field])}
                  onChange={(e) =>
                    setNewFood((p) => ({ ...p, [field]: parseFloat(e.target.value) || 0 }))
                  }
                  disabled={creating}
                />
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5">
            <Input
              label="Unidade de medida"
              placeholder="g"
              list="serving-unit-options-foodlist"
              value={newFood.serving_unit}
              onChange={(e) => setNewFood((p) => ({ ...p, serving_unit: e.target.value }))}
              className="max-w-24"
              disabled={creating}
            />
            <datalist id="serving-unit-options-foodlist">
              <option value="g" />
              <option value="ml" />
              <option value="un" />
            </datalist>
          </div>
          <p className="text-[10px] text-text-muted">Valores por 100{newFood.serving_unit} do alimento</p>
          <div className="flex gap-2 justify-end">
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => handleCreate(true)} disabled={creating}>
                Salvar como global
              </Button>
            )}
            <Button size="sm" onClick={() => handleCreate(false)} isLoading={creating} disabled={!newFood.name.trim()}>
              Salvar
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface-2 overflow-hidden">
        {isLoading ? (
          trimmedQuery ? (
            <p className="px-4 py-6 text-center text-sm text-text-muted">Buscando...</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-4 py-3">
                  <Skeleton variant="block" className="h-12 w-full" />
                </div>
              ))}
            </div>
          )
        ) : foods.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-text-muted">
            {!trimmedQuery
              ? 'Nenhum alimento no catálogo. Use a busca acima para filtrar ou cadastrar.'
              : showInlineForm
                ? 'Salve o formulário acima para adicionar ao catálogo.'
                : 'Nenhum resultado nesta busca.'}
          </p>
        ) : (
          foods.map((food) => {
            const isEditing = editingId === food.id;
            const canEdit = food.user_id !== null || isAdmin;

            return (
              <div key={food.id} className="px-4 py-3 flex flex-col gap-2">
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editValues.name ?? ''}
                      onChange={(e) => setEditValues((p) => ({ ...p, name: e.target.value }))}
                      className="px-3 py-1.5 text-sm rounded-md bg-surface-3 border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                    />
                    <div className="grid grid-cols-4 gap-2">
                      {(['kcal_per_100g', 'protein_per_100g', 'carbs_per_100g', 'fat_per_100g'] as const).map(
                        (field) => (
                          <input
                            key={field}
                            type="number"
                            min={0}
                            step={0.1}
                            value={editValues[field] ?? 0}
                            onChange={(e) =>
                              setEditValues((p) => ({
                                ...p,
                                [field]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="px-2 py-1 text-xs rounded-md bg-surface-3 border border-border text-text-primary tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                          />
                        ),
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">Unidade:</span>
                      <input
                        type="text"
                        list="serving-unit-options-edit"
                        value={editValues.serving_unit ?? 'g'}
                        onChange={(e) => setEditValues((p) => ({ ...p, serving_unit: e.target.value }))}
                        placeholder="g"
                        className="w-20 px-2 py-1 text-xs rounded-md bg-surface-3 border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                      />
                      <datalist id="serving-unit-options-edit">
                        <option value="g" />
                        <option value="ml" />
                        <option value="un" />
                      </datalist>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSave}>
                        Salvar
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {food.user_id === null ? (
                          <Globe size={12} className="text-blue-400 shrink-0" />
                        ) : (
                          <User size={12} className="text-text-muted shrink-0" />
                        )}
                        <span className="text-sm font-medium text-text-primary truncate">{food.name}</span>
                      </div>
                      <span className="text-xs text-text-muted tabular-nums">
                        {food.kcal_per_100g} kcal · {food.protein_per_100g}P · {food.carbs_per_100g}C · {food.fat_per_100g}G
                        (por 100{food.serving_unit ?? 'g'})
                      </span>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(food)}
                          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(food.id, food.name)}
                          className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-surface-3 transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
