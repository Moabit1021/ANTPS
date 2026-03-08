"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import { Loader2, Save, Eye, EyeOff, RefreshCw } from "lucide-react"

interface Settings {
  llm_provider: string
  llm_api_key: string
  llm_api_key_masked: string
  llm_api_key_set: string
  llm_model: string
  prompt_system: string
  prompt_user_template: string
  elevenlabs_api_key: string
  elevenlabs_api_key_masked: string
  elevenlabs_api_key_set: string
  elevenlabs_voice_id: string
  elevenlabs_model: string
}

interface VoiceInfo {
  voice_id: string
  name: string
  category: string
  labels: Record<string, string>
}

const MODEL_OPTIONS: Record<string, { label: string; models: { value: string; label: string }[] }> = {
  anthropic: {
    label: "Anthropic (Claude)",
    models: [
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
      { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    ],
  },
  openai: {
    label: "OpenAI (ChatGPT)",
    models: [
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    ],
  },
}

const ELEVENLABS_MODELS = [
  { value: "eleven_multilingual_v2", label: "Multilingual v2 (empfohlen)" },
  { value: "eleven_turbo_v2_5", label: "Turbo v2.5 (schneller)" },
  { value: "eleven_monolingual_v1", label: "Monolingual v1 (Englisch)" },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state - LLM
  const [provider, setProvider] = useState("anthropic")
  const [apiKey, setApiKey] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [model, setModel] = useState("claude-sonnet-4-20250514")
  const [systemPrompt, setSystemPrompt] = useState("")
  const [userTemplate, setUserTemplate] = useState("")

  // Form state - ElevenLabs
  const [elevenlabsKey, setElevenlabsKey] = useState("")
  const [showElevenlabsKey, setShowElevenlabsKey] = useState(false)
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState("")
  const [elevenlabsModel, setElevenlabsModel] = useState("eleven_multilingual_v2")
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [loadingVoices, setLoadingVoices] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings")
      if (!res.ok) throw new Error()
      const data: Settings = await res.json()
      setSettings(data)
      setProvider(data.llm_provider || "anthropic")
      setModel(data.llm_model || "claude-sonnet-4-20250514")
      setSystemPrompt(data.prompt_system || "")
      setUserTemplate(data.prompt_user_template || "")
      setElevenlabsVoiceId(data.elevenlabs_voice_id || "")
      setElevenlabsModel(data.elevenlabs_model || "eleven_multilingual_v2")
    } catch {
      toast({ title: "Fehler", description: "Einstellungen konnten nicht geladen werden.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider)
    const providerModels = MODEL_OPTIONS[newProvider]
    if (providerModels?.models.length) {
      setModel(providerModels.models[0].value)
    }
  }

  const loadVoices = async () => {
    setLoadingVoices(true)
    try {
      const res = await fetch("/api/elevenlabs/voices")
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Fehler beim Laden")
      }
      const data = await res.json()
      setVoices(data.voices || [])
      if (data.voices?.length > 0) {
        toast({ title: "Erfolg", description: `${data.voices.length} Stimmen geladen.` })
      }
    } catch (e) {
      toast({
        title: "Fehler",
        description: e instanceof Error ? e.message : "Stimmen konnten nicht geladen werden.",
        variant: "destructive",
      })
    } finally {
      setLoadingVoices(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: Record<string, string> = {
        llm_provider: provider,
        llm_model: model,
        prompt_system: systemPrompt,
        prompt_user_template: userTemplate,
        elevenlabs_voice_id: elevenlabsVoiceId,
        elevenlabs_model: elevenlabsModel,
      }
      if (apiKey) body.llm_api_key = apiKey
      if (elevenlabsKey) body.elevenlabs_api_key = elevenlabsKey

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()

      toast({ title: "Gespeichert", description: "Einstellungen wurden aktualisiert." })
      setApiKey("")
      setElevenlabsKey("")
      setShowApiKey(false)
      setShowElevenlabsKey(false)
      fetchSettings()
    } catch {
      toast({ title: "Fehler", description: "Einstellungen konnten nicht gespeichert werden.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const currentModels = MODEL_OPTIONS[provider]?.models || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground">Konfiguration fuer LLM-Anbindung, Prompts und Sprachsynthese</p>
      </div>

      <Tabs defaultValue="llm">
        <TabsList>
          <TabsTrigger value="llm">KI-Modell</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="tts">Sprachsynthese</TabsTrigger>
        </TabsList>

        {/* LLM Configuration Tab */}
        <TabsContent value="llm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>KI-Anbieter</CardTitle>
              <CardDescription>
                Waehlen Sie den KI-Anbieter und das Modell fuer die Skript-Generierung.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Anbieter</Label>
                <Select value={provider} onValueChange={handleProviderChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Modell</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentModels.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>API-Schluessel</Label>
                {settings?.llm_api_key_set === "true" && (
                  <p className="text-sm text-muted-foreground">
                    Aktuell gesetzt: {settings.llm_api_key_masked}
                  </p>
                )}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      placeholder={settings?.llm_api_key_set === "true" ? "Neuen Schluessel eingeben um zu aendern..." : "API-Schluessel eingeben..."}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {provider === "anthropic"
                    ? "Anthropic API-Schluessel beginnt mit sk-ant-..."
                    : "OpenAI API-Schluessel beginnt mit sk-..."}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Prompts Tab */}
        <TabsContent value="prompts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System-Prompt</CardTitle>
              <CardDescription>
                Der System-Prompt definiert die Rolle und das Verhalten des KI-Modells bei der Skript-Erstellung.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={14}
                className="font-mono text-sm"
                placeholder="System-Prompt eingeben..."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Benutzer-Prompt-Vorlage</CardTitle>
              <CardDescription>
                Die Vorlage fuer den Benutzer-Prompt. Verwenden Sie <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{{sources}}"}</code> als Platzhalter fuer die Newsletter-Inhalte.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={userTemplate}
                onChange={(e) => setUserTemplate(e.target.value)}
                rows={6}
                className="font-mono text-sm"
                placeholder="Benutzer-Prompt eingeben..."
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Der Platzhalter <code className="bg-muted px-1 py-0.5 rounded">{"{{sources}}"}</code> wird
                durch den formatierten Text aller ausgewaehlten Quellen ersetzt.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TTS Tab */}
        <TabsContent value="tts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ElevenLabs API</CardTitle>
              <CardDescription>
                API-Schluessel fuer die Sprachsynthese mit ElevenLabs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>ElevenLabs API-Schluessel</Label>
                {settings?.elevenlabs_api_key_set === "true" && (
                  <p className="text-sm text-muted-foreground">
                    Aktuell gesetzt: {settings.elevenlabs_api_key_masked}
                  </p>
                )}
                <div className="flex gap-2">
                  <Input
                    type={showElevenlabsKey ? "text" : "password"}
                    placeholder={settings?.elevenlabs_api_key_set === "true" ? "Neuen Schluessel eingeben um zu aendern..." : "API-Schluessel eingeben..."}
                    value={elevenlabsKey}
                    onChange={(e) => setElevenlabsKey(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    onClick={() => setShowElevenlabsKey(!showElevenlabsKey)}
                  >
                    {showElevenlabsKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stimme und Modell</CardTitle>
              <CardDescription>
                Waehlen Sie die Stimme und das Modell fuer die Audio-Generierung. Speichern Sie zuerst den API-Schluessel, dann laden Sie die verfuegbaren Stimmen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>ElevenLabs Modell</Label>
                <Select value={elevenlabsModel} onValueChange={setElevenlabsModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ELEVENLABS_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Stimme</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadVoices}
                    disabled={loadingVoices}
                  >
                    {loadingVoices ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3 w-3" />
                    )}
                    Stimmen laden
                  </Button>
                </div>

                {voices.length > 0 ? (
                  <Select value={elevenlabsVoiceId} onValueChange={setElevenlabsVoiceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Stimme auswaehlen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {voices.map((v) => (
                        <SelectItem key={v.voice_id} value={v.voice_id}>
                          {v.name} ({v.category}{v.labels?.accent ? `, ${v.labels.accent}` : ""})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-2">
                    <Input
                      placeholder="Voice-ID manuell eingeben oder Stimmen laden..."
                      value={elevenlabsVoiceId}
                      onChange={(e) => setElevenlabsVoiceId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Klicken Sie &quot;Stimmen laden&quot; um verfuegbare Stimmen aus Ihrem ElevenLabs-Konto zu laden, oder geben Sie eine Voice-ID manuell ein.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Einstellungen speichern
        </Button>
      </div>
    </div>
  )
}
