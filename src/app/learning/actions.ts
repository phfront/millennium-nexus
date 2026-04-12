'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ParsedPlan } from '@/lib/learningMarkdownParser';

export async function getUserAIConfig() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('ai_provider, ai_model')
    .eq('id', user.id)
    .maybeSingle();

  return data as { ai_provider: string | null; ai_model: string | null } | null;
}

export async function fetchLearningPlans() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('learning_plans')
    .select(`
      *,
      days:learning_plan_days(
        id,
        day_number,
        title,
        is_completed,
        items:learning_day_items(id, is_completed)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching learning plans:', error);
    return [];
  }

  // Calculate progress for each plan
  return data.map((plan: any) => {
    let totalItems = 0;
    let completedItems = 0;
    
    plan.days?.forEach((day: any) => {
      day.items?.forEach((item: any) => {
        totalItems++;
        if (item.is_completed) completedItems++;
      });
    });
    
    // Find next pending day
    const sortedDays = [...(plan.days || [])].sort((a: any, b: any) => a.day_number - b.day_number);
    const nextPendingDay = sortedDays.find((d: any) => !d.is_completed);
    let nextDay = null;
    if (nextPendingDay) {
      const dayItems = nextPendingDay.items || [];
      nextDay = {
        id: nextPendingDay.id,
        day_number: nextPendingDay.day_number,
        title: nextPendingDay.title,
        total_items: dayItems.length,
        completed_items: dayItems.filter((i: any) => i.is_completed).length,
      };
    }

    return {
      ...plan,
      total_items: totalItems,
      completed_items: completedItems,
      progress: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
      next_day: nextDay,
    };
  });
}

export async function fetchLearningPlan(planId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('learning_plans')
    .select(`
      *,
      sections:learning_plan_sections(*),
      days:learning_plan_days(
        *,
        items:learning_day_items(*)
      )
    `)
    .eq('id', planId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching learning plan:', error);
    return null;
  }

  return data;
}

export async function createLearningPlan(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const scheduling_type = formData.get('scheduling_type') as 'relative' | 'calendar';

  const { data, error } = await supabase
    .from('learning_plans')
    .insert({
      user_id: user.id,
      title,
      description,
      scheduling_type,
      status: 'planning',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating learning plan:', error);
    throw new Error('Failed to create learning plan');
  }

  revalidatePath('/learning');
  return data;
}

export async function addLearningSection(planId: string, title: string, orderIndex: number) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('learning_plan_sections')
    .insert({
      plan_id: planId,
      title,
      order_index: orderIndex,
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath(`/learning/${planId}`);
  return data;
}

export async function addLearningDay(planId: string, sectionId: string | null, dayNumber: number, title: string, contentPrompt: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('learning_plan_days')
    .insert({
      plan_id: planId,
      section_id: sectionId,
      day_number: dayNumber,
      title,
      content_prompt: contentPrompt
    })
    .select()
    .single();

  if (error) throw error;
  revalidatePath(`/learning/${planId}`);
  return data;
}

export async function addLearningDayItem(dayId: string, title: string, itemType: string, url: string = '') {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('learning_day_items')
    .insert({
      day_id: dayId,
      title,
      item_type: itemType,
      url: url || null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function toggleDayItem(itemId: string, isCompleted: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('learning_day_items')
    .update({ is_completed: isCompleted })
    .eq('id', itemId);

  if (error) throw error;
  // Let the client handle the UI update optimistic, or revalidate path depends on structure.
}

export async function updateDayNotes(dayId: string, notes: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('learning_plan_days')
    .update({ user_notes: notes })
    .eq('id', dayId);

  if (error) throw error;
}

export async function completeDay(dayId: string, isCompleted: boolean) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('learning_plan_days')
    .update({ 
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null
    })
    .eq('id', dayId);

  if (error) throw error;
}

export async function saveFullLearningPlan(
  planId: string, 
  parsedPlan: ParsedPlan, 
  activeDays: number[] | null = null,
  basicInfo?: { title: string; description?: string; goals?: string; scheduling_type?: 'relative' | 'calendar'; start_date?: string | null }
) {
  const supabase = await createClient();

  const updateData: any = { active_days: activeDays };
  if (basicInfo) {
    updateData.title = basicInfo.title;
    updateData.description = basicInfo.description;
    updateData.goals = basicInfo.goals;
    if (basicInfo.scheduling_type !== undefined) {
      updateData.scheduling_type = basicInfo.scheduling_type;
    }
    if (basicInfo.start_date !== undefined) {
      updateData.start_date = basicInfo.start_date;
    }
  }

  // Update plan's meta data
  const { error: metaError } = await supabase.from('learning_plans').update(updateData).eq('id', planId);
  if (metaError) {
    console.error('[saveFullLearningPlan] meta update error:', metaError);
    throw new Error(`Erro ao atualizar metadados: ${metaError.message}`);
  }

  // 1. Fetch old data to preserve state (is_completed, user_notes, scheduled_date)
  const { data: oldDays } = await supabase
    .from('learning_plan_days')
    .select('*, items:learning_day_items(*)')
    .eq('plan_id', planId);

  // Map by day_number AND title for best matching
  const oldDaysMap = new Map<string, any>();
  if (oldDays) {
     for (const day of oldDays) {
       const key = `${day.day_number}::${day.title || ''}`;
       oldDaysMap.set(key, day);
     }
     // Fallback: also map by day_number alone (lower priority)
     for (const day of oldDays) {
       const numKey = `num::${day.day_number}`;
       if (!oldDaysMap.has(numKey)) {
         oldDaysMap.set(numKey, day);
       }
     }
  }

  function findOldDay(dayNumber: number, title: string) {
    return oldDaysMap.get(`${dayNumber}::${title}`) 
        || oldDaysMap.get(`num::${dayNumber}`)
        || null;
  }

  // 2. Delete old sections and days (items cascade via ON DELETE CASCADE)
  const { error: delDaysErr } = await supabase.from('learning_plan_days').delete().eq('plan_id', planId);
  if (delDaysErr) {
    console.error('[saveFullLearningPlan] delete days error:', delDaysErr);
    throw new Error(`Erro ao limpar dias: ${delDaysErr.message}`);
  }
  const { error: delSecErr } = await supabase.from('learning_plan_sections').delete().eq('plan_id', planId);
  if (delSecErr) {
    console.error('[saveFullLearningPlan] delete sections error:', delSecErr);
    throw new Error(`Erro ao limpar seções: ${delSecErr.message}`);
  }

  // Helper to insert a day and its items
  async function insertDay(day: any, sectionId: string | null) {
    const oldDay = findOldDay(day.day_number, day.title);
    const { data: insertedDay, error: dayErr } = await supabase
      .from('learning_plan_days')
      .insert({
         plan_id: planId,
         section_id: sectionId,
         day_number: day.day_number,
         scheduled_date: day.scheduled_date ?? oldDay?.scheduled_date ?? null,
         title: day.title,
         content_prompt: day.content_prompt,
         is_completed: oldDay?.is_completed || false,
         user_notes: oldDay?.user_notes || null,
      }).select().single();

    if (dayErr || !insertedDay) {
      console.error('[saveFullLearningPlan] insert day error:', dayErr, day);
      return;
    }

    if (day.items && day.items.length > 0) {
       const itemsToInsert = day.items.map((item: any, idx: number) => {
          const oldItem = oldDay?.items?.find((i: any) => i.title === item.title);
          return {
             day_id: insertedDay.id,
             title: item.title,
             description: item.description,
             url: oldItem?.url || null,
             item_type: oldItem?.item_type || 'task',
             order_index: idx,
             is_completed: oldItem ? oldItem.is_completed : (item.is_completed || false)
          };
       });
       const { error: itemsErr } = await supabase.from('learning_day_items').insert(itemsToInsert);
       if (itemsErr) {
         console.error('[saveFullLearningPlan] insert items error:', itemsErr, itemsToInsert);
       }
    }
  }

  // 3. Insert sections + their days
  let sectionIndex = 0;
  for (const sec of parsedPlan.sections) {
     const { data: insertedSec, error: secErr } = await supabase
        .from('learning_plan_sections')
        .insert({ plan_id: planId, title: sec.title, order_index: sectionIndex++ })
        .select().single();
        
     if (secErr || !insertedSec) {
       console.error('[saveFullLearningPlan] insert section error:', secErr, sec.title);
       continue;
     }

     if (sec.days) {
       for (const day of sec.days) {
          await insertDay(day, insertedSec.id);
       }
     }
  }

  // 4. Insert unsectioned days
  if (parsedPlan.unsectionedDays) {
    for (const day of parsedPlan.unsectionedDays) {
        await insertDay(day, null);
    }
  }

  revalidatePath(`/learning/${planId}`);
  revalidatePath('/learning');
  return { success: true };
}
export async function deleteLearningPlan(planId: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('learning_plans')
    .delete()
    .eq('id', planId);

  if (error) {
    console.error('Error deleting learning plan:', error);
    throw new Error('Failed to delete learning plan');
  }

  revalidatePath('/learning');
  revalidatePath('/learning/plans');
}

export async function startLearningPlan(planId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // get user profile for timezone
  const { data: profile } = await supabase.from('profiles').select('timezone').eq('id', user.id).maybeSingle();
  const userTimezone = profile?.timezone || 'America/Sao_Paulo';
  
  // get plan and days
  const { data: plan } = await supabase.from('learning_plans').select('*, days:learning_plan_days(*)').eq('id', planId).maybeSingle();
  if (!plan) throw new Error('Plan not found');
  if (plan.status !== 'planning') {
    throw new Error('Plan is already started');
  }

  const days = plan.days || [];
  days.sort((a: any, b: any) => a.day_number - b.day_number);

  const activeDays = plan.active_days || [0, 1, 2, 3, 4, 5, 6];

  let currentDate = new Date(new Date().toLocaleString("en-US", { timeZone: userTimezone }));
  currentDate.setHours(0, 0, 0, 0);

  // Function to get "current day of week" taking timezone into account
  const advanceToNextActiveDay = (date: Date) => {
     let preventInfinite = 0;
     while (!activeDays.includes(date.getDay()) && preventInfinite < 14) {
        date.setDate(date.getDate() + 1);
        preventInfinite++;
     }
  };

  for (const day of days) {
     advanceToNextActiveDay(currentDate);
     
     const year = currentDate.getFullYear();
     const month = String(currentDate.getMonth() + 1).padStart(2, '0');
     const dayOfMonth = String(currentDate.getDate()).padStart(2, '0');
     const dateString = `${year}-${month}-${dayOfMonth}`;
     
     await supabase.from('learning_plan_days').update({ scheduled_date: dateString }).eq('id', day.id);
     
     // move to next day for the next iteration
     currentDate.setDate(currentDate.getDate() + 1);
  }

  await supabase.from('learning_plans').update({ status: 'in_progress' }).eq('id', planId);

  revalidatePath(`/learning/${planId}`);
  revalidatePath('/learning');
}
