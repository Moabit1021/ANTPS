"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Play, Pause, Download, Trash2, FileAudio } from "lucide-react"

interface AudioItem {
  id: string
  scriptId: string
  fileName: string
  fileSize: number
  duration: number
  voiceAlexId: string
  modelId: string
  status: "PROCESSING" | "COMPLETED" | "FAILED"
  errorMessage: string | null
  createdAt: string
  script: { id: string; title: string }
}

const STATUS_LABELS: Record<string, string> = {
  PROCESSING: "Wird generiert",
  COMPLETED: "Fertig",
  FAILED: "Fehlgeschlagen",
}

function statusClass(status: string): string {
  switch (status) {
    case "PROCESSING": return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "COMPLETED": return "bg-green-100 text-green-800 border-green-200"
    case "FAILED": return "bg-red-100 text-red-800 border-red-200"
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

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function AudioPage() {
  const [audios, setAudios] = useState<AudioItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Player state
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [currentAudio, setCurrentAudio] = useState<AudioItem | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioProgress, setAudioProgress] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingAudio, setDeletingAudio] = useState<AudioItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchAudios = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/audio?limit=50")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAudios(data.audios)
      setTotal(data.total)
    } catch {
      toast({ title: "Fehler", description: "Audio-Dateien konnten nicht geladen werden.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAudios() }, [fetchAudios])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const handlePlay = (audio: AudioItem) => {
    if (playingId === audio.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
    }

    const el = new Audio(`/api/audio/${audio.id}?stream=true`)
    el.onloadedmetadata = () => setAudioDuration(el.duration)
    el.ontimeupdate = () => setAudioProgress(el.currentTime)
    el.onended = () => {
      setPlayingId(null)
      setAudioProgress(0)
    }
    el.onerror = () => {
      toast({ title: "Fehler", description: "Audio konnte nicht abgespielt werden.", variant: "destructive" })
      setPlayingId(null)
    }
    el.play()
    audioRef.current = el
    setPlayingId(audio.id)
    setCurrentAudio(audio)
  }

  const handleDownload = (audio: AudioItem) => {
    const link = document.createElement("a")
    link.href = `/api/audio/${audio.id}?stream=true`
    link.download = audio.fileName
    link.click()
  }

  const handleDelete = async () => {
    if (!deletingAudio) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/audio/${deletingAudio.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast({ title: "Geloescht", description: "Audio wurde geloescht." })
      if (playingId === deletingAudio.id) {
        audioRef.current?.pause()
        setPlayingId(null)
      }
      setDeleteDialogOpen(false)
      setDeletingAudio(null)
      fetchAudios()
    } catch {
      toast({ title: "Fehler", description: "Loeschen fehlgeschlagen.", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audio</h1>
        <p className="text-muted-foreground">
          {total} Audio-Datei{total !== 1 ? "en" : ""} insgesamt
        </p>
      </div>

      {/* Player bar */}
      {currentAudio && playingId && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => handlePlay(currentAudio)}
              >
                <Pause className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{currentAudio.script.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${audioDuration ? (audioProgress / audioDuration) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDuration(Math.floor(audioProgress))} / {formatDuration(Math.floor(audioDuration))}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audio list */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead className="w-[140px]">Datum</TableHead>
              <TableHead>Skript</TableHead>
              <TableHead className="w-[100px]">Dauer</TableHead>
              <TableHead className="w-[80px]">Groesse</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[120px]">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : audios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <FileAudio className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Noch keine Audio-Dateien. Generieren Sie Audio aus einem Skript.
                </TableCell>
              </TableRow>
            ) : (
              audios.map((audio) => (
                <TableRow key={audio.id}>
                  <TableCell>
                    {audio.status === "COMPLETED" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handlePlay(audio)}
                      >
                        {playingId === audio.id ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(audio.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/scripts/${audio.scriptId}`} className="hover:underline">
                      {audio.script.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    ~{formatDuration(audio.duration)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatSize(audio.fileSize)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusClass(audio.status)}>
                      {STATUS_LABELS[audio.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {audio.status === "COMPLETED" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownload(audio)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeletingAudio(audio)
                          setDeleteDialogOpen(true)
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

      {/* Delete dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Audio loeschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie diese Audio-Datei endgueltig loeschen moechten?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
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
