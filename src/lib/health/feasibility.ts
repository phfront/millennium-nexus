import { differenceInDays } from 'date-fns';
import type { AlertVariant } from '@phfront/millennium-ui';
import type { FeasibilityLevel, FeasibilityResult } from '@/types/health';

export function feasibilityToAlertVariant(level: FeasibilityLevel): AlertVariant {
  switch (level) {
    case 'safe':
      return 'success';
    case 'moderate':
      return 'info';
    case 'aggressive':
      return 'warning';
    case 'unfeasible':
      return 'danger';
  }
}

export function calcFeasibility(
  startWeight: number,
  targetWeight: number,
  targetDate: string,
): FeasibilityResult | null {
  if (!startWeight || !targetWeight || !targetDate) return null;
  const diff = startWeight - targetWeight;
  if (diff <= 0) return null;

  const days = differenceInDays(new Date(targetDate + 'T12:00:00'), new Date());
  if (days <= 0) return null;

  const weeks = days / 7;
  const weeklyRateNeeded = Math.round((diff / weeks) * 100) / 100;

  let level: FeasibilityLevel;
  let message: string;

  if (weeklyRateNeeded <= 0.5) {
    level = 'safe';
    message = 'Ritmo confortável e sustentável.';
  } else if (weeklyRateNeeded <= 1.0) {
    level = 'moderate';
    message = 'Ritmo viável, mas exige consistência.';
  } else if (weeklyRateNeeded <= 1.5) {
    level = 'aggressive';
    message = 'Ritmo desafiador. Consulte um profissional.';
  } else {
    level = 'unfeasible';
    message = 'Meta muito agressiva para o prazo. Ajuste a data ou o peso alvo.';
  }

  return { level, weeklyRateNeeded, message };
}
