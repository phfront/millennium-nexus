"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  Avatar,
  Icon,
  NavItem,
} from "@phfront/millennium-ui";
import { BrandLogo } from "@/components/shell/BrandLogo";
import { useMobileSidebar } from "@/components/shell/MobileSidebarContext";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Settings, Home, Shield, X } from "lucide-react";
import type { Module } from "@/types/database";

interface AppSidebarProps {
  modules: Module[];
}

export function AppSidebar({ modules }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen, close } = useMobileSidebar();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOpen, setIsAnimatingOpen] = useState(false);
  const user = useCurrentUser();
  const profile = user?.profile ?? null;

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimatingOpen(false);
      const openTimer = window.setTimeout(() => setIsAnimatingOpen(true), 20);
      return () => window.clearTimeout(openTimer);
    }
    setIsAnimatingOpen(false);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen || !isVisible) return;
    const timeout = window.setTimeout(() => setIsVisible(false), 300);
    return () => window.clearTimeout(timeout);
  }, [isOpen, isVisible]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const activeModules = modules
    .filter((m) => m.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const links = [
    {
      href: "/",
      icon: <Home size={18} />,
      label: "Início",
      isActive: pathname === "/",
    },
    ...(profile?.is_admin
      ? [
          {
            href: "/admin",
            icon: <Shield size={18} />,
            label: "Admin",
            isActive: pathname === "/admin",
          },
        ]
      : []),
    ...activeModules.map((m) => ({
      href: `/${m.slug}`,
      icon: <Icon name={m.icon_name} fallbackName="Box" size={18} />,
      label: m.label,
      isActive: pathname === `/${m.slug}` || pathname.startsWith(`/${m.slug}/`),
    })),
  ];

  const logo = <BrandLogo size={32} />;

  const footer = (
    <div className="flex flex-col gap-1">
      {profile && (
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar
            src={profile.avatar_url}
            name={profile.full_name ?? undefined}
            size="sm"
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-text-primary truncate">
              {profile.full_name ?? "Usuário"}
            </p>
            <p className="text-xs text-text-muted truncate">{user?.email}</p>
          </div>
        </div>
      )}
      <NavItem
        href="/profile"
        icon={<Settings size={18} />}
        label="Perfil & Config."
        isActive={pathname === "/profile" || pathname.startsWith("/profile/")}
      />
      <NavItem
        onClick={handleLogout}
        icon={<LogOut size={18} />}
        label="Sair"
        isActive={pathname === "/logout"}
      />
    </div>
  );

  return (
    <>
      <Sidebar logo={logo} links={links} footer={footer} className="hidden md:flex" />

      {isVisible && (
        <div
          className={[
            "md:hidden fixed inset-0 z-50 flex",
            isAnimatingOpen ? "pointer-events-auto" : "pointer-events-none",
          ].join(" ")}
        >
          <div
            className={[
              "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200",
              isAnimatingOpen ? "opacity-100" : "opacity-0",
            ].join(" ")}
            onClick={close}
          />

          <nav
            id="app-mobile-sidebar"
            aria-label="Navegação principal"
            className={[
              "relative flex flex-col bg-surface-2 border-r border-border h-full w-72 max-w-[85vw] shadow-2xl",
              "transition-transform duration-300 ease-out",
              isAnimatingOpen ? "translate-x-0" : "-translate-x-full",
            ].join(" ")}
          >
            <div className="flex items-center h-16 px-4 border-b border-border gap-3 shrink-0">
              <span className="shrink-0">{logo}</span>
              <span className="font-bold text-text-primary truncate flex-1 text-sm">Nexus</span>
              <button
                type="button"
                onClick={close}
                aria-label="Fechar menu de navegação"
                className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-1">
              {links.map((link) => (
                <NavItem
                  key={link.href}
                  href={link.href}
                  icon={link.icon}
                  label={link.label}
                  isActive={link.isActive}
                  onClick={close}
                />
              ))}
            </div>

            <div className="shrink-0 border-t border-border px-2 py-3">
              <div className="flex flex-col gap-1">
                {profile && (
                  <div className="flex items-center gap-3 px-3 py-2">
                    <Avatar
                      src={profile.avatar_url}
                      name={profile.full_name ?? undefined}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">
                        {profile.full_name ?? "Usuário"}
                      </p>
                      <p className="text-xs text-text-muted truncate">{user?.email}</p>
                    </div>
                  </div>
                )}
                <NavItem
                  href="/profile"
                  icon={<Settings size={18} />}
                  label="Perfil & Config."
                  isActive={pathname === "/profile" || pathname.startsWith("/profile/")}
                  onClick={close}
                />
                <NavItem
                  onClick={async () => {
                    close();
                    await handleLogout();
                  }}
                  icon={<LogOut size={18} />}
                  label="Sair"
                  isActive={false}
                />
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
