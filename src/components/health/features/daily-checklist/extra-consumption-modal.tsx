'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button, useToast } from '@phfront/millennium-ui';
import { FoodSearch } from '@/components/health/features/food-manager/food-search';
import { useDietHistory } from '@/hooks/health/use-diet-history';
import { calcMacros, formatKcal } from '@/lib/health/nutrition';
import type { Food } from '@/types/nutrition';

interface ExtraConsumptionModalProps {
  onClose: () => void;
}

export function ExtraConsumptionModal({ onClose }: ExtraConsumptionModalProps) {
  const { addExtraConsumption } = useDietHistory();
  const { toast } = useToast();

  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!selectedFood) return;
    setSaving(true);
    try {
      await addExtraConsumption(selectedFood, quantity);
      toast.success('Registrado', `${selectedFood.name} — ${formatKcal(calcMacros(selectedFood, quantity).kcal)} kcal extra`);
      onClose();
    } catch (e) {
      toast.error('Erro', e instanceof Error ? e.message : 'Falha ao registrar');
    }
    setSaving(false);
  }

  const preview = selectedFood ? calcMacros(selectedFood, quantity) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0">
      <div className="w-full max-w-md bg-surface-2 rounded-t-2xl sm:rounded-2xl border border-border p-5 flex flex-col gap-4 animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Consumo extra</h3>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-text-muted">
          Registre algo que consumiu fora da dieta planejada. Será debitado do seu buffer semanal.
        </p>

        {!selectedFood ? (
          <FoodSearch onSelect={setSelectedFood} placeholder="Buscar o que você comeu..." />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="p-3 rounded-lg bg-surface-3 flex items-center justify-between">
              <span className="text-sm font-medium text-text-primary">{selectedFood.name}</span>
              <button
                onClick={() => setSelectedFood(null)}
                className="text-xs text-text-muted hover:text-text-primary cursor-pointer"
              >
                Trocar
              </button>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-text-secondary">Quantidade:</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 100)}
                className="w-20 px-3 py-2 text-sm rounded-lg bg-surface-3 border border-border text-text-primary tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
              <span className="text-sm text-text-muted">g</span>
            </div>

            {preview && (
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-2 rounded-lg bg-surface-3">
                  <p className="text-[10px] text-text-muted">Calorias</p>
                  <p className="text-xs font-bold text-orange-400 tabular-nums">{Math.round(preview.kcal)}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-surface-3">
                  <p className="text-[10px] text-text-muted">Prot</p>
                  <p className="text-xs font-bold text-blue-400 tabular-nums">{preview.protein.toFixed(1)}g</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-surface-3">
                  <p className="text-[10px] text-text-muted">Carb</p>
                  <p className="text-xs font-bold text-amber-400 tabular-nums">{preview.carbs.toFixed(1)}g</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-surface-3">
                  <p className="text-[10px] text-text-muted">Gord</p>
                  <p className="text-xs font-bold text-rose-400 tabular-nums">{preview.fat.toFixed(1)}g</p>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave} isLoading={saving}>
                Registrar extra
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
