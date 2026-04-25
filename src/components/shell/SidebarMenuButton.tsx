'use client';

import { Menu } from 'lucide-react';
import { useMobileSidebar } from './MobileSidebarContext';

interface SidebarMenuButtonProps {
  /** id of the controlled drawer for aria-controls */
  controls?: string;
}

/**
 * Hamburger button rendered in mobile module headers to open the sidebar drawer.
 */
export function SidebarMenuButton({ controls = 'module-sidebar-drawer' }: SidebarMenuButtonProps) {
  const { isOpen, open } = useMobileSidebar();

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Abrir menu de navegação"
      aria-expanded={isOpen}
      aria-controls={controls}
      className="shrink-0 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors cursor-pointer inline-flex"
    >
      <Menu size={22} strokeWidth={2} />
    </button>
  );
}
