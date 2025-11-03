"use client"

import { usePathname } from "next/navigation"
import { Navigation } from "@/components/navigation"

export function ConditionalNavigation() {
  const pathname = usePathname()
  
  // No mostrar navegación en páginas de login y register
  const hideNavigation = pathname === '/login' || pathname === '/register'
  
  if (hideNavigation) {
    return null
  }
  
  return <Navigation />
}

