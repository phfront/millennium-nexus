'use client';

import { useState } from 'react';
import { Search, Plus, X } from 'lucide-react';
import { Button, Input, Spinner, useToast } from '@phfront/millennium-ui';
import { useFoods } from '@/hooks/health/use-foods';
import { useDebounce } from '@/hooks/use-debounce';
import type { Food } from '@/types/nutrition';

interface FoodSearchProps {
  onSelect: (food: Food) => void;
  isAdmin?: boolean;
  placeholder?: string;
}

export function FoodSearch({ onSelect, isAdmin = false, placeholder = 'Buscar alimento...' }: FoodSearchProps) {
  const [query, setQuery] = useState('');
  const [showInlineForm, setShowInlineForm] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const { foods, isLoading, createFood } = useFoods(debouncedQuery);
  const { toast } = useToast();

  const [newFood, setNewFood] = useState({
    name: '',
    kcal_per_100g: 0,
    protein_per_100g: 0,
    carbs_per_100g: 0,
    fat_per_100g: 0,
    serving_unit: 'g',
  });

  async function handleCreate(isGlobal = false) {
    if (!newFood.name.trim()) return;
    try {
      const created = await createFood(
        { ...newFood, name: newFood.name.trim() },
        isGlobal,
      );
      toast.success('Alimento cadastrado', created.name);
      setShowInlineForm(false);
      setNewFood({ name: '', kcal_per_100g: 0, protein_per_100g: 0, carbs_per_100g: 0, fat_per_100g: 0, serving_unit: 'g' });
      onSelect(created);
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao cadastrar');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        leftIcon={<Search size={16} />}
      />

      {/* Results */}
      {query.trim().length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-2 divide-y divide-border">
          {isLoading ? (
            <div className="px-3 py-3 flex items-center justify-center gap-2 text-xs text-text-muted">
              <Spinner size="sm" />
              Buscando...
            </div>
          ) : foods.length === 0 ? (
            <div className="px-3 py-3 flex items-center justify-between">
              <span className="text-xs text-text-muted">Nenhum resultado para &quot;{query}&quot;</span>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Plus size={14} />}
                onClick={() => {
                  setShowInlineForm(true);
                  setNewFood((prev) => ({ ...prev, name: query.trim() }));
                }}
              >
                Cadastrar
              </Button>
            </div>
          ) : (
            foods.map((food) => (
              <Button
                key={food.id}
                type="button"
                variant="ghost"
                className="w-full h-auto min-h-0 justify-start px-3 py-2.5 font-normal rounded-none border-0 shadow-none"
                onClick={() => {
                  onSelect(food);
                  setQuery('');
                }}
              >
                <div className="flex flex-col gap-0.5 items-start w-full text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-text-primary">{food.name}</span>
                    <span className="text-[10px] text-text-muted">· {food.user_id ? 'Meu' : 'Global'}</span>
                  </div>
                  <span className="text-[10px] text-text-muted tabular-nums">
                    {food.kcal_per_100g} kcal · {food.protein_per_100g}P · {food.carbs_per_100g}C · {food.fat_per_100g}G /100
                    {food.serving_unit ?? 'g'}
                  </span>
                </div>
              </Button>
            ))
          )}
          {foods.length > 0 && (
            <div className="px-3 py-2 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Plus size={14} />}
                onClick={() => {
                  setShowInlineForm(true);
                  setNewFood((prev) => ({ ...prev, name: query.trim() }));
                }}
              >
                Cadastrar novo
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Inline form */}
      {showInlineForm && (
        <div className="p-4 rounded-lg border border-brand-primary/30 bg-surface-2 flex flex-col gap-3 animate-in fade-in-0 slide-in-from-top-1">
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
                />
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5">
            <Input
              label="Unidade de medida"
              placeholder="g"
              list="serving-unit-options"
              value={newFood.serving_unit}
              onChange={(e) => setNewFood((p) => ({ ...p, serving_unit: e.target.value }))}
              className="max-w-24"
            />
            <datalist id="serving-unit-options">
              <option value="g" />
              <option value="ml" />
              <option value="un" />
            </datalist>
          </div>
          <p className="text-[10px] text-text-muted">Valores por 100{newFood.serving_unit} do alimento</p>
          <div className="flex gap-2 justify-end">
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => handleCreate(true)}>
                Salvar como global
              </Button>
            )}
            <Button size="sm" onClick={() => handleCreate(false)}>
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
