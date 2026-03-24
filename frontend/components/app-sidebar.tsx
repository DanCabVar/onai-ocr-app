"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, HardDrive, Layers, Settings,
  ScanEye, ChevronDown, LogOut, User, HelpCircle
} from "lucide-react";
import { authService } from "@/lib/api/auth.service";
import Link from "next/link";
import { useState } from "react";

const mainNavItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Documentos", href: "/documents", icon: FileText },
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
  const user = authService.getStoredUser();

  const handleLogout = () => {
    authService.clearAuth();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="flex flex-col w-[280px] h-full bg-[hsl(var(--sidebar))] border-r border-[hsl(var(--sidebar-border))]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-8 py-6 border-b border-[hsl(var(--sidebar-border))]">
        <ScanEye className="w-8 h-8 text-[hsl(var(--primary))]" />
        <span className="font-primary text-lg font-bold text-[hsl(var(--primary))]">ONAI OCR</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1 px-4 py-4 overflow-y-auto">
        <p className="px-4 py-2 text-xs font-semibold text-[hsl(var(--sidebar-foreground))] font-primary">Principal</p>
        {mainNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-4 px-4 py-3 rounded-full text-sm transition-colors ${
              isActive(item.href)
                ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] font-medium"
                : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))/0.5]"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-secondary">{item.label}</span>
          </Link>
        ))}

        <p className="px-4 py-2 mt-4 text-xs font-semibold text-[hsl(var(--sidebar-foreground))] font-primary">Configuración</p>
        {configNavItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-4 px-4 py-3 rounded-full text-sm transition-colors ${
              isActive(item.href)
                ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))] font-medium"
                : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))/0.5]"
            }`}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-secondary">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* User Footer */}
      <div className="border-t border-[hsl(var(--sidebar-border))] px-8 py-6">
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
      </div>
    </aside>
  );
}
