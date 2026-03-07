"use client"

import { useSession } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Toaster } from "@/components/ui/toaster"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated" && pathname !== "/login") {
      router.push("/login")
    }
  }, [status, pathname, router])

  // Show login page without sidebar
  if (pathname === "/login") {
    return (
      <>
        {children}
        <Toaster />
      </>
    )
  }

  // Show loading while checking auth
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    )
  }

  // Show nothing while redirecting
  if (status === "unauthenticated") {
    return null
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 pt-16 md:pt-6">
        {children}
      </main>
      <Toaster />
    </div>
  )
}
