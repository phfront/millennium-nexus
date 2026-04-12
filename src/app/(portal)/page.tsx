import { Suspense } from 'react';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, ModuleGridSkeleton, Button } from '@phfront/millennium-ui';
import { ModuleGrid } from '@/components/modules/ModuleGrid';
import { fetchDeniedModuleIdsForUser, fetchActiveModuleIdsForUser, filterModulesForNav } from '@/lib/modules/access';
import type { Module, Profile } from '@/types/database';
import { Plus } from 'lucide-react';

async function DashboardContent() {
  const user = await getUser();
  const supabase = await createClient();

  const [{ data: profileData }, { data: modulesData }, deniedModuleIds, activeModuleIds] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user!.id).maybeSingle(),
    supabase.from('modules').select('*').order('sort_order', { ascending: true }),
    fetchDeniedModuleIdsForUser(supabase, user!.id),
    fetchActiveModuleIdsForUser(supabase, user!.id),
  ]);

  const firstName = (profileData as Pick<Profile, 'full_name'> | null)?.full_name?.split(' ')[0];
  const allModules = (modulesData ?? []) as Module[];
  const activeModules = filterModulesForNav(allModules, deniedModuleIds);

  return (
    <div className="space-y-6">
      <section>
        {activeModules.length === 0 ? (
          <EmptyState
            className="py-12"
            title="Nenhum módulo ativo"
            description="Você ainda não iniciou nenhum módulo. Ative os módulos que deseja usar."
            action={
              <Link href="/modules">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Ativar Módulos
                </Button>
              </Link>
            }
          />
        ) : (
          <>
            <ModuleGrid modules={activeModules} />
            <div className="mt-6 flex justify-center">
              <Link href="/modules">
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Gerenciar Módulos
                </Button>
              </Link>
            </div>
          </>
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
