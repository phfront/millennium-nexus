'use client';

import { WaterTracker } from './water-tracker';

type WaterTrackerClientProps = {
  targetMl?: number;
  /** Altura mínima extra do card (ex.: página Nutrição). Na home não definir. */
  cardMinHeightClass?: string;
};

export function WaterTrackerClient({ targetMl, cardMinHeightClass }: WaterTrackerClientProps) {
  return <WaterTracker targetMl={targetMl} cardMinHeightClass={cardMinHeightClass} />;
}
