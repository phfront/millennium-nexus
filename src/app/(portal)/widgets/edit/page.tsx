import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { WidgetEditor } from '@/components/widgets/WidgetEditor';
import { fetchDeniedModuleIdsForUser, filterModulesForNav } from '@/lib/modules/access';
import type { Module } from '@/types/database';

export default async function WidgetsEditPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const [{ data: modulesData }, deniedModuleIds] = await Promise.all([
    supabase.from('modules').select('*').order('sort_order', { ascending: true }),
    fetchDeniedModuleIdsForUser(supabase, user.id),
  ]);

  const allModules = (modulesData ?? []) as Module[];
  const allowedModules = filterModulesForNav(allModules, deniedModuleIds);
  const allowedModuleSlugs = allowedModules.map((module) => module.slug);

  return (
    <div className="w-full">
      <WidgetEditor allowedModuleSlugs={allowedModuleSlugs} />
    </div>
  );
}
