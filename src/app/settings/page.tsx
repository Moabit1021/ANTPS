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
import { Loader2, Save, Eye, EyeOff, RefreshCw, Copy, Check, Mail } from "lucide-react"

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
  elevenlabs_voice_id_2: string
  elevenlabs_voice_name_1: string
  elevenlabs_voice_name_2: string
  elevenlabs_model: string
  smtp_host: string
  smtp_port: string
  smtp_user: string
  smtp_pass: string
  smtp_pass_masked: string
  smtp_pass_set: string
  smtp_from_email: string
  smtp_from_name: string
  smtp_secure: string
  openai_api_key: string
  openai_api_key_masked: string
  openai_api_key_set: string
  inbox_domain: string
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

  // Form state - Feed Config
  const [feedTitle, setFeedTitle] = useState("PodBrief")
  const [feedDescription, setFeedDescription] = useState("")
  const [feedAuthor, setFeedAuthor] = useState("PodBrief")
  const [feedLanguage, setFeedLanguage] = useState("de")
  const [feedImageUrl, setFeedImageUrl] = useState("")
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedSaving, setFeedSaving] = useState(false)
  const [feedUrlCopied, setFeedUrlCopied] = useState(false)

  // Form state - ElevenLabs
  const [elevenlabsKey, setElevenlabsKey] = useState("")
  const [showElevenlabsKey, setShowElevenlabsKey] = useState(false)
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState("")
  const [elevenlabsVoiceId2, setElevenlabsVoiceId2] = useState("")
  const [voiceName1, setVoiceName1] = useState("Alex")
  const [voiceName2, setVoiceName2] = useState("Kim")
  const [elevenlabsModel, setElevenlabsModel] = useState("eleven_multilingual_v2")
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [loadingVoices, setLoadingVoices] = useState(false)

  // Form state - SMTP
  const [smtpHost, setSmtpHost] = useState("")
  const [smtpPort, setSmtpPort] = useState("465")
  const [smtpUser, setSmtpUser] = useState("")
  const [smtpPass, setSmtpPass] = useState("")
  const [showSmtpPass, setShowSmtpPass] = useState(false)
  const [smtpFromEmail, setSmtpFromEmail] = useState("")
  const [smtpFromName, setSmtpFromName] = useState("PodBrief")
  const [smtpSecure, setSmtpSecure] = useState("true")
  const [testingSmtp, setTestingSmtp] = useState(false)

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
      setElevenlabsVoiceId2(data.elevenlabs_voice_id_2 || "")
      setVoiceName1(data.elevenlabs_voice_name_1 || "Alex")
      setVoiceName2(data.elevenlabs_voice_name_2 || "Kim")
      setElevenlabsModel(data.elevenlabs_model || "eleven_multilingual_v2")
      // SMTP
      setSmtpHost(data.smtp_host || "")
      setSmtpPort(data.smtp_port || "465")
      setSmtpUser(data.smtp_user || "")
      setSmtpFromEmail(data.smtp_from_email || "")
      setSmtpFromName(data.smtp_from_name || "PodBrief")
      setSmtpSecure(data.smtp_secure || "true")
    } catch {
      toast({ title: "Fehler", description: "Einstellungen konnten nicht geladen werden.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchFeedConfig = useCallback(async () => {
    setFeedLoading(true)
    try {
      const res = await fetch("/api/feed/config")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setFeedTitle(data.title || "PodBrief")
      setFeedDescription(data.description || "")
      setFeedAuthor(data.author || "PodBrief")
      setFeedLanguage(data.language || "de")
      setFeedImageUrl(data.imageUrl || "")
    } catch {
      // Feed config might not exist yet, that's ok
    } finally {
      setFeedLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
    fetchFeedConfig()
  }, [fetchSettings, fetchFeedConfig])

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
        elevenlabs_voice_id_2: elevenlabsVoiceId2,
        elevenlabs_voice_name_1: voiceName1,
        elevenlabs_voice_name_2: voiceName2,
        elevenlabs_model: elevenlabsModel,
      }
      // SMTP
      if (smtpHost) body.smtp_host = smtpHost
      if (smtpPort) body.smtp_port = smtpPort
      if (smtpUser) body.smtp_user = smtpUser
      if (smtpFromEmail) body.smtp_from_email = smtpFromEmail
      if (smtpFromName) body.smtp_from_name = smtpFromName
      body.smtp_secure = smtpSecure

      if (apiKey) body.llm_api_key = apiKey
      if (elevenlabsKey) body.elevenlabs_api_key = elevenlabsKey
      if (smtpPass) body.smtp_pass = smtpPass

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()

      toast({ title: "Gespeichert", description: "Einstellungen wurden aktualisiert." })
      setApiKey("")
      setElevenlabsKey("")
      setSmtpPass("")
      setShowApiKey(false)
      setShowElevenlabsKey(false)
      setShowSmtpPass(false)
      fetchSettings()
    } catch {
      toast({ title: "Fehler", description: "Einstellungen konnten nicht gespeichert werden.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveFeed = async () => {
    setFeedSaving(true)
    try {
      const res = await fetch("/api/feed/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: feedTitle,
          description: feedDescription,
          author: feedAuthor,
          language: feedLanguage,
          imageUrl: feedImageUrl,
        }),
      })
      if (!res.ok) throw new Error()
      toast({ title: "Gespeichert", description: "Feed-Konfiguration wurde aktualisiert." })
    } catch {
      toast({ title: "Fehler", description: "Feed-Konfiguration konnte nicht gespeichert werden.", variant: "destructive" })
    } finally {
      setFeedSaving(false)
    }
  }

  const copyFeedUrl = () => {
    const url = `${window.location.origin}/api/feed`
    navigator.clipboard.writeText(url)
    setFeedUrlCopied(true)
    setTimeout(() => setFeedUrlCopied(false), 2000)
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
          <TabsTrigger value="feed">Podcast-Feed</TabsTrigger>
          <TabsTrigger value="smtp">E-Mail (SMTP)</TabsTrigger>
          <TabsTrigger value="embeddings">Embeddings</TabsTrigger>
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
              <CardTitle>Modell und Stimmen</CardTitle>
              <CardDescription>
                Konfigurieren Sie das ElevenLabs-Modell und bis zu zwei Stimmen fuer den Podcast-Dialog.
                Die Sprecher-Namen muessen mit den Markern im Skript uebereinstimmen (z.B. [Alex] oder Alex:).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Label>ElevenLabs Modell</Label>
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

              {/* Voice 1 */}
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium text-sm">Stimme 1 (Hauptsprecher)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Sprecher-Name im Skript</Label>
                    <Input
                      value={voiceName1}
                      onChange={(e) => setVoiceName1(e.target.value)}
                      placeholder="z.B. Alex"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ElevenLabs Stimme</Label>
                    {voices.length > 0 ? (
                      <Select value={elevenlabsVoiceId} onValueChange={setElevenlabsVoiceId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Stimme waehlen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {voices.map((v) => (
                            <SelectItem key={v.voice_id} value={v.voice_id}>
                              {v.name} ({v.category})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="Voice-ID eingeben..."
                        value={elevenlabsVoiceId}
                        onChange={(e) => setElevenlabsVoiceId(e.target.value)}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Voice 2 */}
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium text-sm">Stimme 2 (optional, fuer Dialog-Podcasts)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Sprecher-Name im Skript</Label>
                    <Input
                      value={voiceName2}
                      onChange={(e) => setVoiceName2(e.target.value)}
                      placeholder="z.B. Kim"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">ElevenLabs Stimme</Label>
                    {voices.length > 0 ? (
                      <Select value={elevenlabsVoiceId2 || "_none"} onValueChange={(v) => setElevenlabsVoiceId2(v === "_none" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Keine (Single-Voice)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Keine (Single-Voice)</SelectItem>
                          {voices.map((v) => (
                            <SelectItem key={v.voice_id} value={v.voice_id}>
                              {v.name} ({v.category})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="Voice-ID eingeben (leer lassen fuer Single-Voice)..."
                        value={elevenlabsVoiceId2}
                        onChange={(e) => setElevenlabsVoiceId2(e.target.value)}
                      />
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Bei einem Dialog-Podcast muss das Skript Sprecher-Marker enthalten, z.B. <code className="bg-muted px-1 py-0.5 rounded">[{voiceName1}]</code> und <code className="bg-muted px-1 py-0.5 rounded">[{voiceName2}]</code> oder <code className="bg-muted px-1 py-0.5 rounded">{voiceName1}:</code> und <code className="bg-muted px-1 py-0.5 rounded">{voiceName2}:</code>.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feed Configuration Tab */}
        <TabsContent value="feed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Feed-URL</CardTitle>
              <CardDescription>
                Diese URL koennen Podcast-Apps abonnieren, um neue Episoden automatisch zu erhalten.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={typeof window !== "undefined" ? `${window.location.origin}/api/feed` : "/api/feed"}
                  className="font-mono text-sm bg-muted"
                />
                <Button variant="outline" size="icon" onClick={copyFeedUrl}>
                  {feedUrlCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Fuer personalisierte Feed-URLs koennen Sie Abonnenten unter &quot;Abonnenten&quot; anlegen.
                Deren persoenliche URLs enthalten einen Token: /api/feed?token=...
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Podcast-Metadaten</CardTitle>
              <CardDescription>
                Diese Informationen erscheinen in Podcast-Apps und im RSS-Feed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {feedLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Podcast-Titel</Label>
                    <Input
                      value={feedTitle}
                      onChange={(e) => setFeedTitle(e.target.value)}
                      placeholder="z.B. PodBrief"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Beschreibung</Label>
                    <Textarea
                      value={feedDescription}
                      onChange={(e) => setFeedDescription(e.target.value)}
                      rows={3}
                      placeholder="Kurze Beschreibung des Podcasts..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Autor</Label>
                      <Input
                        value={feedAuthor}
                        onChange={(e) => setFeedAuthor(e.target.value)}
                        placeholder="z.B. PodBrief"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sprache</Label>
                      <Select value={feedLanguage} onValueChange={setFeedLanguage}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="de">Deutsch</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="fr">Français</SelectItem>
                          <SelectItem value="es">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Cover-Bild URL (optional)</Label>
                    <Input
                      value={feedImageUrl}
                      onChange={(e) => setFeedImageUrl(e.target.value)}
                      placeholder="https://example.com/cover.jpg"
                    />
                    <p className="text-xs text-muted-foreground">
                      Empfohlen: 1400x1400px bis 3000x3000px, JPEG oder PNG
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSaveFeed} disabled={feedSaving}>
                      {feedSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Feed-Konfiguration speichern
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMTP Configuration Tab */}
        <TabsContent value="smtp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SMTP-Server</CardTitle>
              <CardDescription>
                E-Mail-Einstellungen fuer den Versand von Einladungen und Benachrichtigungen.
                Bei zone.ee verwenden Sie <code className="bg-muted px-1 py-0.5 rounded text-xs">mail.zone.ee</code> als Host mit Port 465 (SSL).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SMTP-Host</Label>
                  <Input
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="mail.zone.ee"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Select value={smtpPort} onValueChange={setSmtpPort}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="465">465 (SSL/TLS)</SelectItem>
                      <SelectItem value="587">587 (STARTTLS)</SelectItem>
                      <SelectItem value="25">25 (unverschluesselt)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Benutzername</Label>
                  <Input
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="noreply@example.ee"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Passwort</Label>
                  {settings?.smtp_pass_set === "true" && (
                    <p className="text-sm text-muted-foreground">
                      Aktuell gesetzt: {settings.smtp_pass_masked}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type={showSmtpPass ? "text" : "password"}
                      placeholder={settings?.smtp_pass_set === "true" ? "Neues Passwort eingeben..." : "Passwort eingeben..."}
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      type="button"
                      onClick={() => setShowSmtpPass(!showSmtpPass)}
                    >
                      {showSmtpPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Absender-E-Mail</Label>
                  <Input
                    value={smtpFromEmail}
                    onChange={(e) => setSmtpFromEmail(e.target.value)}
                    placeholder="noreply@example.ee"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leer lassen, um den Benutzernamen zu verwenden
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Absender-Name</Label>
                  <Input
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    placeholder="PodBrief"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Verschluesselung</Label>
                <Select value={smtpSecure} onValueChange={setSmtpSecure}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">SSL/TLS (empfohlen)</SelectItem>
                    <SelectItem value="false">Keine / STARTTLS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={async () => {
                    setTestingSmtp(true)
                    try {
                      const res = await fetch("/api/smtp-test", { method: "POST" })
                      const data = await res.json()
                      if (res.ok) {
                        toast({ title: "Erfolg", description: "SMTP-Verbindung erfolgreich hergestellt." })
                      } else {
                        toast({ title: "Fehler", description: data.error || "Verbindung fehlgeschlagen.", variant: "destructive" })
                      }
                    } catch {
                      toast({ title: "Fehler", description: "Test fehlgeschlagen.", variant: "destructive" })
                    } finally {
                      setTestingSmtp(false)
                    }
                  }}
                  disabled={testingSmtp}
                >
                  {testingSmtp ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Verbindung testen
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Embeddings & Inbox Tab */}
        <TabsContent value="embeddings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>OpenAI Embeddings</CardTitle>
              <CardDescription>
                API-Schluessel fuer die semantische Suche (Themensuche ueber Newsletter).
                Verwendet das Modell text-embedding-3-small.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="openai_api_key">OpenAI API Key</Label>
                <div className="flex gap-2">
                  <Input
                    id="openai_api_key"
                    type="password"
                    value={settings!.openai_api_key}
                    onChange={(e) => setSettings({ ...settings!, openai_api_key: e.target.value })}
                    placeholder={settings!.openai_api_key_set === "true" ? settings!.openai_api_key_masked : "sk-..."}
                  />
                </div>
                {settings!.openai_api_key_set === "true" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Aktuell: {settings!.openai_api_key_masked}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inbound E-Mail</CardTitle>
              <CardDescription>
                Domain fuer die persoenlichen E-Mail-Adressen der Benutzer.
                Benutzer koennen Newsletter an ihre persoenliche Adresse weiterleiten.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="inbox_domain">Inbox-Domain</Label>
                <Input
                  id="inbox_domain"
                  value={settings!.inbox_domain || ""}
                  onChange={(e) => setSettings({ ...settings!, inbox_domain: e.target.value })}
                  placeholder="inbox.podbriefapp.com"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Benutzer erhalten Adressen wie u-abc123@{settings!.inbox_domain || "inbox.podbriefapp.com"}
                </p>
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
