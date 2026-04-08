'use client';

import { useHouseholds } from '@/hooks/households/use-households';
import { useUserStore } from '@/store/user-store';
import { Users } from 'lucide-react';

interface HouseholdSelectorProps {
  value: string | null;
  onChange: (householdId: string | null) => void;
  placeholder?: string;
  includeNoneOption?: boolean;
  noneLabel?: string;
  className?: string;
}

export function HouseholdSelector({
  value,
  onChange,
  placeholder = 'Selecionar grupo',
  includeNoneOption = true,
  noneLabel = 'Nenhum (lista pessoal)',
  className = '',
}: HouseholdSelectorProps) {
  const { households, isLoading } = useHouseholds();
  const user = useUserStore((s) => s.user);

  const activeHouseholds = households.filter((h) =>
    h.members.some((m) => m.user_id === user?.id && m.status === 'active'),
  );

  if (isLoading) {
    return (
      <div className={`h-10 rounded-lg bg-surface-3 animate-pulse ${className}`} />
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
        <Users size={15} className="text-text-muted" />
      </div>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full appearance-none rounded-lg border border-border bg-surface-2 py-2 pl-9 pr-4 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
      >
        {includeNoneOption && <option value="">{noneLabel}</option>}
        {activeHouseholds.length === 0 && !includeNoneOption && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {activeHouseholds.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </select>
    </div>
  );
}
