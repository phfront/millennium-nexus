"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Avatar, NavItem } from "@phfront/millennium-ui";
import { useMobileSidebar } from "@/components/shell/MobileSidebarContext";
import { SidebarBrandHeader } from "@/components/shell/SidebarBrandHeader";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Heart,
  Home,
  LogOut,
  PieChart,
  Settings,
  Shield,
  Target,
  Wallet,
} from "lucide-react";
import type { Module } from "@/types/database";

interface AppSidebarProps {
  modules: Module[];
}

type NavLeaf = {
  href: string;
  label: string;
  icon: ReactNode;
  match?: (pathname: string) => boolean;
};

type NavGroup = {
  href: string;
  label: string;
  icon: ReactNode;
  children: NavLeaf[];
  match?: (pathname: string) => boolean;
};

const REMOVED_MODULE_SLUGS = new Set(["households", "lists", "learning"]);

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isLeafActive(pathname: string, leaf: NavLeaf) {
  return leaf.match ? leaf.match(pathname) : isRouteActive(pathname, leaf.href);
}

function isGroupActive(pathname: string, group: NavGroup) {
  if (group.match?.(pathname)) return true;
  if (isRouteActive(pathname, group.href)) return true;
  return group.children.some((child) => isLeafActive(pathname, child));
}

