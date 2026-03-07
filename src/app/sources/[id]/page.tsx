"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Pencil, Save, X, Archive, Trash2, Loader2 } from "lucide-react"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

interface Source {
  id: string
  type: "NEWSLETTER" | "PDF_UPLOAD" | "MANUAL_TEXT"
  title: string
  senderEmail: string | null
  senderName: string | null
  receivedAt: string
  rawContent: string
  plainText: string
  summary: string | null
  metadata: Record<string, unknown> | null
  status: "NEW" | "PROCESSING" | "READY" | "USED" | "ARCHIVED"
  filePath: string | null
  messageId: string | null
  createdAt: string
  updatedAt: string
}

const STATUS_CONFIG: Record<
  Source["status"],
  { label: string; className: string }
> = {
  NEW: {
    label: "Neu",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  PROCESSING: {
    label: "Verarbeitung",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  READY: {
    label: "Bereit",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  USED: {
    label: "Verwendet",
    className: "bg-purple-100 text-purple-800 border-purple-200",
  },
  ARCHIVED: {
    label: "Archiviert",
    className: "bg-gray-100 text-gray-800 border-gray-200",
  },
}

const TYPE_LABELS: Record<Source["type"], string> = {
  NEWSLETTER: "Newsletter",
  PDF_UPLOAD: "PDF-Upload",
  MANUAL_TEXT: "Manueller Text",
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function SourceDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const { toast } = useToast()

  const [source, setSource] = useState<Source | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState("")
  const [savingSummary, setSavingSummary] = useState(false)

  const [archiving, setArchiving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchSource = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/sources/${params.id}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError("Quelle nicht gefunden.")
        } else {
          setError("Fehler beim Laden der Quelle.")
        }
        return
      }
      const data: Source = await res.json()
      setSource(data)
    } catch {
      setError("Netzwerkfehler beim Laden der Quelle.")
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchSource()
  }, [fetchSource])

  const handleSaveSummary = async () => {
    if (!source) return
    setSavingSummary(true)
    try {
      const res = await fetch(`/api/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: summaryDraft }),
      })
      if (!res.ok) {
        toast({
          title: "Fehler",
          description: "Zusammenfassung konnte nicht gespeichert werden.",
          variant: "destructive",
        })
        return
      }
      const updated: Source = await res.json()
      setSource(updated)
      setEditingSummary(false)
      toast({
        title: "Gespeichert",
        description: "Zusammenfassung wurde aktualisiert.",
      })
    } catch {
      toast({
        title: "Fehler",
        description: "Netzwerkfehler beim Speichern.",
        variant: "destructive",
      })
    } finally {
      setSavingSummary(false)
    }
  }

  const handleArchive = async () => {
    if (!source) return
    setArchiving(true)
    try {
      const res = await fetch(`/api/sources/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      })
      if (!res.ok) {
        toast({
          title: "Fehler",
          description: "Quelle konnte nicht archiviert werden.",
          variant: "destructive",
        })
        return
      }
      const updated: Source = await res.json()
      setSource(updated)
      toast({
        title: "Archiviert",
        description: "Quelle wurde archiviert.",
      })
    } catch {
      toast({
        title: "Fehler",
        description: "Netzwerkfehler beim Archivieren.",
        variant: "destructive",
      })
    } finally {
      setArchiving(false)
    }
  }

  const handleDelete = async () => {
    if (!source) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/sources/${source.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        toast({
          title: "Fehler",
          description: "Quelle konnte nicht geloescht werden.",
          variant: "destructive",
        })
        setDeleting(false)
        setDeleteDialogOpen(false)
        return
      }
      toast({
        title: "Geloescht",
        description: "Quelle wurde erfolgreich geloescht.",
      })
      router.push("/sources")
    } catch {
      toast({
        title: "Fehler",
        description: "Netzwerkfehler beim Loeschen.",
        variant: "destructive",
      })
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Quelle wird geladen...</span>
      </div>
    )
  }

  if (error || !source) {
    return (
      <div className="space-y-4 p-6">
        <Link
          href="/sources"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Zurueck zu Quellen
        </Link>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error || "Quelle nicht gefunden."}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[source.status]

  return (
    <div className="space-y-6 p-6">
      {/* Back link */}
      <Link
        href="/sources"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Zurueck zu Quellen
      </Link>

      {/* Header with title, status, actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{source.title}</h1>
          <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
        </div>
        <div className="flex gap-2">
          {source.status !== "ARCHIVED" && (
            <Button
              variant="outline"
              onClick={handleArchive}
              disabled={archiving}
            >
              {archiving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Archive className="mr-2 h-4 w-4" />
              )}
              Archivieren
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Loeschen
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Metadaten</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Absender
              </dt>
              <dd className="mt-1 text-sm">
                {source.senderName || "---"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                E-Mail
              </dt>
              <dd className="mt-1 text-sm">
                {source.senderEmail || "---"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Empfangen am
              </dt>
              <dd className="mt-1 text-sm">
                {formatDate(source.receivedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Typ
              </dt>
              <dd className="mt-1 text-sm">
                {TYPE_LABELS[source.type]}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Erstellt am
              </dt>
              <dd className="mt-1 text-sm">
                {formatDate(source.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Status
              </dt>
              <dd className="mt-1">
                <Badge className={statusConfig.className}>
                  {statusConfig.label}
                </Badge>
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Summary (editable) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Zusammenfassung</CardTitle>
            {!editingSummary && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSummaryDraft(source.summary || "")
                  setEditingSummary(true)
                }}
              >
                <Pencil className="mr-1 h-4 w-4" />
                Bearbeiten
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingSummary ? (
            <div className="space-y-3">
              <Textarea
                value={summaryDraft}
                onChange={(e) => setSummaryDraft(e.target.value)}
                rows={6}
                placeholder="Zusammenfassung eingeben..."
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveSummary}
                  disabled={savingSummary}
                >
                  {savingSummary ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-4 w-4" />
                  )}
                  Speichern
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingSummary(false)}
                  disabled={savingSummary}
                >
                  <X className="mr-1 h-4 w-4" />
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {source.summary || (
                <span className="text-muted-foreground italic">
                  Keine Zusammenfassung vorhanden.
                </span>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Full text content */}
      <Card>
        <CardHeader>
          <CardTitle>Volltext</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-y-auto rounded-md border bg-muted/50 p-4">
            <pre className="text-sm whitespace-pre-wrap break-words font-sans">
              {source.plainText}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quelle loeschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie die Quelle &quot;{source.title}&quot;
              endgueltig loeschen moechten? Diese Aktion kann nicht
              rueckgaengig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Endgueltig loeschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
