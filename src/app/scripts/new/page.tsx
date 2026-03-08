"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react"

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { toast } from "@/components/ui/use-toast"

interface Source {
  id: string
  type: string
  title: string
  status: string
  receivedAt: string
  summary: string | null
}

interface PromptConfig {
  systemPrompt: string
  userTemplate: string
  voiceName1: string
  voiceName2: string
  speakerModeMonolog: string
  speakerModeDialog: string
}

function resolvePromptPreview(
  template: string,
  vars: {
    speakers: number
    duration: number
    date: string
    voiceName1: string
    voiceName2: string
    speakerModeMonolog: string
    speakerModeDialog: string
  }
): string {
  const speakerMode = vars.speakers === 1
    ? vars.speakerModeMonolog
        .replace(/\{\{voice_name_1\}\}/g, vars.voiceName1)
    : vars.speakerModeDialog
        .replace(/\{\{voice_name_1\}\}/g, vars.voiceName1)
        .replace(/\{\{voice_name_2\}\}/g, vars.voiceName2)

  return template
    .replace(/\{\{speaker_mode\}\}/g, speakerMode)
    .replace(/\{\{duration\}\}/g, String(vars.duration))
    .replace(/\{\{date\}\}/g, vars.date)
    .replace(/\{\{voice_name_1\}\}/g, vars.voiceName1)
    .replace(/\{\{voice_name_2\}\}/g, vars.voiceName2)
}

function NewScriptContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState("")
  const [generating, setGenerating] = useState(false)

  // Config options
  const [speakers, setSpeakers] = useState("2")
  const [duration, setDuration] = useState("10")

  // Prompt state
  const [promptConfig, setPromptConfig] = useState<PromptConfig | null>(null)
  const [systemPrompt, setSystemPrompt] = useState("")
  const [userTemplate, setUserTemplate] = useState("")
  const [promptExpanded, setPromptExpanded] = useState(false)
  const [promptEdited, setPromptEdited] = useState(false)

  const todayDate = new Date().toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })

  // Pre-select sources from URL params
  useEffect(() => {
    const sourcesParam = searchParams.get("sources")
    if (sourcesParam) {
      setSelectedIds(new Set(sourcesParam.split(",")))
    }
  }, [searchParams])

  // Fetch sources and prompts in parallel
  const fetchData = useCallback(async () => {
    try {
      const [sourcesRes, promptsRes] = await Promise.all([
        fetch("/api/sources?limit=100&sort=desc"),
        fetch("/api/prompts"),
      ])

      if (sourcesRes.ok) {
        const data = await sourcesRes.json()
        setSources(data.sources)
      }

      if (promptsRes.ok) {
        const data: PromptConfig = await promptsRes.json()
        setPromptConfig(data)
        // Resolve with default values initially
        setSystemPrompt(resolvePromptPreview(data.systemPrompt, {
          speakers: 2,
          duration: 10,
          date: new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }),
          voiceName1: data.voiceName1,
          voiceName2: data.voiceName2,
          speakerModeMonolog: data.speakerModeMonolog,
          speakerModeDialog: data.speakerModeDialog,
        }))
        setUserTemplate(data.userTemplate)
      }
    } catch {
      toast({ title: "Fehler", description: "Daten konnten nicht geladen werden.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Re-resolve prompt when speakers or duration change (only if not manually edited)
  useEffect(() => {
    if (!promptConfig || promptEdited) return
    setSystemPrompt(resolvePromptPreview(promptConfig.systemPrompt, {
      speakers: parseInt(speakers),
      duration: parseInt(duration),
      date: todayDate,
      voiceName1: promptConfig.voiceName1,
      voiceName2: promptConfig.voiceName2,
      speakerModeMonolog: promptConfig.speakerModeMonolog,
      speakerModeDialog: promptConfig.speakerModeDialog,
    }))
  }, [speakers, duration, promptConfig, promptEdited, todayDate])

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
          speakers: parseInt(speakers),
          duration: parseInt(duration),
          systemPrompt: promptEdited ? systemPrompt : undefined,
          userTemplate: promptEdited ? userTemplate : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({
          title: "Fehler",
          description: data.error || "Skript-Generierung fehlgeschlagen.",
          variant: "destructive",
        })
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

  const resetPrompt = () => {
    if (!promptConfig) return
    setPromptEdited(false)
    setSystemPrompt(resolvePromptPreview(promptConfig.systemPrompt, {
      speakers: parseInt(speakers),
      duration: parseInt(duration),
      date: todayDate,
      voiceName1: promptConfig.voiceName1,
      voiceName2: promptConfig.voiceName2,
      speakerModeMonolog: promptConfig.speakerModeMonolog,
      speakerModeDialog: promptConfig.speakerModeDialog,
    }))
    setUserTemplate(promptConfig.userTemplate)
  }

  // Filter to only show usable sources
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
          Konfigurieren Sie die Einstellungen und waehlen Sie Quellen aus.
        </p>
      </div>

      {/* Title */}
      <Card>
        <CardHeader>
          <CardTitle>Skript-Titel</CardTitle>
          <CardDescription>
            Leer lassen, um einen KI-generierten Titel zu verwenden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`z.B. Podcast vom ${todayDate} (wird automatisch vorgeschlagen)`}
          />
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Konfiguration</CardTitle>
          <CardDescription>
            Format und Laenge des Podcast-Skripts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sprecher</label>
              <Select value={speakers} onValueChange={setSpeakers}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Sprecher (Monolog)</SelectItem>
                  <SelectItem value="2">2 Sprecher (Dialog)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Laenge</label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">ca. 5 Minuten</SelectItem>
                  <SelectItem value="10">ca. 10 Minuten</SelectItem>
                  <SelectItem value="15">ca. 15 Minuten</SelectItem>
                  <SelectItem value="20">ca. 20 Minuten</SelectItem>
                  <SelectItem value="30">ca. 30 Minuten</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Quellen auswaehlen</CardTitle>
          <CardDescription>
            Waehlen Sie die Quellen, aus denen das Skript erstellt werden soll.
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
              Keine verfuegbaren Quellen. Laden Sie zuerst Dokumente hoch oder fuegen Sie Text hinzu.
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

      {/* Prompt */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setPromptExpanded(!promptExpanded)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                KI-Prompt
                {promptEdited && (
                  <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-200">
                    Angepasst
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                System-Prompt und Benutzer-Prompt fuer die Skript-Generierung.
              </CardDescription>
            </div>
            {promptExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {promptExpanded && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">System-Prompt</label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => {
                  setSystemPrompt(e.target.value)
                  setPromptEdited(true)
                }}
                rows={16}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Benutzer-Prompt</label>
              <p className="text-xs text-muted-foreground">
                Der Platzhalter {"{{sources}}"} wird durch die ausgewaehlten Quellen ersetzt.
              </p>
              <Textarea
                value={userTemplate}
                onChange={(e) => {
                  setUserTemplate(e.target.value)
                  setPromptEdited(true)
                }}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
            {promptEdited && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={resetPrompt}>
                  Auf Standard zuruecksetzen
                </Button>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Generate button */}
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
