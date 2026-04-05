'use client';

import { useState, useCallback } from 'react';

type UseCopyToClipboardResult = {
  copy: (text: string) => void;
  isCopied: boolean;
};

export function useCopyToClipboard(resetDelay = 2000): UseCopyToClipboardResult {
  const [isCopied, setIsCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      if (!navigator?.clipboard) return;
      try {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), resetDelay);
      } catch {
        setIsCopied(false);
      }
    },
    [resetDelay],
  );

  return { copy, isCopied };
}
