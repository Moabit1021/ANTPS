"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import {
  Loader2, Plus, Users, Trash2, Copy, Check, UserX, UserCheck,
} from "lucide-react"

interface Subscriber {
  id: string
  email: string
  name: string | null
  personalToken: string
  isActive: boolean
  note: string | null
  createdAt: string
  _count: { accessLogs: number }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })
}

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [newName, setNewName] = useState("")
  const [newNote, setNewNote] = useState("")
  const [creating, setCreating] = useState(false)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingSub, setDeletingSub] = useState<Subscriber | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchSubscribers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/subscribers?limit=100")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSubscribers(data.subscribers)
      setTotal(data.total)
    } catch {
      toast({ title: "Fehler", description: "Abonnenten konnten nicht geladen werden.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSubscribers() }, [fetchSubscribers])

  const handleCreate = async () => {
    if (!newEmail) return
    setCreating(true)
    try {
      const res = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, name: newName || undefined, note: newNote || undefined }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Fehler")
      }
      toast({ title: "Erstellt", description: "Abonnent wurde hinzugefuegt." })
      setCreateOpen(false)
      setNewEmail("")
      setNewName("")
      setNewNote("")
      fetchSubscribers()
    } catch (e) {
      toast({
        title: "Fehler",
        description: e instanceof Error ? e.message : "Abonnent konnte nicht erstellt werden.",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (sub: Subscriber) => {
    try {
      const res = await fetch(`/api/subscribers/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !sub.isActive }),
      })
      if (!res.ok) throw new Error()
      toast({
        title: "Aktualisiert",
        description: sub.isActive ? "Abonnent wurde deaktiviert." : "Abonnent wurde aktiviert.",
      })
      fetchSubscribers()
    } catch {
      toast({ title: "Fehler", description: "Status konnte nicht geaendert werden.", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!deletingSub) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/subscribers/${deletingSub.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast({ title: "Geloescht", description: "Abonnent wurde entfernt." })
      setDeleteOpen(false)
      setDeletingSub(null)
      fetchSubscribers()
    } catch {
      toast({ title: "Fehler", description: "Loeschen fehlgeschlagen.", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const copyFeedUrl = (token: string, id: string) => {
    const url = `${window.location.origin}/api/feed?token=${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Abonnenten</h1>
          <p className="text-muted-foreground">
            {total} Abonnent{total !== 1 ? "en" : ""}, {subscribers.filter((s) => s.isActive).length} aktiv
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Abonnent
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-Mail</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px]">Zugriffe</TableHead>
              <TableHead className="w-[120px]">Erstellt</TableHead>
              <TableHead className="w-[200px]">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : subscribers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Noch keine Abonnenten. Fuegen Sie Abonnenten hinzu, um personalisierte Feed-URLs zu erstellen.
                </TableCell>
              </TableRow>
            ) : (
              subscribers.map((sub) => (
                <TableRow key={sub.id} className={!sub.isActive ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{sub.email}</TableCell>
                  <TableCell className="text-sm">{sub.name || "\u2014"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={sub.isActive
                      ? "bg-green-100 text-green-800 border-green-200"
                      : "bg-gray-100 text-gray-800 border-gray-200"
                    }>
                      {sub.isActive ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-center">{sub._count.accessLogs}</TableCell>
                  <TableCell className="text-sm">{formatDate(sub.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyFeedUrl(sub.personalToken, sub.id)}
                      >
                        {copiedId === sub.id ? (
                          <Check className="mr-1 h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="mr-1 h-3 w-3" />
                        )}
                        Feed-URL
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleActive(sub)}
                        title={sub.isActive ? "Deaktivieren" : "Aktivieren"}
                      >
                        {sub.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeletingSub(sub)
                          setDeleteOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neuen Abonnenten hinzufuegen</DialogTitle>
            <DialogDescription>
              Ein persoenlicher Feed-Link mit Zugriffsprotokollierung wird automatisch erstellt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>E-Mail *</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Name (optional)</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Vor- und Nachname"
              />
            </div>
            <div className="space-y-2">
              <Label>Notiz (optional)</Label>
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Interne Notiz..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newEmail}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Hinzufuegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abonnent loeschen</DialogTitle>
            <DialogDescription>
              Der Abonnent und alle Zugriffsprotokolle werden dauerhaft geloescht.
              {deletingSub && ` (${deletingSub.email})`}
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
