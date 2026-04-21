'use client';

import { useEffect, useState } from 'react';
import type { DashboardWidgetBreakpoint } from '@/types/database';

function detectBreakpoint(width: number): DashboardWidgetBreakpoint {
  if (width >= 1024) return 'lg';
  if (width >= 768) return 'md';
  return 'sm';
}

export function useActiveBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<DashboardWidgetBreakpoint>('lg');

  useEffect(() => {
    const update = () => {
      setBreakpoint(detectBreakpoint(window.innerWidth));
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return breakpoint;
}
