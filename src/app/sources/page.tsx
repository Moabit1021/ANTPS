"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/use-toast"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SourceType = "NEWSLETTER" | "PDF_UPLOAD" | "MANUAL_TEXT"
type SourceStatus = "NEW" | "PROCESSING" | "READY" | "USED" | "ARCHIVED"

interface Source {
  id: string
  type: SourceType
  title: string
  senderEmail: string | null
  senderName: string | null
  receivedAt: string
  summary: string | null
  status: SourceStatus
}

interface SourcesResponse {
  sources: Source[]
  total: number
  page: number
  limit: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<SourceType, string> = {
  NEWSLETTER: "Newsletter",
  PDF_UPLOAD: "PDF",
  MANUAL_TEXT: "Manuell",
}

const STATUS_LABELS: Record<SourceStatus, string> = {
  NEW: "Neu",
  PROCESSING: "Verarbeitung",
  READY: "Bereit",
  USED: "Verwendet",
  ARCHIVED: "Archiviert",
}

function typeBadgeVariant(type: SourceType) {
  switch (type) {
    case "NEWSLETTER":
      return "default" as const
    case "PDF_UPLOAD":
      return "secondary" as const
    case "MANUAL_TEXT":
      return "outline" as const
  }
}

function statusBadgeProps(status: SourceStatus) {
  switch (status) {
    case "NEW":
      return { variant: "default" as const, className: "" }
    case "PROCESSING":
      return { variant: "secondary" as const, className: "" }
    case "READY":
      return { variant: "outline" as const, className: "bg-green-100 text-green-800 border-green-200" }
    case "USED":
      return { variant: "outline" as const, className: "bg-blue-100 text-blue-800 border-blue-200" }
    case "ARCHIVED":
      return { variant: "outline" as const, className: "bg-gray-100 text-gray-800 border-gray-200" }
  }
}

function truncate(text: string | null, maxLen = 80): string {
  if (!text) return "—"
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + "…"
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function senderDisplay(source: Source): string {
  if (source.senderName) return source.senderName
  if (source.senderEmail) return source.senderEmail
  return "—"
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SourcesPage() {
  // Data
  const [sources, setSources] = useState<Source[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterType, setFilterType] = useState<string>("ALL")
  const [filterStatus, setFilterStatus] = useState<string>("ALL")

  // Sort & pagination
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [textDialogOpen, setTextDialogOpen] = useState(false)

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState("")
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Text form state
  const [manualTitle, setManualTitle] = useState("")
  const [manualText, setManualText] = useState("")
  const [submittingText, setSubmittingText] = useState(false)

  // Computed
  const totalPages = Math.max(1, Math.ceil(total / limit))

  // -------------------------------------------------------------------------
  // Fetch sources
  // -------------------------------------------------------------------------

  const fetchSources = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", String(limit))
      params.set("sort", sortDir)
      if (filterType !== "ALL") params.set("type", filterType)
      if (filterStatus !== "ALL") params.set("status", filterStatus)

      const res = await fetch(`/api/sources?${params.toString()}`)
      if (!res.ok) throw new Error("Fehler beim Laden der Quellen")

      const data: SourcesResponse = await res.json()
      setSources(data.sources)
      setTotal(data.total)
    } catch {
      toast({ title: "Fehler", description: "Quellen konnten nicht geladen werden.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [page, limit, sortDir, filterType, filterStatus])

  useEffect(() => {
    fetchSources()
  }, [fetchSources])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [filterType, filterStatus])

  // Clear selection when data changes
  useEffect(() => {
    setSelectedIds(new Set())
  }, [sources])

  // -------------------------------------------------------------------------
  // Selection helpers
  // -------------------------------------------------------------------------

  const allSelected = sources.length > 0 && sources.every((s) => selectedIds.has(s.id))

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sources.map((s) => s.id)))
    }
  }, [allSelected, sources])

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // -------------------------------------------------------------------------
  // Upload PDF
  // -------------------------------------------------------------------------

  const handleUpload = useCallback(async () => {
    if (!uploadFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", uploadFile)
      if (uploadTitle.trim()) formData.append("title", uploadTitle.trim())

      const res = await fetch("/api/sources/upload", { method: "POST", body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Upload fehlgeschlagen")
      }

      toast({ title: "Erfolg", description: "PDF wurde hochgeladen." })
      setUploadDialogOpen(false)
      setUploadFile(null)
      setUploadTitle("")
      fetchSources()
    } catch (e) {
      toast({
        title: "Fehler",
        description: e instanceof Error ? e.message : "Upload fehlgeschlagen.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }, [uploadFile, uploadTitle, fetchSources])

  // -------------------------------------------------------------------------
  // Add manual text
  // -------------------------------------------------------------------------

  const handleAddText = useCallback(async () => {
    if (!manualTitle.trim() || !manualText.trim()) return
    setSubmittingText(true)
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "MANUAL_TEXT",
          title: manualTitle.trim(),
          rawContent: manualText.trim(),
          plainText: manualText.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Fehler beim Speichern")
      }

      toast({ title: "Erfolg", description: "Text wurde hinzugefügt." })
      setTextDialogOpen(false)
      setManualTitle("")
      setManualText("")
      fetchSources()
    } catch (e) {
      toast({
        title: "Fehler",
        description: e instanceof Error ? e.message : "Text konnte nicht gespeichert werden.",
        variant: "destructive",
      })
    } finally {
      setSubmittingText(false)
    }
  }, [manualTitle, manualText, fetchSources])

  // -------------------------------------------------------------------------
  // Drag & drop handlers
  // -------------------------------------------------------------------------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type === "application/pdf") {
      setUploadFile(file)
    } else {
      toast({ title: "Fehler", description: "Nur PDF-Dateien sind erlaubt.", variant: "destructive" })
    }
  }, [])

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quellen</h1>
          <p className="text-muted-foreground">
            {total} Quelle{total !== 1 ? "n" : ""} insgesamt
          </p>
        </div>
        <div className="flex gap-2">
          {/* PDF upload dialog */}
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">PDF hochladen</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>PDF hochladen</DialogTitle>
                <DialogDescription>
                  Laden Sie eine PDF-Datei hoch, um sie als Quelle hinzuzufügen.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="upload-title">Titel (optional)</Label>
                  <Input
                    id="upload-title"
                    placeholder="Titel der Quelle"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                  />
                </div>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : uploadFile
                        ? "border-green-400 bg-green-50"
                        : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setUploadFile(file)
                    }}
                  />
                  {uploadFile ? (
                    <div className="space-y-1">
                      <p className="font-medium">{uploadFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          setUploadFile(null)
                          if (fileInputRef.current) fileInputRef.current.value = ""
                        }}
                      >
                        Datei entfernen
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-medium">PDF-Datei hierher ziehen</p>
                      <p className="text-sm text-muted-foreground">oder klicken zum Auswählen</p>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setUploadDialogOpen(false)
                    setUploadFile(null)
                    setUploadTitle("")
                  }}
                >
                  Abbrechen
                </Button>
                <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
                  {uploading ? "Wird hochgeladen…" : "Hochladen"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Manual text dialog */}
          <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
            <DialogTrigger asChild>
              <Button>Text hinzufügen</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Text hinzufügen</DialogTitle>
                <DialogDescription>
                  Fügen Sie manuell einen Text als Quelle hinzu.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-title">Titel</Label>
                  <Input
                    id="manual-title"
                    placeholder="Titel der Quelle"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-text">Inhalt</Label>
                  <Textarea
                    id="manual-text"
                    placeholder="Textinhalt eingeben…"
                    rows={8}
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTextDialogOpen(false)
                    setManualTitle("")
                    setManualText("")
                  }}
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={handleAddText}
                  disabled={!manualTitle.trim() || !manualText.trim() || submittingText}
                >
                  {submittingText ? "Wird gespeichert…" : "Speichern"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium whitespace-nowrap">Typ:</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle</SelectItem>
                <SelectItem value="NEWSLETTER">Newsletter</SelectItem>
                <SelectItem value="PDF_UPLOAD">PDF</SelectItem>
                <SelectItem value="MANUAL_TEXT">Manuell</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-sm font-medium whitespace-nowrap">Status:</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Alle</SelectItem>
                <SelectItem value="NEW">Neu</SelectItem>
                <SelectItem value="PROCESSING">Verarbeitung</SelectItem>
                <SelectItem value="READY">Bereit</SelectItem>
                <SelectItem value="USED">Verwendet</SelectItem>
                <SelectItem value="ARCHIVED">Archiviert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
          >
            Datum: {sortDir === "desc" ? "Neueste zuerst" : "Älteste zuerst"}
          </Button>

          {selectedIds.size > 0 && (
            <div className="ml-auto">
              <Button asChild>
                <Link
                  href={`/scripts/new?sources=${Array.from(selectedIds).join(",")}`}
                >
                  Skript aus Auswahl erstellen ({selectedIds.size})
                </Link>
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Alle auswählen"
                />
              </TableHead>
              <TableHead className="w-[140px]">Datum</TableHead>
              <TableHead className="w-[140px]">Absender</TableHead>
              <TableHead>Titel</TableHead>
              <TableHead className="w-[100px]">Typ</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead>Zusammenfassung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Quellen werden geladen…
                </TableCell>
              </TableRow>
            ) : sources.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Keine Quellen gefunden.
                </TableCell>
              </TableRow>
            ) : (
              sources.map((source) => {
                const isSelected = selectedIds.has(source.id)
                const sBadge = statusBadgeProps(source.status)
                return (
                  <TableRow key={source.id} data-state={isSelected ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(source.id)}
                        aria-label={`${source.title} auswählen`}
                      />
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(source.receivedAt)}
                    </TableCell>
                    <TableCell className="text-sm">{senderDisplay(source)}</TableCell>
                    <TableCell className="font-medium">{source.title}</TableCell>
                    <TableCell>
                      <Badge variant={typeBadgeVariant(source.type)}>
                        {TYPE_LABELS[source.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={sBadge.variant} className={sBadge.className}>
                        {STATUS_LABELS[source.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {truncate(source.summary)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {!loading && totalPages > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Zeilen pro Seite:</span>
            <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1) }}>
              <SelectTrigger className="w-[80px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Seite {page} von {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
