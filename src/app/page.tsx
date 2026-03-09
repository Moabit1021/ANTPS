"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileText, ScrollText, Headphones, Radio, Plus, Upload, Loader2,
} from "lucide-react"

interface Stats {
  newSourcesToday: number
  totalSources: number
  draftScripts: number
  totalScripts: number
  totalAudio: number
  publishedEpisodes: number
  totalEpisodes: number
}

interface Activity {
  type: string
  title: string
  date: string
  id: string
  status?: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Gerade eben"
  if (mins < 60) return `vor ${mins} Min.`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours} Std.`
  const days = Math.floor(hours / 24)
  if (days === 1) return "Gestern"
  if (days < 7) return `vor ${days} Tagen`
  return formatDate(iso)
}

const ACTIVITY_CONFIG: Record<string, { label: string; icon: typeof FileText; color: string; href: (id: string) => string }> = {
  source: { label: "Quelle", icon: FileText, color: "bg-blue-100 text-blue-800", href: (id) => `/sources/${id}` },
  script: { label: "Skript", icon: ScrollText, color: "bg-purple-100 text-purple-800", href: (id) => `/scripts/${id}` },
  audio: { label: "Audio", icon: Headphones, color: "bg-green-100 text-green-800", href: () => "/audio" },
  episode: { label: "Episode", icon: Radio, color: "bg-orange-100 text-orange-800", href: () => "/episodes" },
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard")
      if (!res.ok) return
      const data = await res.json()
      setStats(data.stats)
      setActivities(data.activities)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Willkommen bei PodBrief</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Neue Quellen</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.newSourcesToday ?? 0}
            </div>
            <CardDescription>
              Heute eingegangen &middot; {stats?.totalSources ?? 0} gesamt
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offene Skripte</CardTitle>
            <ScrollText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.draftScripts ?? 0}
            </div>
            <CardDescription>
              Warten auf Review &middot; {stats?.totalScripts ?? 0} gesamt
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Audio-Dateien</CardTitle>
            <Headphones className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.totalAudio ?? 0}
            </div>
            <CardDescription>Generiert</CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Episoden</CardTitle>
            <Radio className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.publishedEpisodes ?? 0}
            </div>
            <CardDescription>
              Veroeffentlicht &middot; {stats?.totalEpisodes ?? 0} gesamt
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle>Letzte Aktivitaeten</CardTitle>
            <CardDescription>Die letzten Ereignisse in PodBrief</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Aktivitaeten vorhanden.
              </p>
            ) : (
              <div className="space-y-3">
                {activities.map((activity, i) => {
                  const config = ACTIVITY_CONFIG[activity.type]
                  if (!config) return null
                  const Icon = config.icon
                  return (
                    <Link
                      key={`${activity.type}-${activity.id}-${i}`}
                      href={config.href(activity.id)}
                      className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <div className={`mt-0.5 rounded-full p-1.5 ${config.color}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatRelative(activity.date)}
                          </span>
                          {activity.status && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {activity.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Schnellaktionen</CardTitle>
            <CardDescription>Haeufig verwendete Aktionen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/sources">
              <Button variant="outline" className="w-full justify-start">
                <Upload className="mr-2 h-4 w-4" />
                Quelle hochladen
              </Button>
            </Link>
            <Link href="/scripts/new">
              <Button variant="outline" className="w-full justify-start">
                <Plus className="mr-2 h-4 w-4" />
                Neues Skript erstellen
              </Button>
            </Link>
            <Link href="/episodes">
              <Button variant="outline" className="w-full justify-start">
                <Radio className="mr-2 h-4 w-4" />
                Episoden verwalten
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
