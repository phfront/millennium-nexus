import { redirect } from 'next/navigation';
import { getUser, getUserProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { UserProvider } from '@/components/providers/UserProvider';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { AppBottomNav } from '@/components/shell/AppBottomNav';
import { AppHeader } from '@/components/shell/AppHeader';
import { fetchDeniedModuleIdsForUser, filterModulesForNav } from '@/lib/modules/access';
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

  const [profile, { data: modulesData }, deniedModuleIds] = await Promise.all([
    getUserProfile(user.id),
    supabase.from('modules').select('*').order('sort_order', { ascending: true }),
    fetchDeniedModuleIdsForUser(supabase, user.id),
  ]);

  const allModules = (modulesData ?? []) as Module[];
  const modules = filterModulesForNav(allModules, deniedModuleIds);

  return (
    <UserProvider user={user} profile={profile}>
      <div className="flex h-screen overflow-hidden bg-surface-1">
        <AppSidebar modules={modules} />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <AppHeader />

          <main className="pwa-main-safe-top pwa-scroll-main flex-1 overflow-y-auto p-4 md:p-6 pb-safe-bottom-nav md:pb-6">
            {children}
          </main>

          <AppBottomNav />
        </div>
      </div>
    </UserProvider>
  );
}
