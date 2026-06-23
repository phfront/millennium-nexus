'use client';

import { GoalForm } from '@/components/habits-goals/features/goal-form/goal-form';
import { useTrackers } from '@/hooks/habits-goals/use-trackers';

export function GoalFormWrapper() {
  const { trackers, createTracker } = useTrackers();
  const unavailableSpecificSources = trackers
    .filter((tracker) => tracker.active && tracker.source_key)
    .map((tracker) => tracker.source_key!);

  return (
    <GoalForm
      requireTypeSelection
      unavailableSpecificSources={unavailableSpecificSources}
      onSubmit={async (data) => {
        await createTracker(data);
      }}
    />
  );
}
