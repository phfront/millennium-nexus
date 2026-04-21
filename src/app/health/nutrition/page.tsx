import { redirect } from 'next/navigation';
import { PageHeader } from '@phfront/millennium-ui';
import { getUser } from '@/lib/auth';
import { DailyChecklistClient } from '@/components/health/features/daily-checklist/daily-checklist-client';
import { WaterTrackerClient } from '@/components/health/features/water-tracker/water-tracker-client';
import { createClient } from '@/lib/supabase/server';

export default async function NutritionDashboardPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('diet_settings')
    .select('daily_water_target_ml')
    .eq('user_id', user.id)
    .maybeSingle();

  const waterTarget = (settings as { daily_water_target_ml: number } | null)?.daily_water_target_ml ?? 2500;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-1 sm:px-0">
      <PageHeader title="Nutrição" subtitle="Acompanhe sua dieta e hidratação do dia." />
      <div className="flex flex-col gap-6">
        <WaterTrackerClient
          targetMl={waterTarget}
          cardMinHeightClass="min-h-[200px]"
        />
        <DailyChecklistClient />
      </div>
    </div>
  );
}
