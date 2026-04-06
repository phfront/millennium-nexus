import { redirect } from 'next/navigation';
import { getUser, getUserProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@phfront/millennium-ui';
import { AdminModuleMatrix } from './AdminModuleMatrix';
import type { Module, Profile } from '@/types/database';

export const metadata = {
  title: 'Administração — Millennium Nexus',
};

export default async function AdminPage() {
  const user = await getUser();
  if (!user) {
    redirect('/login');
  }

  const profile = await getUserProfile(user.id);
  if (!profile?.is_admin) {
    redirect('/');
  }

  const supabase = await createClient();

  const [{ data: usersData }, { data: modulesData }, { data: denialsData }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, is_admin, avatar_url')
      .order('full_name', { ascending: true, nullsFirst: false }),
    supabase.from('modules').select('*').order('sort_order', { ascending: true }),
    supabase.from('user_module_denials').select('user_id, module_id'),
  ]);

  const users = (usersData ?? []) as Pick<
    Profile,
    'id' | 'full_name' | 'email' | 'is_admin' | 'avatar_url'
  >[];
  const modules = (modulesData ?? []) as Module[];
  const deniedPairs = (denialsData ?? []) as { user_id: string; module_id: string }[];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1200px] space-y-6 animate-fade-in">
      <PageHeader
        className="mb-0"
        title="Administração"
        subtitle="Controla o acesso de cada utilizador aos módulos do portal."
      />

      <section>
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">
          Acesso por módulo
        </h2>
        <AdminModuleMatrix users={users} modules={modules} deniedPairs={deniedPairs} />
      </section>
    </div>
  );
}
