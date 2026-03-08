"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import {
  Loader2, Plus, Shield, ShieldCheck, Trash2, UserX, UserCheck, Clock, Mail,
} from "lucide-react"

interface User {
  id: string
  email: string
  name: string | null
  role: string
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

interface Invite {
  id: string
  email: string
  expiresAt: string
  createdAt: string
  invitedBy: { name: string | null; email: string }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function UsersPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteExpiry, setInviteExpiry] = useState("48")
  const [inviting, setInviting] = useState(false)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Redirect non-admins
  useEffect(() => {
    if (session && session.user?.role !== "ADMIN") {
      router.push("/")
    }
  }, [session, router])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/users")
      if (res.status === 403) {
        router.push("/")
        return
      }
      if (!res.ok) throw new Error()
      const data = await res.json()
      setUsers(data.users)
      setInvites(data.invites)
    } catch {
      toast({ title: "Fehler", description: "Benutzer konnten nicht geladen werden.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleInvite = async () => {
    if (!inviteEmail) return
    setInviting(true)
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          expiresInHours: parseInt(inviteExpiry),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Fehler")
      toast({ title: "Einladung gesendet", description: `Einladung an ${inviteEmail} wurde gesendet.` })
      setInviteOpen(false)
      setInviteEmail("")
      fetchUsers()
    } catch (e) {
      toast({
        title: "Fehler",
        description: e instanceof Error ? e.message : "Einladung konnte nicht gesendet werden.",
        variant: "destructive",
      })
    } finally {
      setInviting(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Fehler")
      }
      toast({ title: "Aktualisiert", description: "Rolle wurde geaendert." })
      fetchUsers()
    } catch (e) {
      toast({
        title: "Fehler",
        description: e instanceof Error ? e.message : "Rolle konnte nicht geaendert werden.",
        variant: "destructive",
      })
    }
  }

  const toggleActive = async (user: User) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Fehler")
      }
      toast({
        title: "Aktualisiert",
        description: user.isActive ? "Benutzer wurde deaktiviert." : "Benutzer wurde aktiviert.",
      })
      fetchUsers()
    } catch (e) {
      toast({
        title: "Fehler",
        description: e instanceof Error ? e.message : "Status konnte nicht geaendert werden.",
        variant: "destructive",
      })
    }
  }

  const handleDelete = async () => {
    if (!deletingUser) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/users/${deletingUser.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Fehler")
      }
      toast({ title: "Geloescht", description: "Benutzer wurde entfernt." })
      setDeleteOpen(false)
      setDeletingUser(null)
      fetchUsers()
    } catch (e) {
      toast({
        title: "Fehler",
        description: e instanceof Error ? e.message : "Loeschen fehlgeschlagen.",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
    }
  }

  const revokeInvite = async (inviteId: string) => {
    try {
      const res = await fetch(`/api/users/invites/${inviteId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast({ title: "Widerrufen", description: "Einladung wurde zurueckgezogen." })
      fetchUsers()
    } catch {
      toast({ title: "Fehler", description: "Einladung konnte nicht widerrufen werden.", variant: "destructive" })
    }
  }

  if (session && session.user?.role !== "ADMIN") {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Benutzerverwaltung</h1>
          <p className="text-muted-foreground">
            {users.length} Benutzer, {invites.filter((i) => new Date(i.expiresAt) > new Date()).length} offene Einladungen
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Benutzer einladen
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-Mail</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[120px]">Rolle</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[120px]">Letzter Login</TableHead>
              <TableHead className="w-[180px]">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Keine Benutzer vorhanden.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className={!user.isActive ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell className="text-sm">{user.name || "\u2014"}</TableCell>
                  <TableCell>
                    {user.id === session?.user?.id ? (
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        Admin
                      </Badge>
                    ) : (
                      <Select
                        value={user.role}
                        onValueChange={(val) => handleRoleChange(user.id, val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="CREATOR">Creator</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={user.isActive
                      ? "bg-green-100 text-green-800 border-green-200"
                      : "bg-gray-100 text-gray-800 border-gray-200"
                    }>
                      {user.isActive ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : "\u2014"}
                  </TableCell>
                  <TableCell>
                    {user.id !== session?.user?.id && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleActive(user)}
                          title={user.isActive ? "Deaktivieren" : "Aktivieren"}
                        >
                          {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeletingUser(user)
                            setDeleteOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <>
          <h2 className="text-xl font-semibold">Offene Einladungen</h2>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-Mail</TableHead>
                  <TableHead className="w-[180px]">Gueltig bis</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[100px]">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => {
                  const expired = new Date(invite.expiresAt) < new Date()
                  return (
                    <TableRow key={invite.id} className={expired ? "opacity-60" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {invite.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDateTime(invite.expiresAt)}
                      </TableCell>
                      <TableCell>
                        {expired ? (
                          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                            <Clock className="mr-1 h-3 w-3" />
                            Abgelaufen
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                            <Clock className="mr-1 h-3 w-3" />
                            Ausstehend
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => revokeInvite(invite.id)}
                          title="Einladung widerrufen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Benutzer einladen</DialogTitle>
            <DialogDescription>
              Geben Sie die E-Mail-Adresse ein. Der Benutzer erhaelt einen Einladungslink per E-Mail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>E-Mail *</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Link gueltig fuer</Label>
              <Select value={inviteExpiry} onValueChange={setInviteExpiry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 Stunden</SelectItem>
                  <SelectItem value="48">48 Stunden (empfohlen)</SelectItem>
                  <SelectItem value="72">72 Stunden</SelectItem>
                  <SelectItem value="168">1 Woche</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)} disabled={inviting}>
              Abbrechen
            </Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
              {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Einladung senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer loeschen</DialogTitle>
            <DialogDescription>
              Der Benutzer wird dauerhaft geloescht und kann sich nicht mehr anmelden.
              {deletingUser && ` (${deletingUser.email})`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Loeschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
