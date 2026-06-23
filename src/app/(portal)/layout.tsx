import { redirect } from 'next/navigation';
import { getUser, getUserProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { UserProvider } from '@/components/providers/UserProvider';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { AppHeader } from '@/components/shell/AppHeader';
import { MobileSidebarProvider } from '@/components/shell/MobileSidebarContext';
import { getNavModulesForUser } from '@/lib/navigation/get-nav-modules';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = await createClient();

  await supabase
    .from('profiles')
    .upsert({ id: user.id } as never, { onConflict: 'id', ignoreDuplicates: true });

  const [profile, modules] = await Promise.all([
    getUserProfile(user.id),
    getNavModulesForUser(user.id),
  ]);

  return (
    <UserProvider user={user} profile={profile}>
      <MobileSidebarProvider>
        <div className="flex h-screen overflow-hidden bg-surface-1">
          <AppSidebar modules={modules} />

          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <AppHeader />

            <main className="pwa-main-safe-top pwa-scroll-main min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-4 md:pb-6">
              {children}
            </main>
          </div>
        </div>
      </MobileSidebarProvider>
    </UserProvider>
  );
}
