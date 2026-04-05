import { PageHeader } from '@phfront/millennium-ui';
import { WeightLogFormClient } from '@/components/health/features/weight-log-form/weight-log-form-client';

export default function NewLogPage() {
  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto">
      <PageHeader
        title="Registrar peso"
        subtitle="Anote seu peso de hoje."
      />
      <WeightLogFormClient />
    </div>
  );
}
