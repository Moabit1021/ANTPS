"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"
import {
  Loader2, Plus, Radio, Trash2, Eye, EyeOff, Pencil, Rss, Copy, Check,
} from "lucide-react"

interface AudioItem {
  id: string
  scriptId: string
  fileName: string
  fileSize: number
  duration: number
  status: string
  createdAt: string
  script: { id: string; title: string }
  episode?: { id: string } | null
}

interface Episode {
  id: string
  audioId: string
  title: string
  description: string
  episodeNumber: number
  publishedAt: string | null
  status: "DRAFT" | "PUBLISHED" | "UNPUBLISHED"
  createdAt: string
  updatedAt: string
  audio: {
    id: string
    fileSize: number
    duration: number
    script: { id: string; title: string }
  }
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  PUBLISHED: "Veröffentlicht",
  UNPUBLISHED: "Nicht veröffentlicht",
}

function statusClass(status: string): string {
  switch (status) {
    case "DRAFT": return "bg-gray-100 text-gray-800 border-gray-200"
    case "PUBLISHED": return "bg-green-100 text-green-800 border-green-200"
    case "UNPUBLISHED": return "bg-yellow-100 text-yellow-800 border-yellow-200"
    default: return ""
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export default function EpisodesPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [availableAudios, setAvailableAudios] = useState<AudioItem[]>([])
  const [loadingAudios, setLoadingAudios] = useState(false)
  const [selectedAudioId, setSelectedAudioId] = useState("")
  const [newTitle, setNewTitle] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [creating, setCreating] = useState(false)

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editSaving, setEditSaving] = useState(false)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingEpisode, setDeletingEpisode] = useState<Episode | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Feed URL
  const [feedUrlCopied, setFeedUrlCopied] = useState(false)

  const fetchEpisodes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (statusFilter !== "all") params.set("status", statusFilter)
      const res = await fetch(`/api/episodes?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEpisodes(data.episodes)
      setTotal(data.total)
    } catch {
      toast({ title: "Fehler", description: "Episoden konnten nicht geladen werden.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchEpisodes() }, [fetchEpisodes])

  const openCreateDialog = async () => {
    setCreateOpen(true)
    setSelectedAudioId("")
    setNewTitle("")
    setNewDescription("")
    setLoadingAudios(true)
    try {
      const res = await fetch("/api/audio?limit=100")
      if (!res.ok) throw new Error()
      const data = await res.json()
      // Filter to completed audios without episodes
      const available = (data.audios as AudioItem[]).filter(
        (a) => a.status === "COMPLETED" && !a.episode
      )
      setAvailableAudios(available)
    } catch {
      toast({ title: "Fehler", description: "Audio-Dateien konnten nicht geladen werden.", variant: "destructive" })
    } finally {
      setLoadingAudios(false)
    }
  }

  const handleCreate = async () => {
    if (!selectedAudioId) return
    setCreating(true)
    try {
      const res = await fetch("/api/episodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioId: selectedAudioId,
          title: newTitle || undefined,
          description: newDescription || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Fehler")
      }
      toast({ title: "Erstellt", description: "Episode wurde erstellt." })
      setCreateOpen(false)
      fetchEpisodes()
    } catch (e) {
      toast({
        title: "Fehler",
        description: e instanceof Error ? e.message : "Episode konnte nicht erstellt werden.",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  const handleStatusChange = async (episode: Episode, newStatus: string) => {
    try {
      const res = await fetch(`/api/episodes/${episode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Fehler")
      }
      toast({
        title: "Aktualisiert",
        description: newStatus === "PUBLISHED"
          ? "Episode wurde veröffentlicht."
          : "Episode wurde zurückgezogen.",
      })
      fetchEpisodes()
    } catch (e) {
      toast({
        title: "Fehler",
        description: e instanceof Error ? e.message : "Status konnte nicht geändert werden.",
        variant: "destructive",
      })
    }
  }

  const openEditDialog = (episode: Episode) => {
    setEditingEpisode(episode)
    setEditTitle(episode.title)
    setEditDescription(episode.description)
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editingEpisode) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/episodes/${editingEpisode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, description: editDescription }),
      })
      if (!res.ok) throw new Error()
      toast({ title: "Gespeichert", description: "Episode wurde aktualisiert." })
      setEditOpen(false)
      fetchEpisodes()
    } catch {
      toast({ title: "Fehler", description: "Episode konnte nicht aktualisiert werden.", variant: "destructive" })
    } finally {
      setEditSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingEpisode) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/episodes/${deletingEpisode.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast({ title: "Geloescht", description: "Episode wurde geloescht." })
      setDeleteOpen(false)
      setDeletingEpisode(null)
      fetchEpisodes()
    } catch {
      toast({ title: "Fehler", description: "Loeschen fehlgeschlagen.", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const copyFeedUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}/api/feed`)
    setFeedUrlCopied(true)
    setTimeout(() => setFeedUrlCopied(false), 2000)
  }

  const publishedCount = episodes.filter((e) => e.status === "PUBLISHED").length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Episoden</h1>
          <p className="text-muted-foreground">
            {total} Episode{total !== 1 ? "n" : ""} insgesamt, {publishedCount} veröffentlicht
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyFeedUrl}>
            {feedUrlCopied ? <Check className="mr-1 h-4 w-4 text-green-600" /> : <Rss className="mr-1 h-4 w-4" />}
            Feed-URL kopieren
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Episode
          </Button>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="DRAFT">Entwurf</SelectItem>
            <SelectItem value="PUBLISHED">Veröffentlicht</SelectItem>
            <SelectItem value="UNPUBLISHED">Nicht veröffentlicht</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Episodes table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>Titel</TableHead>
              <TableHead className="w-[100px]">Dauer</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[140px]">Veröffentlicht</TableHead>
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
            ) : episodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Noch keine Episoden. Erstellen Sie eine Episode aus einer fertigen Audio-Datei.
                </TableCell>
              </TableRow>
            ) : (
              episodes.map((ep) => (
                <TableRow key={ep.id}>
                  <TableCell className="font-medium">{ep.episodeNumber}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{ep.title}</p>
                      {ep.description && (
                        <p className="text-sm text-muted-foreground truncate max-w-md">
                          {ep.description}
                        </p>
                      )}
                      <Link
                        href={`/scripts/${ep.audio.script.id}`}
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        Skript: {ep.audio.script.title}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    ~{formatDuration(ep.audio.duration)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusClass(ep.status)}>
                      {STATUS_LABELS[ep.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {ep.publishedAt ? formatDate(ep.publishedAt) : "\u2014"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {ep.status === "DRAFT" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(ep, "PUBLISHED")}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          Veröffentlichen
                        </Button>
                      )}
                      {ep.status === "PUBLISHED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(ep, "UNPUBLISHED")}
                        >
                          <EyeOff className="mr-1 h-3 w-3" />
                          Zurückziehen
                        </Button>
                      )}
                      {ep.status === "UNPUBLISHED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(ep, "PUBLISHED")}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          Erneut veröffentlichen
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(ep)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeletingEpisode(ep)
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

      {/* Create Episode Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Neue Episode erstellen</DialogTitle>
            <DialogDescription>
              Waehlen Sie eine Audio-Datei aus und geben Sie die Episode-Details ein.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Audio-Datei</Label>
              {loadingAudios ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : availableAudios.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Keine verfuegbaren Audio-Dateien. Generieren Sie zuerst Audio aus einem Skript.
                </p>
              ) : (
                <Select value={selectedAudioId} onValueChange={(v) => {
                  setSelectedAudioId(v)
                  const audio = availableAudios.find((a) => a.id === v)
                  if (audio && !newTitle) setNewTitle(audio.script.title)
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Audio waehlen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableAudios.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.script.title} ({formatDuration(a.duration)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Episoden-Titel</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Titel der Episode..."
              />
            </div>

            <div className="space-y-2">
              <Label>Beschreibung (optional)</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                placeholder="Kurze Beschreibung der Episode..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={creating || !selectedAudioId}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Episode erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Episode Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Episode bearbeiten</DialogTitle>
            <DialogDescription>
              Titel und Beschreibung der Episode aendern.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={editSaving}>
              Abbrechen
            </Button>
            <Button onClick={handleEdit} disabled={editSaving}>
              {editSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Episode loeschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher? Die Audio-Datei bleibt erhalten, aber die Episode wird aus dem Feed entfernt.
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
