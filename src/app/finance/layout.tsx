import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUser, getUserProfile } from '@/lib/auth';
import { UserProvider } from '@/components/providers/UserProvider';
import { FinanceSpreadsheetSettingsProvider } from '@/contexts/FinanceSpreadsheetSettingsContext';
import { ModuleSidebar } from '@/components/finance/shell/ModuleSidebar';
import { ModuleHeader } from '@/components/finance/shell/ModuleHeader';
import { MobileSidebarProvider } from '@/components/shell/MobileSidebarContext';

export const metadata: Metadata = {
  title: 'Finanças — Millennium Nexus',
  description: 'Controle suas receitas, despesas, assinaturas e cobranças',
};

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getUserProfile(user.id);

  return (
    <UserProvider user={user} profile={profile}>
      <FinanceSpreadsheetSettingsProvider>
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
      </FinanceSpreadsheetSettingsProvider>
    </UserProvider>
  );
}
