"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Trash2, GitBranch } from "lucide-react"

type ScriptStatus = "GENERATING" | "DRAFT" | "REVISING" | "APPROVED" | "AUDIO_PENDING" | "COMPLETED"

interface Script {
  id: string
  title: string
  status: ScriptStatus
  modelUsed: string | null
  createdAt: string
  updatedAt: string
  sources: { source: { id: string; title: string; type: string } }[]
  versionCount: number
  latestVersionId: string
  latestVersion: number
  latestStatus: ScriptStatus
  latestDate: string
}

const STATUS_LABELS: Record<ScriptStatus, string> = {
  GENERATING: "Wird generiert",
  DRAFT: "Entwurf",
  REVISING: "Ueberarbeitung",
  APPROVED: "Freigegeben",
  AUDIO_PENDING: "Audio ausstehend",
  COMPLETED: "Abgeschlossen",
}

function statusBadgeClass(status: ScriptStatus): string {
  switch (status) {
    case "GENERATING": return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "DRAFT": return "bg-blue-100 text-blue-800 border-blue-200"
    case "REVISING": return "bg-orange-100 text-orange-800 border-orange-200"
    case "APPROVED": return "bg-green-100 text-green-800 border-green-200"
    case "AUDIO_PENDING": return "bg-purple-100 text-purple-800 border-purple-200"
    case "COMPLETED": return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })
}

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<Script[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [page, setPage] = useState(1)
  const limit = 20
  const totalPages = Math.max(1, Math.ceil(total / limit))

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingScript, setDeletingScript] = useState<Script | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchScripts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", String(limit))
      if (filterStatus !== "ALL") params.set("status", filterStatus)

      const res = await fetch(`/api/scripts?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setScripts(data.scripts)
      setTotal(data.total)
    } catch {
      toast({ title: "Fehler", description: "Skripte konnten nicht geladen werden.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [page, filterStatus])

  useEffect(() => { fetchScripts() }, [fetchScripts])
  useEffect(() => { setPage(1) }, [filterStatus])

  const handleDelete = async () => {
    if (!deletingScript) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/scripts/${deletingScript.id}?mode=all`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast({ title: "Geloescht", description: "Skript und alle Versionen wurden geloescht." })
      setDeleteDialogOpen(false)
      setDeletingScript(null)
      fetchScripts()
    } catch {
      toast({ title: "Fehler", description: "Loeschen fehlgeschlagen.", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Skripte</h1>
          <p className="text-muted-foreground">
            {total} Skript{total !== 1 ? "e" : ""} insgesamt
          </p>
        </div>
        <Button asChild>
          <Link href="/scripts/new">Neues Skript erstellen</Link>
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Label className="text-sm font-medium whitespace-nowrap">Status:</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Alle</SelectItem>
              <SelectItem value="DRAFT">Entwurf</SelectItem>
              <SelectItem value="APPROVED">Freigegeben</SelectItem>
              <SelectItem value="COMPLETED">Abgeschlossen</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titel</TableHead>
              <TableHead className="w-[100px]">Versionen</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[120px]">Erstellt</TableHead>
              <TableHead className="w-[120px]">Letzte Aenderung</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : scripts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Keine Skripte vorhanden. Erstellen Sie ein neues Skript aus Ihren Quellen.
                </TableCell>
              </TableRow>
            ) : (
              scripts.map((script) => (
                <TableRow key={script.id}>
                  <TableCell>
                    <Link
                      href={`/scripts/${script.latestVersionId}`}
                      className="font-medium hover:underline"
                    >
                      {script.title}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {script.sources.map((s) => s.source.title).join(", ") || "Keine Quellen"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {script.versionCount > 1 ? (
                      <div className="flex items-center gap-1 text-sm">
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{script.versionCount}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">1</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadgeClass(script.latestStatus)}>
                      {STATUS_LABELS[script.latestStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatShortDate(script.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatShortDate(script.latestDate)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        setDeletingScript(script)
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">
            Seite {page} von {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Zurueck
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Weiter
          </Button>
        </div>
      )}

      {/* Delete dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skript loeschen</DialogTitle>
            <DialogDescription>
              Sind Sie sicher, dass Sie &quot;{deletingScript?.title}&quot; und alle {deletingScript?.versionCount ?? 1} Version{(deletingScript?.versionCount ?? 1) !== 1 ? "en" : ""} endgueltig loeschen moechten?
              {(deletingScript?.versionCount ?? 1) > 1 && " Alle Versionen, zugehoerige Audio-Dateien und Episoden werden ebenfalls geloescht."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Alles loeschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
