"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/api/auth.service"
import LandingPage from "@/components/landing/landing-page"

export default function RootPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [isAuth, setIsAuth] = useState(false)

  useEffect(() => {
    const authenticated = authService.isAuthenticated()
    if (authenticated) {
      router.replace("/dashboard")
    } else {
      setIsAuth(false)
      setChecking(false)
    }
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <LandingPage />
}
