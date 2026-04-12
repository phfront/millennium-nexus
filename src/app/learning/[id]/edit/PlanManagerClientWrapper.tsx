'use client';

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with dnd-kit
const PlanManagerClient = dynamic(
  () => import('./PlanManagerClient').then(mod => mod.PlanManagerClient),
  { 
    ssr: false, 
    loading: () => <div className="p-8 text-center text-text-muted">Carregando editor...</div> 
  }
);

interface Props {
  plan: any;
  schedulingType?: 'relative' | 'calendar';
}

export function PlanManagerClientWrapper({ plan, schedulingType }: Props) {
  return <PlanManagerClient plan={plan} schedulingType={schedulingType} />;
}
