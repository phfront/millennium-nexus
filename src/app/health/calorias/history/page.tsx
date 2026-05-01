import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CaloriasHistoryClient } from '@/components/health/features/calorias/calorias-history-client';

export default async function HealthCaloriasHistoryPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  const { data: healthSettings } = await supabase
    .from('health_settings')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!healthSettings) {
    redirect('/setup');
  }

  const { data: calSettings } = await supabase
    .from('calorias_settings')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!calSettings) {
    redirect('/health/calorias/settings');
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-1 sm:px-0">
      <PageHeader
        title="Histórico"
        subtitle="Registos de kcal por dia, com a mesma meta diária e saldo semanal que no ecrã principal."
      />
      <CaloriasHistoryClient />
      <p className="text-center text-sm text-text-muted">
        <Link href="/health/calorias" className="text-brand-primary hover:underline">
          Voltar a Calorias
        </Link>
      </p>
    </div>
  );
}
