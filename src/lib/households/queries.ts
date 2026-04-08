import { createClient } from '@/lib/supabase/server';
import type { Household, HouseholdMember } from '@/types/database';

export async function fetchUserHouseholds(userId: string): Promise<
  (Household & { members: HouseholdMember[] })[]
> {
  const supabase = await createClient();

  // Busca os households onde o user é owner ou membro ativo
  const { data: memberRows } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', userId)
    .eq('status', 'active');

  const memberHouseholdIds = (memberRows ?? []).map((r) => r.household_id);

  const { data: owned } = await supabase
    .from('households')
    .select('*')
    .eq('owner_id', userId);

  const { data: membered } =
    memberHouseholdIds.length > 0
      ? await supabase
          .from('households')
          .select('*')
          .in('id', memberHouseholdIds)
          .neq('owner_id', userId) // evita duplicatas
      : { data: [] };

  const allHouseholds = [...(owned ?? []), ...(membered ?? [])] as Household[];

  if (allHouseholds.length === 0) return [];

  const householdIds = allHouseholds.map((h) => h.id);
  const { data: members } = await supabase
    .from('household_members')
    .select('*')
    .in('household_id', householdIds);

  return allHouseholds.map((h) => ({
    ...h,
    members: ((members ?? []) as HouseholdMember[]).filter(
      (m) => m.household_id === h.id,
    ),
  }));
}

export async function fetchHouseholdById(
  householdId: string,
): Promise<(Household & { members: HouseholdMember[] }) | null> {
  const supabase = await createClient();

  const { data: household, error } = await supabase
    .from('households')
    .select('*')
    .eq('id', householdId)
    .single();

  if (error || !household) return null;

  const { data: members } = await supabase
    .from('household_members')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  return {
    ...(household as Household),
    members: (members ?? []) as HouseholdMember[],
  };
}

export async function fetchPendingInvites(
  userEmail: string,
): Promise<(HouseholdMember & { household: Household })[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('household_members')
    .select('*, household:households(*)')
    .eq('invited_email', userEmail)
    .eq('status', 'pending');

  return (data ?? []) as (HouseholdMember & { household: Household })[];
}
