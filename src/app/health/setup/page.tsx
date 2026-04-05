import { PageHeader } from '@phfront/millennium-ui';
import { SetupForm } from '@/components/health/features/setup-form/setup-form';

export default function SetupPage() {
  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto">
      <PageHeader
        title="Configurar meta"
        subtitle="Defina seu peso inicial, peso alvo e prazo."
      />
      <SetupForm />
    </div>
  );
}
