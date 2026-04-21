'use client';

import { GoalForm } from '@/components/daily-goals/features/goal-form/goal-form';
import { useTrackers } from '@/hooks/daily-goals/use-trackers';

export function GoalFormWrapper() {
  const { createTracker } = useTrackers();

  return (
    <GoalForm
      onSubmit={async (data) => {
        await createTracker(data);
      }}
    />
  );
}
