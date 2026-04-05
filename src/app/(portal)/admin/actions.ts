'use server';

import { revalidatePath } from 'next/cache';
import { getUser, getUserProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

async function requireAdmin() {
  const user = await getUser();
  if (!user) {
    return { ok: false as const, error: 'Não autenticado.' };
  }
  const profile = await getUserProfile(user.id);
  if (!profile?.is_admin) {
    return { ok: false as const, error: 'Sem permissão de administrador.' };
  }
  return { ok: true as const, user };
}

export type SetUserModuleDenialResult = { ok: true } | { ok: false; error: string };

export async function setUserModuleDenial(
  targetUserId: string,
  moduleId: string,
  denied: boolean,
): Promise<SetUserModuleDenialResult> {
  const gate = await requireAdmin();
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }

  const supabase = await createClient();

  if (denied) {
    const { error } = await supabase.from('user_module_denials').upsert(
      { user_id: targetUserId, module_id: moduleId },
      { onConflict: 'user_id,module_id' },
    );
    if (error) {
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabase
      .from('user_module_denials')
      .delete()
      .eq('user_id', targetUserId)
      .eq('module_id', moduleId);
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath('/admin');
  revalidatePath('/', 'layout');
  return { ok: true };
}
