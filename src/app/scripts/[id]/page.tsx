"use client"

import { use, useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Pencil, Save, X, Trash2, Loader2, Copy, Check, RefreshCw, History, Volume2 } from "lucide-react"

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

interface ScriptSource {
  source: { id: string; title: string; type: string }
}

interface VersionInfo {
  id: string
  version: number
  status: string
  createdAt: string
  config: { revisionInstructions?: string } | null
}

interface Script {
  id: string
  title: string
  content: string
  version: number
  parentId: string | null
  status: string
  modelUsed: string | null
  promptTokens: number | null
  outputTokens: number | null
  createdAt: string
  updatedAt: string
  sources: ScriptSource[]
  versions: VersionInfo[]
}

const STATUS_LABELS: Record<string, string> = {
  GENERATING: "Wird generiert",
  DRAFT: "Entwurf",
  REVISING: "Ueberarbeitet",
  APPROVED: "Freigegeben",
  AUDIO_PENDING: "Audio ausstehend",
  COMPLETED: "Abgeschlossen",
}

function statusClass(status: string): string {
  switch (status) {
    case "GENERATING": return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "DRAFT": return "bg-blue-100 text-blue-800 border-blue-200"
    case "REVISING": return "bg-orange-100 text-orange-800 border-orange-200"
    case "APPROVED": return "bg-green-100 text-green-800 border-green-200"
    default: return ""
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function ScriptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()

  const [script, setScript] = useState<Script | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [saving, setSaving] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Revision state
  const [revisionInstructions, setRevisionInstructions] = useState("")
  const [revising, setRevising] = useState(false)

  // Audio generation state
  const [generatingAudio, setGeneratingAudio] = useState(false)

  const fetchScript = useCallback(async (scriptId: string) => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/scripts/${scriptId}`)
      if (!res.ok) {
        setError(res.status === 404 ? "Skript nicht gefunden." : "Fehler beim Laden.")
        return
      }
      const data: Script = await res.json()
      setScript(data)
    } catch {
      setError("Netzwerkfehler.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchScript(id) }, [fetchScript, id])

  const handleSave = async () => {
    if (!script) return
    setSaving(true)
    try {
      const res = await fetch(`/api/scripts/${script.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setScript(updated)
      setEditing(false)
      toast({ title: "Gespeichert", description: "Skript wurde aktualisiert." })
    } catch {
      toast({ title: "Fehler", description: "Speichern fehlgeschlagen.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    if (!script) return
    try {
      const res = await fetch(`/api/scripts/${script.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setScript(updated)
      toast({ title: "Freigegeben", description: "Skript wurde freigegeben." })
    } catch {
      toast({ title: "Fehler", description: "Freigabe fehlgeschlagen.", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!script) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/scripts/${script.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast({ title: "Geloescht", description: "Skript wurde geloescht." })
      router.push("/scripts")
    } catch {
      toast({ title: "Fehler", description: "Loeschen fehlgeschlagen.", variant: "destructive" })
      setDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const handleCopy = async () => {
    if (!script) return
    await navigator.clipboard.writeText(script.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRevise = async () => {
    if (!script || !revisionInstructions.trim()) return
    setRevising(true)
    try {
      const res = await fetch(`/api/scripts/${script.id}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: revisionInstructions }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({
          title: "Fehler",
          description: data.error || "Ueberarbeitung fehlgeschlagen.",
          variant: "destructive",
        })
        return
      }

      toast({ title: "Erfolg", description: "Skript wurde ueberarbeitet!" })
      setRevisionInstructions("")
      // Navigate to the new version
      router.push(`/scripts/${data.id}`)
      fetchScript(data.id)
    } catch {
      toast({ title: "Fehler", description: "Netzwerkfehler bei der Ueberarbeitung.", variant: "destructive" })
    } finally {
      setRevising(false)
    }
  }

  const handleGenerateAudio = async () => {
    if (!script) return
    setGeneratingAudio(true)
    try {
      const res = await fetch("/api/audio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptId: script.id }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({
          title: "Fehler",
          description: data.error || "Audio-Generierung fehlgeschlagen.",
          variant: "destructive",
        })
        return
      }

      toast({ title: "Erfolg", description: "Audio wurde generiert!" })
      // Refresh script to get updated status
      fetchScript(script.id)
      // Navigate to audio page
      router.push("/audio")
    } catch {
      toast({ title: "Fehler", description: "Netzwerkfehler bei der Audio-Generierung.", variant: "destructive" })
    } finally {
      setGeneratingAudio(false)
    }
  }

  const switchToVersion = (versionId: string) => {
    router.push(`/scripts/${versionId}`)
    fetchScript(versionId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !script) {
    return (
      <div className="space-y-4 p-6">
        <Link href="/scripts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Zurueck zu Skripte
        </Link>
        <Card><CardContent className="pt-6"><p className="text-destructive">{error}</p></CardContent></Card>
      </div>
    )
  }

  const versions = script.versions || []
  const hasMultipleVersions = versions.length > 1

  return (
    <div className="space-y-6 p-6">
      <Link href="/scripts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Zurueck zu Skripte
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{script.title}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={statusClass(script.status)}>
              {STATUS_LABELS[script.status] || script.status}
            </Badge>
            <Badge variant="secondary">Version {script.version}</Badge>
            {script.modelUsed && (
              <span className="text-sm text-muted-foreground">{script.modelUsed}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!editing && (script.status === "DRAFT" || script.status === "APPROVED") && (
            <Button
              onClick={handleGenerateAudio}
              disabled={generatingAudio}
            >
              {generatingAudio ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Volume2 className="mr-2 h-4 w-4" />
              )}
              {generatingAudio ? "Audio wird generiert..." : "Audio generieren"}
            </Button>
          )}
          {!editing && (script.status === "DRAFT" || script.status === "REVISING") && (
            <Button variant="outline" onClick={handleApprove}>Freigeben</Button>
          )}
          {!editing && (
            <Button
              variant="outline"
              onClick={() => {
                setEditTitle(script.title)
                setEditContent(script.content)
                setEditing(true)
              }}
            >
              <Pencil className="mr-2 h-4 w-4" /> Bearbeiten
            </Button>
          )}
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Loeschen
          </Button>
        </div>
      </div>

      {/* Meta info */}
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Erstellt am</dt>
              <dd className="mt-1 text-sm">{formatDate(script.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Quellen</dt>
              <dd className="mt-1 text-sm">
                {script.sources.map((s) => s.source.title).join(", ") || "—"}
              </dd>
            </div>
            {script.promptTokens != null && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Prompt-Tokens</dt>
                <dd className="mt-1 text-sm">{script.promptTokens.toLocaleString("de-DE")}</dd>
              </div>
            )}
            {script.outputTokens != null && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Output-Tokens</dt>
                <dd className="mt-1 text-sm">{script.outputTokens.toLocaleString("de-DE")}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Version history */}
      {hasMultipleVersions && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Versionen
            </CardTitle>
            <CardDescription>
              Klicken Sie auf eine Version, um zu dieser zurueckzukehren.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {versions.map((v) => {
                const isCurrent = v.id === script.id
                const revInstr = (v.config as { revisionInstructions?: string } | null)?.revisionInstructions
                return (
                  <button
                    key={v.id}
                    onClick={() => !isCurrent && switchToVersion(v.id)}
                    className={`relative flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                      isCurrent
                        ? "border-primary bg-primary/5 ring-2 ring-primary"
                        : "hover:bg-muted/50 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">V{v.version}</span>
                      <Badge variant="outline" className={`text-xs ${statusClass(v.status)}`}>
                        {STATUS_LABELS[v.status] || v.status}
                      </Badge>
                      {isCurrent && (
                        <Badge variant="default" className="text-xs">Aktuell</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(v.createdAt)}
                    </span>
                    {revInstr && (
                      <span className="text-xs text-muted-foreground italic line-clamp-1 max-w-[200px]">
                        &quot;{revInstr}&quot;
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Script content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Skript-Inhalt</CardTitle>
            {!editing && (
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                {copied ? "Kopiert" : "Kopieren"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Titel</label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={20}
                className="font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                  Speichern
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                  <X className="mr-1 h-4 w-4" /> Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto rounded-md border bg-muted/50 p-4">
              <pre className="text-sm whitespace-pre-wrap break-words font-sans">
                {script.content || "Kein Inhalt vorhanden."}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revision section */}
      {!editing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Skript ueberarbeiten
            </CardTitle>
            <CardDescription>
              Geben Sie Anweisungen ein, wie das Skript ueberarbeitet werden soll. Eine neue Version wird erstellt, die alte bleibt erhalten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="z.B. 'Mache die Einleitung kuerzer und fuege mehr Details zum Thema Digitalisierung hinzu' oder 'Aendere den Ton zu formeller' oder 'Fuege einen Abschnitt ueber KI hinzu'..."
              value={revisionInstructions}
              onChange={(e) => setRevisionInstructions(e.target.value)}
              rows={4}
              disabled={revising}
            />
            <div className="flex items-center gap-4">
              <Button
                onClick={handleRevise}
                disabled={revising || !revisionInstructions.trim()}
              >
                {revising ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird ueberarbeitet...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Ueberarbeiten
                  </>
                )}
              </Button>
              {revising && (
                <span className="text-sm text-muted-foreground">
                  Das KI-Modell ueberarbeitet das Skript. Dies kann bis zu einer Minute dauern.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skript loeschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie &quot;{script.title}&quot; endgueltig loeschen moechten?
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
