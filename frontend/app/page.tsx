"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/api/auth.service"
import LandingPage from "@/components/landing/landing-page"

export default function RootPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [showLanding, setShowLanding] = useState(false)

  useEffect(() => {
    const hostname = window.location.hostname
    const isAppDomain = hostname === "ocr-app.moti.cl"

    if (isAppDomain) {
      // On app domain, root always goes to dashboard (or login)
      const authenticated = authService.isAuthenticated()
      if (authenticated) {
        router.replace("/dashboard")
      } else {
        router.replace("/login")
      }
      return
    }

    // On landing domain (or localhost), show landing if not authenticated
    const authenticated = authService.isAuthenticated()
    if (authenticated) {
      // If on landing domain but authenticated, redirect to app
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ocr-app.moti.cl"
      if (hostname === "ocr.moti.cl") {
        window.location.href = `${appUrl}/dashboard`
        return
      }
      router.replace("/dashboard")
    } else {
      setShowLanding(true)
      setChecking(false)
    }
  }, [router])

  if (checking && !showLanding) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <LandingPage />
}
