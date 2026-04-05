'use client';

import { useEffect } from 'react';

export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => reg.update())
      .catch(() => {
        /* HTTP sem SW ou bloqueio — ignorar */
      });
  }, []);

  return null;
}
