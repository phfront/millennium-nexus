import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@phfront/millennium-ui';
import { fetchDeniedModuleIdsForUser, fetchActiveModuleIdsForUser, activateModuleForUser, deactivateModuleForUser } from '@/lib/modules/access';
import { ArrowLeft } from 'lucide-react';
import { ModulesTable } from '@/components/modules/ModulesTable';
import type { Module } from '@/types/database';

interface ModuleWithStatus extends Module {
  isActive: boolean;
}

async function toggleModule(formData: FormData) {
  'use server';

  const user = await getUser();
  if (!user) return;

  const moduleId = formData.get('moduleId') as string;
  const action = formData.get('action') as string;

  const supabase = await createClient();

  if (action === 'activate') {
    await activateModuleForUser(supabase, user.id, moduleId);
  } else {
    await deactivateModuleForUser(supabase, user.id, moduleId);
  }

  revalidatePath('/modules');
  revalidatePath('/');
}

export default async function ModulesPage() {
  const user = await getUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  const [{ data: modulesData }, deniedModuleIds, activeModuleIds] = await Promise.all([
    supabase.from('modules').select('*').order('sort_order', { ascending: true }),
    fetchDeniedModuleIdsForUser(supabase, user.id),
    fetchActiveModuleIdsForUser(supabase, user.id),
  ]);

  const allModules = (modulesData ?? []) as Module[];

  // Filtra módulos disponíveis (ativos globalmente e não negados)
  const availableModules = allModules.filter(
    (m) => m.is_active && !deniedModuleIds.has(m.id)
  );

  const modulesWithStatus: ModuleWithStatus[] = availableModules.map((m) => ({
    ...m,
    isActive: activeModuleIds.has(m.id),
  }));

  const activeCount = modulesWithStatus.filter((m) => m.isActive).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Gerenciar Módulos
          </h1>
          <p className="text-text-secondary">
            {activeCount} {activeCount === 1 ? 'módulo ativo' : 'módulos ativos'} de {modulesWithStatus.length} disponíveis
          </p>
        </div>
      </div>

      <ModulesTable modules={modulesWithStatus} toggleAction={toggleModule} />

      <div className="flex justify-start">
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Início
          </Button>
        </Link>
      </div>
    </div>
  );
}
