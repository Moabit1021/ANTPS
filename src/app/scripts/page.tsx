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
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"

type ScriptStatus = "GENERATING" | "DRAFT" | "REVISING" | "APPROVED" | "AUDIO_PENDING" | "COMPLETED"

interface Script {
  id: string
  title: string
  status: ScriptStatus
  modelUsed: string | null
  promptTokens: number | null
  outputTokens: number | null
  createdAt: string
  updatedAt: string
  sources: { source: { id: string; title: string; type: string } }[]
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
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
              <TableHead className="w-[140px]">Datum</TableHead>
              <TableHead>Titel</TableHead>
              <TableHead className="w-[100px]">Quellen</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[140px]">Modell</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : scripts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Keine Skripte vorhanden. Erstellen Sie ein neues Skript aus Ihren Quellen.
                </TableCell>
              </TableRow>
            ) : (
              scripts.map((script) => (
                <TableRow key={script.id}>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(script.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/scripts/${script.id}`}
                      className="hover:underline"
                    >
                      {script.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {script.sources.length}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadgeClass(script.status)}>
                      {STATUS_LABELS[script.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {script.modelUsed || "—"}
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
    </div>
  )
}
