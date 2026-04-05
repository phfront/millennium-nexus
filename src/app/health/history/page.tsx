import { PageHeader } from '@phfront/millennium-ui';
import { WeightHistoryClient } from '@/components/health/features/weight-history/weight-history-client';

export default function HistoryPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <PageHeader
        title="Histórico"
        subtitle="Todos os seus registros de peso."
      />
      <WeightHistoryClient />
    </div>
  );
}
