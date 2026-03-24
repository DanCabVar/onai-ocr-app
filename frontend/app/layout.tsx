import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { ConditionalNavigation } from "@/components/conditional-navigation"
import { Toaster } from "@/components/ui/toaster"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" })

export const metadata: Metadata = {
  title: "ONAI OCR - Procesamiento Inteligente de Documentos",
  description: "Plataforma moderna para clasificar, procesar y consultar documentos con IA",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ConditionalNavigation>
          {children}
        </ConditionalNavigation>
        <Toaster />
      </body>
    </html>
  )
}
