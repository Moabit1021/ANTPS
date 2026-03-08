"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Sparkles } from "lucide-react"

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/use-toast"

interface Source {
  id: string
  type: string
  title: string
  status: string
  receivedAt: string
  summary: string | null
}

function NewScriptContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState(
    `Podcast vom ${new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`
  )
  const [generating, setGenerating] = useState(false)

  // Pre-select sources from URL params
  useEffect(() => {
    const sourcesParam = searchParams.get("sources")
    if (sourcesParam) {
      setSelectedIds(new Set(sourcesParam.split(",")))
    }
  }, [searchParams])

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch("/api/sources?limit=100&sort=desc")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSources(data.sources)
    } catch {
      toast({ title: "Fehler", description: "Quellen konnten nicht geladen werden.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSources() }, [fetchSources])

  const toggleSource = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleGenerate = async () => {
    if (selectedIds.size === 0) {
      toast({ title: "Fehler", description: "Bitte waehlen Sie mindestens eine Quelle aus.", variant: "destructive" })
      return
    }

    setGenerating(true)
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceIds: Array.from(selectedIds),
          title: title.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({
          title: "Fehler",
          description: data.error || "Skript-Generierung fehlgeschlagen.",
          variant: "destructive",
        })
        // If a script was created despite the error, navigate to it
        if (data.scriptId) {
          router.push(`/scripts/${data.scriptId}`)
        }
        return
      }

      toast({ title: "Erfolg", description: "Skript wurde generiert!" })
      router.push(`/scripts/${data.id}`)
    } catch {
      toast({ title: "Fehler", description: "Netzwerkfehler bei der Generierung.", variant: "destructive" })
    } finally {
      setGenerating(false)
    }
  }

  // Filter to only show usable sources (NEW, READY)
  const availableSources = sources.filter(
    (s) => s.status === "NEW" || s.status === "READY" || selectedIds.has(s.id)
  )

  return (
    <div className="space-y-6">
      <Link
        href="/scripts"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Zurueck zu Skripte
      </Link>

      <div>
        <h1 className="text-3xl font-bold">Neues Skript erstellen</h1>
        <p className="text-muted-foreground">
          Waehlen Sie Quellen aus und lassen Sie ein Podcast-Skript generieren.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Skript-Titel</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titel des Podcast-Skripts"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quellen auswaehlen</CardTitle>
          <CardDescription>
            Waehlen Sie die Newsletter-Quellen, aus denen das Skript erstellt werden soll.
            {selectedIds.size > 0 && (
              <span className="ml-2 font-medium text-foreground">
                {selectedIds.size} ausgewaehlt
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : availableSources.length === 0 ? (
            <p className="text-muted-foreground py-4">
              Keine verfuegbaren Quellen. Laden Sie zuerst Newsletter als PDF hoch oder fuegen Sie Text hinzu.
            </p>
          ) : (
            <div className="space-y-2">
              {availableSources.map((source) => (
                <div
                  key={source.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedIds.has(source.id)
                      ? "bg-primary/5 border-primary"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleSource(source.id)}
                >
                  <Checkbox
                    checked={selectedIds.has(source.id)}
                    onCheckedChange={() => toggleSource(source.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{source.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {source.type === "PDF_UPLOAD" ? "PDF" : source.type === "NEWSLETTER" ? "Newsletter" : "Text"}
                      </Badge>
                    </div>
                    {source.summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {source.summary}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(source.receivedAt).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={generating || selectedIds.size === 0}
        >
          {generating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Skript wird generiert...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Skript generieren ({selectedIds.size} Quelle{selectedIds.size !== 1 ? "n" : ""})
            </>
          )}
        </Button>
      </div>

      {generating && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">Skript wird generiert...</p>
                <p className="text-sm text-yellow-700">
                  Das KI-Modell erstellt ein Podcast-Skript aus den ausgewaehlten Quellen.
                  Dies kann bis zu einer Minute dauern.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function NewScriptPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <NewScriptContent />
    </Suspense>
  )
}