function SidebarGroup({
  group,
  pathname,
  isOpen,
  onToggle,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const active = isGroupActive(pathname, group);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onToggle}
        className={[
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-brand-primary/10 text-brand-primary"
            : "text-text-secondary hover:bg-surface-3 hover:text-text-primary",
        ].join(" ")}
      >
        <span className={`shrink-0 ${active ? "text-brand-primary" : ""}`}>{group.icon}</span>
        <span className="min-w-0 flex-1 truncate text-left">{group.label}</span>
        <span className="shrink-0 text-text-muted">
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      <div
        className={[
          "grid transition-[grid-template-rows] duration-300 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <div className="ml-3 flex flex-col gap-0.5 border-l border-border/50 pl-3 pt-1">
            {group.children.map((child) => (
              <NavItem
                key={child.href}
                href={child.href}
                icon={child.icon}
                label={child.label}
                isActive={isLeafActive(pathname, child)}
                onClick={onNavigate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar({ modules }: AppSidebarProps) {
  const pathname = usePathname();
  const { isOpen, close } = useMobileSidebar();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOpen, setIsAnimatingOpen] = useState(false);
  const user = useCurrentUser();
  const profile = user?.profile ?? null;

  const allowedModuleSlugs = new Set(
    modules
      .filter((module) => module.is_active && !REMOVED_MODULE_SLUGS.has(module.slug))
      .map((module) => module.slug),
  );

  const groups: NavGroup[] = [
    ...(allowedModuleSlugs.has("health")
      ? [
          {
            href: "/health",
            label: "Health",
            icon: <Heart size={18} />,
            match: (currentPath: string) => currentPath.startsWith("/health"),
            children: [
              {
                href: "/health/peso",
                label: "Controle de peso",
                icon: <Heart size={16} />,
                match: (currentPath: string) => currentPath === "/health/peso",
              },
              { href: "/health/log/new", label: "Registrar peso", icon: <Activity size={16} /> },
              { href: "/health/history", label: "Histórico", icon: <Activity size={16} /> },
              { href: "/health/setup", label: "Configurar meta", icon: <Settings size={16} /> },
            ],
          } satisfies NavGroup,
        ]
      : []),
    ...(allowedModuleSlugs.has("finance")
      ? [
          {
            href: "/finance",
            label: "Finance",
            icon: <Wallet size={18} />,
            match: (currentPath: string) => currentPath.startsWith("/finance"),
            children: [
              {
                href: "/finance",
                label: "Dashboard",
                icon: <Wallet size={16} />,
                match: (currentPath: string) => currentPath === "/finance",
              },
              { href: "/finance/budget", label: "Orçamento", icon: <PieChart size={16} /> },
              { href: "/finance/income", label: "Receitas", icon: <Activity size={16} /> },
              { href: "/finance/expenses", label: "Despesas", icon: <Activity size={16} /> },
              { href: "/finance/one-time", label: "Lançamentos", icon: <Activity size={16} /> },
              { href: "/finance/subscriptions", label: "Assinaturas", icon: <Activity size={16} /> },
              { href: "/finance/receivables", label: "Cobranças", icon: <Activity size={16} /> },
              { href: "/finance/history", label: "Histórico", icon: <Activity size={16} /> },
              { href: "/finance/settings", label: "Configurações", icon: <Settings size={16} /> },
            ],
          } satisfies NavGroup,
        ]
      : []),
    ...(allowedModuleSlugs.has("habits-goals")
      ? [
          {
            href: "/habits-goals",
            label: "Hábitos e Metas",
            icon: <Target size={18} />,
            match: (currentPath: string) => currentPath.startsWith("/habits-goals"),
            children: [
              {
                href: "/habits-goals",
                label: "Hoje",
                icon: <Target size={16} />,
                match: (currentPath: string) => currentPath === "/habits-goals",
              },
              { href: "/habits-goals/history", label: "Histórico", icon: <Activity size={16} /> },
              { href: "/habits-goals/config", label: "Metas", icon: <Settings size={16} /> },
              { href: "/habits-goals/notifications", label: "Notificações", icon: <Settings size={16} /> },
            ],
          } satisfies NavGroup,
        ]
      : []),
  ];

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.map((group) => [group.href, isGroupActive(pathname, group)])),
  );

  useEffect(() => {
    setOpenGroups((current) => {
      const next = { ...current };
      for (const group of groups) {
        if (!(group.href in next)) next[group.href] = isGroupActive(pathname, group);
        if (isGroupActive(pathname, group)) next[group.href] = true;
      }
      return next;
    });
  }, [pathname]);

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
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  const topLinks: NavLeaf[] = [
    { href: "/", label: "Início", icon: <Home size={18} /> },
    ...(profile?.is_admin ? [{ href: "/admin", label: "Admin", icon: <Shield size={18} /> }] : []),
  ];

  function toggleGroup(href: string) {
    setOpenGroups((current) => ({ ...current, [href]: !current[href] }));
  }

  function renderBody(onNavigate?: () => void) {
    return (
      <>
        <SidebarBrandHeader onClose={onNavigate} />

        <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-1">
          {topLinks.map((link) => (
            <NavItem
              key={link.href}
              href={link.href}
              icon={link.icon}
              label={link.label}
              isActive={isLeafActive(pathname, link)}
              onClick={onNavigate}
            />
          ))}

          {groups.map((group) => (
            <SidebarGroup
              key={group.href}
              group={group}
              pathname={pathname}
              isOpen={Boolean(openGroups[group.href])}
              onToggle={() => toggleGroup(group.href)}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        <div className="shrink-0 border-t border-border px-2 py-3">
          <div className="flex flex-col gap-1">
            {profile && (
              <div className="flex items-center gap-3 px-3 py-2">
                <Avatar src={profile.avatar_url} name={profile.full_name ?? undefined} size="sm" />
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
              onClick={onNavigate}
            />
            <NavItem
              onClick={async () => {
                onNavigate?.();
                await handleLogout();
              }}
              icon={<LogOut size={18} />}
              label="Sair"
              isActive={false}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="hidden md:flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface-2"
      >
        {renderBody()}
      </nav>

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
              "relative flex h-full w-72 max-w-[85vw] flex-col border-r border-border bg-surface-2 shadow-2xl",
              "transition-transform duration-300 ease-out",
              isAnimatingOpen ? "translate-x-0" : "-translate-x-full",
            ].join(" ")}
          >
            {renderBody(close)}
          </nav>
        </div>
      )}
    </>
  );
}
