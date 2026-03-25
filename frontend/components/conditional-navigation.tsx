"use client"

import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import UploadDocumentModal from "@/components/upload-document-modal"
import { useState, useEffect, useCallback } from "react"
import { Menu, X } from "lucide-react"

export function ConditionalNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Listen for openUploadModal events from any page
  useEffect(() => {
    const handler = () => setUploadOpen(true)
    window.addEventListener("openUploadModal", handler)
    return () => window.removeEventListener("openUploadModal", handler)
  }, [])

  // Close sidebar on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const handleUploadSuccess = useCallback(() => {
    setUploadOpen(false)
    // Dispatch event so pages can refresh their data
    window.dispatchEvent(new CustomEvent("documentUploaded"))
  }, [])

  const isPublicRoute = pathname === '/login' || pathname === '/register'

  if (isPublicRoute) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen">
      {/* Mobile hamburger button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-background/80 backdrop-blur border border-border shadow-sm"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Mobile close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-4 z-50 p-1 rounded-full hover:bg-accent"
          aria-label="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
        <AppSidebar />
      </div>

      <main className="flex-1 overflow-auto w-full">
        {/* Spacer for mobile hamburger */}
        <div className="lg:hidden h-14" />
        {children}
      </main>

      {/* Global Upload Modal */}
      <UploadDocumentModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  )
}
