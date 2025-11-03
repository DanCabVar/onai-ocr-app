"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { FileText, FileUp, Settings, User, FolderOpen, LogOut, HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { authService } from "@/lib/api/auth.service"
import { useEffect, useState } from "react"
import UploadDocumentModal from "@/components/upload-document-modal"

const navItems = [
  {
    title: "Tipos de Documento",
    href: "/document-types",
    icon: FolderOpen,
  },
]

interface NavigationProps {
  onDocumentUploaded?: () => void
}

export function Navigation({ onDocumentUploaded }: NavigationProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [userName, setUserName] = useState<string>("")
  const [userInitials, setUserInitials] = useState<string>("U")
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  useEffect(() => {
    const user = authService.getStoredUser()
    if (user) {
      setUserName(user.name || user.email)
      // Obtener iniciales del nombre
      const initials = user.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
        : user.email[0].toUpperCase()
      setUserInitials(initials)
    }
  }, [])

  const handleLogout = () => {
    authService.clearAuth()
    router.push('/login')
  }

  const handleUploadSuccess = () => {
    setUploadModalOpen(false)
    if (onDocumentUploaded) {
      onDocumentUploaded()
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">ONAI OCR</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {/* Botón Subir Documento (abre modal) */}
            <Button
              variant="ghost"
              className="gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
              onClick={() => setUploadModalOpen(true)}
            >
              <FileUp className="h-4 w-4" />
              Subir Documento
            </Button>

            {/* Otros nav items */}
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className="gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Button>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{userName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {authService.getStoredUser()?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Perfil</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configuración</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help" className="cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>Ayuda</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Modal de subida de documentos */}
      <UploadDocumentModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUploadSuccess={handleUploadSuccess}
      />
    </header>
  )
}
