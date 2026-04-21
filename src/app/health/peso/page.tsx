import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ProgressDashboardClient } from '@/components/health/features/progress-dashboard/progress-dashboard-client';

export default async function HealthWeightHomePage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('health_settings')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!settings) {
    redirect('/setup');
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <PageHeader title="Saúde" subtitle="Acompanhe sua evolução de peso." />
      <ProgressDashboardClient />
      <Link
        href="/health/log/new"
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-brand-primary shadow-lg flex items-center justify-center text-white hover:opacity-90 active:scale-95 transition-all z-40 cursor-pointer"
        aria-label="Registrar peso"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
}
