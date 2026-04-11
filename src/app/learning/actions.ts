'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { LearningPlan, LearningPlanDetails } from '@/types/learning';
import type { ParsedPlan } from '@/lib/learningMarkdownParser';

export async function fetchLearningPlans() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('learning_plans')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching learning plans:', error);
    return [];
  }

  return data;
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
    .single();

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

export async function saveFullLearningPlan(planId: string, parsedPlan: ParsedPlan) {
  const supabase = await createClient();

  // 1. Fetch old data to preserve state
  const { data: oldDays } = await supabase
    .from('learning_plan_days')
    .select('*, items:learning_day_items(*)')
    .eq('plan_id', planId);

  const oldDaysMap = new Map();
  if (oldDays) {
     for (const day of oldDays) {
       oldDaysMap.set(day.day_number, day);
     }
  }

  // 2. Delete old sections and days
  await supabase.from('learning_plan_days').delete().eq('plan_id', planId);
  await supabase.from('learning_plan_sections').delete().eq('plan_id', planId);

  // 3. Insert sections
  let sectionIndex = 0;
  for (const sec of parsedPlan.sections) {
     const { data: insertedSec } = await supabase
        .from('learning_plan_sections')
        .insert({ plan_id: planId, title: sec.title, order_index: sectionIndex++ })
        .select().single();
        
     const secId = insertedSec?.id;

     if (secId && sec.days) {
       for (const day of sec.days) {
          const oldDay = oldDaysMap.get(day.day_number);
          const { data: insertedDay } = await supabase
            .from('learning_plan_days')
            .insert({
               plan_id: planId,
               section_id: secId,
               day_number: day.day_number,
               title: day.title,
               content_prompt: day.content_prompt,
               is_completed: oldDay?.is_completed || false,
               user_notes: oldDay?.user_notes || null,
            }).select().single();

          if (day.items && day.items.length > 0 && insertedDay) {
             const itemsToInsert = day.items.map((item, idx) => {
                const oldItem = oldDay?.items?.find((i: any) => i.title === item.title);
                return {
                   day_id: insertedDay.id,
                   title: item.title,
                   description: item.description,
                   item_type: 'task',
                   order_index: idx,
                   is_completed: oldItem ? oldItem.is_completed : (item.is_completed || false)
                };
             });
             await supabase.from('learning_day_items').insert(itemsToInsert);
          }
       }
     }
  }

  // 4. Insert unsectioned days
  if (parsedPlan.unsectionedDays) {
    for (const day of parsedPlan.unsectionedDays) {
        const oldDay = oldDaysMap.get(day.day_number);
        const { data: insertedDay } = await supabase
          .from('learning_plan_days')
          .insert({
              plan_id: planId,
              section_id: null,
              day_number: day.day_number,
              title: day.title,
              content_prompt: day.content_prompt,
              is_completed: oldDay?.is_completed || false,
              user_notes: oldDay?.user_notes || null,
          }).select().single();

        if (day.items && day.items.length > 0 && insertedDay) {
            const itemsToInsert = day.items.map((item, idx) => {
              const oldItem = oldDay?.items?.find((i: any) => i.title === item.title);
              return {
                  day_id: insertedDay.id,
                  title: item.title,
                  description: item.description,
                  item_type: 'task',
                  order_index: idx,
                  is_completed: oldItem ? oldItem.is_completed : (item.is_completed || false)
              };
            });
            await supabase.from('learning_day_items').insert(itemsToInsert);
        }
    }
  }

  revalidatePath(`/learning/${planId}`);
  revalidatePath('/learning');
  return { success: true };
}
