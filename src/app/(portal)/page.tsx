import { Suspense } from 'react';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, ModuleGridSkeleton, Button } from '@phfront/millennium-ui';
import { WidgetDashboardClient } from '@/components/widgets/WidgetDashboardClient';
import { fetchDeniedModuleIdsForUser, filterModulesForNav } from '@/lib/modules/access';
import type { Module } from '@/types/database';
import { Plus } from 'lucide-react';

async function DashboardContent() {
  const user = await getUser();
  const supabase = await createClient();

  const [{ data: modulesData }, deniedModuleIds] = await Promise.all([
    supabase.from('modules').select('*').order('sort_order', { ascending: true }),
    fetchDeniedModuleIdsForUser(supabase, user!.id),
  ]);

  const allModules = (modulesData ?? []) as Module[];
  const activeModules = filterModulesForNav(allModules, deniedModuleIds);
  const allowedModuleSlugs = activeModules.map((module) => module.slug);

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
            <WidgetDashboardClient allowedModuleSlugs={allowedModuleSlugs} />
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
