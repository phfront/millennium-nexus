import { Suspense } from 'react';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, ModuleGridSkeleton, PageHeader } from '@phfront/millennium-ui';
import { ModuleGrid } from '@/components/modules/ModuleGrid';
import { fetchDeniedModuleIdsForUser, filterModulesVisibleOnHome } from '@/lib/modules/access';
import type { Module, Profile } from '@/types/database';

async function DashboardContent() {
  const user = await getUser();
  const supabase = await createClient();

  const [{ data: profileData }, { data: modulesData }, deniedModuleIds] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user!.id).single(),
    supabase.from('modules').select('*').order('sort_order', { ascending: true }),
    fetchDeniedModuleIdsForUser(supabase, user!.id),
  ]);

  const firstName = (profileData as Pick<Profile, 'full_name'> | null)?.full_name?.split(' ')[0];
  const allModules = (modulesData ?? []) as Module[];
  const modules = filterModulesVisibleOnHome(allModules, deniedModuleIds);

  return (
    <div className="space-y-6">
      <section>
        {modules.length === 0 && allModules.length > 0 ? (
          <EmptyState
            className="py-12"
            title="Sem módulos disponíveis"
            description="Não tens módulos disponíveis neste momento. Se precisares de acesso, contacta um administrador."
          />
        ) : (
          <ModuleGrid modules={modules} />
        )}
      </section>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<ModuleGridSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
