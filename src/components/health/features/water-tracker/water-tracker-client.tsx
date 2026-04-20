'use client';

import { WaterTracker } from './water-tracker';

export function WaterTrackerClient({ targetMl }: { targetMl?: number }) {
  return <WaterTracker targetMl={targetMl} />;
}
