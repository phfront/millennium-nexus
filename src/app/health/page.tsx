import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function HealthModuleEntryPage() {
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

  redirect('/health/nutrition');
}
