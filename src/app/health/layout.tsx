import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUser, getUserProfile } from '@/lib/auth';
import { UserProvider } from '@/components/providers/UserProvider';
import { ModuleSidebar } from '@/components/health/shell/ModuleSidebar';
import { ModuleHeader } from '@/components/health/shell/ModuleHeader';
import { MobileSidebarProvider } from '@/components/shell/MobileSidebarContext';

export const metadata: Metadata = {
  title: 'Saúde — Millennium Nexus',
  description: 'Acompanhe sua jornada de saúde e composição corporal',
};

export default async function HealthLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getUserProfile(user.id);

  return (
    <UserProvider user={user} profile={profile}>
      <MobileSidebarProvider>
        <div className="flex h-screen overflow-hidden bg-surface-1">
          <ModuleSidebar />
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <ModuleHeader />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-6">
              {children}
            </main>
          </div>
        </div>
      </MobileSidebarProvider>
    </UserProvider>
  );
}
