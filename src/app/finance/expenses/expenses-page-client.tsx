'use client';

import { useState } from 'react';
import { PageHeader, Button } from '@phfront/millennium-ui';
import { Settings } from 'lucide-react';
import { ExpensesSheet } from '@/components/finance/features/expenses-sheet/ExpensesSheet';

export function ExpensesPageClient() {
  const [manageOpen, setManageOpen] = useState(false);

  return (
    <div className="flex flex-col max-w-full min-h-full">
      <PageHeader
        title="Despesas"
        subtitle="Controle suas despesas recorrentes por categoria."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setManageOpen(true)}
            leftIcon={<Settings size={14} />}
          >
            Gerenciar
          </Button>
        }
      />
      <div className="-mx-4 md:-mx-6 -mb-4 md:-mb-6">
        <ExpensesSheet manageOpen={manageOpen} onManageOpenChange={setManageOpen} />
      </div>
    </div>
  );
}