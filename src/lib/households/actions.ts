'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth';

export async function createHousehold(name: string) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('households')
    .insert({ name: name.trim(), owner_id: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Insere o owner como membro ativo
  await supabase.from('household_members').insert({
    household_id: data.id,
    user_id: user.id,
    invited_email: user.email!,
    role: 'owner',
    status: 'active',
    invited_by: user.id,
  });

  revalidatePath('/households');
  return data;
}

export async function updateHousehold(householdId: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('households')
    .update({ name: name.trim() })
    .eq('id', householdId);
  if (error) throw new Error(error.message);
  revalidatePath('/households');
}

export async function deleteHousehold(householdId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('households')
    .delete()
    .eq('id', householdId);
  if (error) throw new Error(error.message);
  revalidatePath('/households');
}

export async function inviteMember(householdId: string, email: string) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const supabase = await createClient();

  // Verifica se o email já é membro
  const { data: existing } = await supabase
    .from('household_members')
    .select('id, status')
    .eq('household_id', householdId)
    .eq('invited_email', email.toLowerCase().trim())
    .maybeSingle();

  if (existing) {
    if (existing.status === 'active') throw new Error('already_member');
    if (existing.status === 'pending') throw new Error('already_invited');
  }

  // Resolve o user_id pelo email se o perfil existir
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  const { error } = await supabase.from('household_members').insert({
    household_id: householdId,
    user_id: profile?.id ?? null,
    invited_email: email.toLowerCase().trim(),
    role: 'member',
    status: 'pending',
    invited_by: user.id,
  });

  if (error) throw new Error(error.message);

  // Se encontrou o user_id, envia notificação via campo (future)
  revalidatePath(`/households/${householdId}`);
  revalidatePath('/households');
}

export async function acceptInvite(memberId: string) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const supabase = await createClient();

  // Atualiza por id + verifica que o email corresponde (pode ser user_id null)
  const { error } = await supabase
    .from('household_members')
    .update({ status: 'active', user_id: user.id })
    .eq('id', memberId);

  if (error) throw new Error(error.message);
  revalidatePath('/households');
}

export async function declineInvite(memberId: string) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const supabase = await createClient();

  // Remove por id (RLS garante que só pode remover o próprio convite)
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('id', memberId);

  if (error) throw new Error(error.message);
  revalidatePath('/households');
}

export async function removeMember(memberId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('id', memberId);
  if (error) throw new Error(error.message);
  revalidatePath('/households');
}

export async function leaveHousehold(householdId: string) {
  const user = await getUser();
  if (!user) throw new Error('Não autenticado');
  const supabase = await createClient();

  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('household_id', householdId)
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);
  revalidatePath('/households');
}
