import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CaloriasTrackerClient } from '@/components/health/features/calorias/calorias-tracker-client';

export default async function HealthCaloriasPage() {
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
    <div className="mx-auto flex w-full max-w-3xl flex-col px-1 sm:px-0">
      <PageHeader
        title="Calorias"
        subtitle="Acompanhe a sua queima diária e meta semanal."
        actions={
          <Link
            href="/health/calorias/history"
            className="text-sm font-medium text-brand-primary hover:underline"
          >
            Histórico
          </Link>
        }
      />
      <div className="mt-6">
        <CaloriasTrackerClient />
      </div>
    </div>
  );
}
