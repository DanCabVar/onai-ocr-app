"use client"

import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"

export function ConditionalNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // No mostrar sidebar en páginas de login y register
  const isPublicRoute = pathname === '/login' || pathname === '/register'

  if (isPublicRoute) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
