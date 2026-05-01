import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CaloriasSettingsForm } from '@/components/health/features/calorias/calorias-settings-form';

export default async function HealthCaloriasSettingsPage() {
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-1 sm:px-0">
      <PageHeader title="Calorias — Configurações" subtitle="Meta diária nos dias ativos e dias que contam para a semana." />
      <CaloriasSettingsForm />
      <p className="text-center text-xs text-text-muted">
        <Link href="/health/calorias" className="text-brand-primary hover:underline">
          Voltar ao resumo
        </Link>
      </p>
    </div>
  );
}
