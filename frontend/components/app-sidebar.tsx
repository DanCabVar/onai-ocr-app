"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, HardDrive, Layers, Settings,
  ScanEye, ChevronDown, LogOut, User, HelpCircle, MessageCircle,
  ChevronLeft, ChevronRight, Sun
} from "lucide-react";
import { authService } from "@/lib/api/auth.service";
import Link from "next/link";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Documentos", href: "/documents", icon: FileText },
  { label: "Chat IA", href: "/chat", icon: MessageCircle },
  { label: "Almacenamiento", href: "/storage", icon: HardDrive },
];

const configNavItems = [
  { label: "Tipos de Doc", href: "/document-types", icon: Layers },
  { label: "Ajustes", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(authService.getStoredUser());

  useEffect(() => {
    const handleStorageOrNav = () => setUser(authService.getStoredUser());
    window.addEventListener("storage", handleStorageOrNav);
    window.addEventListener("focus", handleStorageOrNav);
    handleStorageOrNav();
    return () => {
      window.removeEventListener("storage", handleStorageOrNav);
      window.removeEventListener("focus", handleStorageOrNav);
    };
  }, [pathname]);

  const handleLogout = () => {
    authService.clearAuth();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside className={cn(
      "relative flex flex-col h-full bg-[hsl(var(--sidebar))] border-r border-[hsl(var(--sidebar-border))] transition-all duration-200",
      collapsed ? "w-[64px]" : "w-[280px]"
    )}>
      {/* Logo + collapse button */}
      <div className={cn(
        "flex items-center border-b border-[hsl(var(--sidebar-border))]",
        collapsed ? "justify-center px-2 py-5" : "justify-between px-5 py-6"
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <ScanEye className="w-8 h-8 text-[hsl(var(--primary))] shrink-0" />
            <span className="font-primary text-lg font-bold text-[hsl(var(--primary))]">ONAI OCR</span>
          </div>
        )}
        {collapsed && <ScanEye className="w-7 h-7 text-[hsl(var(--primary))]" />}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-1.5 rounded-lg hover:bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] transition-colors",
            collapsed && "mt-0"
          )}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-2 py-4 overflow-y-auto">
        {!collapsed && (
          <p className="px-4 py-2 text-xs font-semibold text-[hsl(var(--sidebar-foreground))] font-primary">Principal</p>
        )}
        {mainNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-4 px-3 py-3 rounded-full text-sm transition-colors",
              collapsed && "justify-center px-0",
              isActive(item.href)
                ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] font-medium"
                : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))/0.5]"
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="font-secondary">{item.label}</span>}
          </Link>
        ))}

        {!collapsed && (
          <p className="px-4 py-2 mt-4 text-xs font-semibold text-[hsl(var(--sidebar-foreground))] font-primary">Configuración</p>
        )}
        {collapsed && <div className="my-2 border-t border-[hsl(var(--sidebar-border))]" />}
        {configNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-4 px-3 py-3 rounded-full text-sm transition-colors",
              collapsed && "justify-center px-0",
              isActive(item.href)
                ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] font-medium"
                : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))/0.5]"
            )}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="font-secondary">{item.label}</span>}
          </Link>
        ))}
      </nav>

      {/* Theme Toggle */}
      <div className={cn(
        "pb-2 flex items-center gap-2 text-sm text-[hsl(var(--sidebar-foreground))]",
        collapsed ? "justify-center px-2" : "px-6"
      )}>
        <ThemeToggle />
        {!collapsed && <span className="font-secondary">Cambiar tema</span>}
      </div>

      {/* User Footer */}
      <div className={cn(
        "border-t border-[hsl(var(--sidebar-border))] py-4",
        collapsed ? "px-2" : "px-6"
      )}>
        {collapsed ? (
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="flex justify-center w-full p-2 rounded-lg hover:bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))] transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 w-full text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[hsl(var(--sidebar-accent-foreground))] truncate font-secondary">
                  {user?.name || "Usuario"}
                </p>
                <p className="text-sm text-[hsl(var(--sidebar-foreground))] truncate font-secondary">
                  {user?.email || "email@example.com"}
                </p>
              </div>
              <ChevronDown className="w-5 h-5 text-[hsl(var(--sidebar-foreground))]" />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-[hsl(var(--popover))] border border-[hsl(var(--border))] rounded-lg shadow-lg py-1 z-50">
                <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-[hsl(var(--accent))] transition-colors" onClick={() => setUserMenuOpen(false)}>
                  <User className="w-4 h-4" /> Perfil
                </Link>
                <Link href="/help" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-[hsl(var(--accent))] transition-colors" onClick={() => setUserMenuOpen(false)}>
                  <HelpCircle className="w-4 h-4" /> Ayuda
                </Link>
                <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm w-full text-left text-destructive hover:bg-[hsl(var(--accent))] transition-colors">
                  <LogOut className="w-4 h-4" /> Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
