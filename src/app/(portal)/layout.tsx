import { redirect } from 'next/navigation';
import { getUser, getUserProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { UserProvider } from '@/components/providers/UserProvider';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { AppHeader } from '@/components/shell/AppHeader';
import { MobileSidebarProvider } from '@/components/shell/MobileSidebarContext';
import { fetchDeniedModuleIdsForUser, fetchActiveModuleIdsForUser, filterModulesForNav } from '@/lib/modules/access';
import { PendingInvitesBanner } from '@/components/households/PendingInvitesBanner';
import type { Module } from '@/types/database';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = await createClient();

  await supabase
    .from('profiles')
    .upsert({ id: user.id } as never, { onConflict: 'id', ignoreDuplicates: true });

  const [profile, { data: modulesData }, deniedModuleIds, activeModuleIds] = await Promise.all([
    getUserProfile(user.id),
    supabase.from('modules').select('*').order('sort_order', { ascending: true }),
    fetchDeniedModuleIdsForUser(supabase, user.id),
    fetchActiveModuleIdsForUser(supabase, user.id),
  ]);

  const allModules = (modulesData ?? []) as Module[];
  const modules = filterModulesForNav(allModules, deniedModuleIds);

  return (
    <UserProvider user={user} profile={profile}>
      <MobileSidebarProvider>
        <div className="flex h-screen overflow-hidden bg-surface-1">
          <AppSidebar modules={modules} />

          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <AppHeader />
            <PendingInvitesBanner />

            <main className="pwa-main-safe-top pwa-scroll-main min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-4 md:pb-6">
              {children}
            </main>
          </div>
        </div>
      </MobileSidebarProvider>
    </UserProvider>
  );
}
