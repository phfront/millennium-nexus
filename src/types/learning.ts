export type LearningPlanStatus = 'planning' | 'in_progress' | 'completed' | 'paused';
export type LearningSchedulingType = 'relative' | 'calendar';
export type LearningItemType = 'task' | 'video' | 'article';

export interface LearningPlan {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  goals: string | null;
  status: LearningPlanStatus;
  scheduling_type: LearningSchedulingType;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface LearningPlanSection {
  id: string;
  plan_id: string;
  title: string;
  order_index: number;
  created_at: string;
}

export interface LearningPlanDay {
  id: string;
  plan_id: string;
  section_id: string | null;
  day_number: number;
  scheduled_date: string | null;
  title: string | null;
  content_prompt: string | null;
  user_notes: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface LearningDayItem {
  id: string;
  day_id: string;
  title: string;
  description: string | null;
  url: string | null;
  item_type: LearningItemType | null;
  is_completed: boolean;
  order_index: number;
  created_at: string;
}

// Extensão com os relacionamentos (útil para consultas que trazem tudo junto)
export interface LearningPlanWithDetails extends LearningPlan {
  sections?: LearningPlanSection[];
  days?: LearningPlanDayWithItems[];
}

export interface LearningPlanDayWithItems extends LearningPlanDay {
  items: LearningDayItem[];
}
