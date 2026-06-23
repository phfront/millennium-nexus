'use client';

import { useEffect, type ReactNode } from 'react';
import { useMobileSidebar } from './MobileSidebarContext';

interface ModuleSidebarShellProps {
  /** Sidebar content (logo + nav + footer). Receives `onClose` so links can dismiss the mobile drawer. */
  children: (ctx: { onClose: () => void; isMobile: boolean }) => ReactNode;
  /** id used for aria-controls on the hamburger button */
  drawerId?: string;
}

/**
 * Shared shell for module sidebars.
 *
 * Renders:
 * - A persistent sidebar on `md+` viewports.
 * - An animated drawer on smaller viewports, controlled by `MobileSidebarContext`.
 *
 * The drawer DOM is always mounted so open/close transitions stay smooth in both directions.
 */
export function ModuleSidebarShell({ children, drawerId = 'module-sidebar-drawer' }: ModuleSidebarShellProps) {
  const { isOpen, close } = useMobileSidebar();

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Close the drawer with Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  return (
    <>
      {/* Desktop sidebar (persistent) */}
      <nav
        aria-label="Navegação principal"
        className="hidden md:flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface-2"
      >
        {children({ onClose: () => {}, isMobile: false })}
      </nav>

      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            onClick={close}
            aria-label="Fechar menu de navegação"
            className="absolute inset-0 h-full w-full bg-black/60 backdrop-blur-sm"
          />
          <nav
            id={drawerId}
            aria-label="Navegação principal"
            className="relative flex h-full w-72 max-w-[85vw] flex-col bg-surface-2 shadow-2xl"
          >
            {children({ onClose: close, isMobile: true })}
          </nav>
        </div>
      )}
    </>
  );
}
