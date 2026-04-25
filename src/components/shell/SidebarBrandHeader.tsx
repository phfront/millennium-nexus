'use client';

import { X } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface SidebarBrandHeaderProps {
  onClose?: () => void;
}

/**
 * Shared brand header used at the top of every module sidebar.
 * Shows the brand logo + product name. The X close button is only rendered when
 * `onClose` is provided (mobile drawer context).
 */
export function SidebarBrandHeader({ onClose }: SidebarBrandHeaderProps) {
  return (
    <div className="flex items-center h-16 px-4 border-b border-border gap-3 shrink-0">
      <span className="shrink-0">
        <BrandLogo size={32} />
      </span>
      <span className="font-bold text-text-primary truncate flex-1 text-sm">Nexus</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar menu"
          className="md:hidden p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
