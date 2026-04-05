import { CheckCircle, TrendingDown, TrendingUp, Clock } from 'lucide-react';
import { format, parseISO, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { weeklyRate, projectedDate } from '@/lib/health/projection';
import type { WeightLog, HealthSettings } from '@/types/health';

interface ProjectionPanelProps {
  logs: WeightLog[];
  settings: HealthSettings;
  currentWeight: number;
}

export function ProjectionPanel({ logs, settings, currentWeight }: ProjectionPanelProps) {
  const targetReached = currentWeight <= settings.target_weight;

  if (targetReached) {
    return (
      <div className="flex items-center gap-3 p-4 bg-success/10 border border-success/30 rounded-xl text-success">
        <CheckCircle size={20} className="shrink-0" />
        <div>
          <p className="font-semibold text-sm">Meta alcançada! 🎉</p>
          <p className="text-xs opacity-80">Parabéns por chegar ao seu objetivo.</p>
        </div>
      </div>
    );
  }

  if (logs.length < 2) {
    return (
      <div className="flex items-center gap-3 p-4 bg-surface-2 border border-border rounded-xl text-text-muted text-sm">
        <Clock size={18} className="shrink-0" />
        <p>Continue registrando para ver sua projeção de data.</p>
      </div>
    );
  }

  const rate = weeklyRate(logs);

  if (!rate || rate <= 0) {
    return (
      <div className="flex items-center gap-3 p-4 bg-danger/10 border border-danger/30 rounded-xl text-danger">
        <TrendingUp size={20} className="shrink-0" />
        <div>
          <p className="font-semibold text-sm">Sem progresso recente</p>
          <p className="text-xs opacity-80">Nas últimas 4 semanas o peso não diminuiu. Reveja seus hábitos.</p>
        </div>
      </div>
    );
  }

  const predicted = projectedDate(currentWeight, settings.target_weight, rate);
  const targetDateObj = parseISO(settings.target_date + 'T12:00:00');
  const onTrack = predicted ? isBefore(predicted, targetDateObj) || predicted.toDateString() === targetDateObj.toDateString() : false;
  const predictedStr = predicted ? format(predicted, "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : null;
  const targetStr = format(targetDateObj, "d 'de' MMMM 'de' yyyy", { locale: ptBR });

  if (onTrack) {
    return (
      <div className="flex flex-col gap-2 p-4 bg-success/10 border border-success/30 rounded-xl text-success">
        <div className="flex items-center gap-2">
          <TrendingDown size={18} className="shrink-0" />
          <span className="font-semibold text-sm">No caminho certo!</span>
        </div>
        <p className="text-xs opacity-80">
          Ritmo atual: <strong>{rate.toFixed(2)} kg/semana</strong>
        </p>
        <p className="text-xs opacity-80">
          Previsão de alcance: <strong>{predictedStr}</strong>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400">
      <div className="flex items-center gap-2">
        <Clock size={18} className="shrink-0" />
        <span className="font-semibold text-sm">Ritmo abaixo do necessário</span>
      </div>
      <p className="text-xs opacity-80">
        Ritmo atual: <strong>{rate.toFixed(2)} kg/semana</strong>
      </p>
      <p className="text-xs opacity-80">
        Previsão real: <strong>{predictedStr}</strong> (meta: {targetStr})
      </p>
    </div>
  );
}
