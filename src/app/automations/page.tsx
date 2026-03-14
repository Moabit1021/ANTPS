"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Zap, Plus, Trash2, RefreshCw, Clock, Play, Pause } from "lucide-react"

interface AutomationRule {
  id: string
  name: string
  isActive: boolean
  schedule: string
  sourceFilter: { senders?: string[]; types?: string[] } | null
  topicFilter: string | null
  speakers: number
  duration: number
  autoPublish: boolean
  lastRunAt: string | null
  createdAt: string
}

const SCHEDULE_PRESETS = [
  { label: "Taeglich um 8:00", value: "0 8 * * *" },
  { label: "Mo-Fr um 7:00", value: "0 7 * * 1-5" },
  { label: "Montags um 8:00", value: "0 8 * * 1" },
  { label: "Alle 6 Stunden", value: "0 */6 * * *" },
  { label: "Taeglich um 18:00", value: "0 18 * * *" },
]

export default function AutomationsPage() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Create form state
  const [formName, setFormName] = useState("")
  const [formSchedule, setFormSchedule] = useState("0 8 * * *")
  const [formTopic, setFormTopic] = useState("")
  const [formSpeakers, setFormSpeakers] = useState("2")
  const [formDuration, setFormDuration] = useState("10")
  const [formAutoPublish, setFormAutoPublish] = useState(false)

  const loadRules = useCallback(async () => {
    const res = await fetch("/api/automations")
    if (res.ok) {
      setRules(await res.json())
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  const handleCreate = async () => {
    if (!formName.trim()) return
    setSaving(true)

    const res = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formName,
        schedule: formSchedule,
        topicFilter: formTopic || undefined,
        speakers: parseInt(formSpeakers),
        duration: parseInt(formDuration),
        autoPublish: formAutoPublish,
      }),
    })

    if (res.ok) {
      setShowCreate(false)
      resetForm()
      await loadRules()
    }
    setSaving(false)
  }

  const toggleActive = async (rule: AutomationRule) => {
    const res = await fetch(`/api/automations/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    })
    if (res.ok) {
      setRules(prev =>
        prev.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r)
      )
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const res = await fetch(`/api/automations/${deleteId}`, { method: "DELETE" })
    if (res.ok) {
      setRules(prev => prev.filter(r => r.id !== deleteId))
    }
    setDeleteId(null)
  }

  const resetForm = () => {
    setFormName("")
    setFormSchedule("0 8 * * *")
    setFormTopic("")
    setFormSpeakers("2")
    setFormDuration("10")
    setFormAutoPublish(false)
  }

  const describeCron = (cron: string): string => {
    const preset = SCHEDULE_PRESETS.find(p => p.value === cron)
    if (preset) return preset.label
    return cron
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automationen</h1>
          <p className="text-muted-foreground">
            Erstelle automatisch Podcasts nach Zeitplan aus deinen Newslettern.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Automation
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Noch keine Automationen erstellt.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Erstelle eine Automation, um regelmaessig Podcasts aus deinen Newslettern zu generieren.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rules.map((rule) => (
            <Card key={rule.id} className={!rule.isActive ? "opacity-60" : ""}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {rule.isActive ? (
                      <Play className="h-4 w-4 text-green-600" />
                    ) : (
                      <Pause className="h-4 w-4 text-muted-foreground" />
                    )}
                    {rule.name}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3" />
                    {describeCron(rule.schedule)}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(rule)}
                  >
                    {rule.isActive ? "Pausieren" : "Aktivieren"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>
                    {rule.speakers === 1 ? "Monolog" : "Dialog"} | {rule.duration} Min.
                  </span>
                  {rule.topicFilter && (
                    <span>Thema: &quot;{rule.topicFilter}&quot;</span>
                  )}
                  {rule.autoPublish && (
                    <span className="text-green-600">Auto-Veroeffentlichung</span>
                  )}
                  {rule.lastRunAt && (
                    <span>
                      Letzter Lauf: {new Date(rule.lastRunAt).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Neue Automation</DialogTitle>
            <DialogDescription>
              Erstelle eine Regel, um automatisch Podcasts aus deinen Newslettern zu generieren.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="z.B. Morgen-Podcast"
              />
            </div>
            <div>
              <Label htmlFor="schedule">Zeitplan</Label>
              <Select value={formSchedule} onValueChange={setFormSchedule}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="topic">Themen-Filter (optional)</Label>
              <Input
                id="topic"
                value={formTopic}
                onChange={(e) => setFormTopic(e.target.value)}
                placeholder="z.B. KI im Gesundheitswesen"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Wenn gesetzt, werden nur thematisch relevante Newsletter verwendet (semantische Suche).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sprecher</Label>
                <Select value={formSpeakers} onValueChange={setFormSpeakers}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Monolog)</SelectItem>
                    <SelectItem value="2">2 (Dialog)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dauer (Min.)</Label>
                <Select value={formDuration} onValueChange={setFormDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 10, 15, 20, 30].map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} Minuten</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoPublish"
                checked={formAutoPublish}
                onChange={(e) => setFormAutoPublish(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="autoPublish" className="text-sm font-normal">
                Automatisch als Episode veroeffentlichen (Audio generieren + publizieren)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={!formName.trim() || saving}>
              {saving ? "Erstelle..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Automation loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Automation wird unwiderruflich geloescht. Bereits erstellte Podcasts bleiben erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Loeschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
