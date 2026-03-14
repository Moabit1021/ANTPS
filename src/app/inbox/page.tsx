"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Inbox, Copy, Check, RefreshCw, Mail, Trash2 } from "lucide-react"
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

interface UserProfile {
  id: string
  email: string
  name: string | null
  inboxEmail: string | null
  inboxAlias: string | null
  hasApiToken: boolean
}

interface Source {
  id: string
  title: string
  senderEmail: string | null
  senderName: string | null
  receivedAt: string
  type: string
  status: string
}

export default function InboxPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [page, setPage] = useState(1)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const limit = 20

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/me")
    if (res.ok) {
      setProfile(await res.json())
    }
  }, [])

  const loadSources = useCallback(async () => {
    const res = await fetch(`/api/sources?page=${page}&limit=${limit}&sort=desc`)
    if (res.ok) {
      const data = await res.json()
      setSources(data.sources)
      setTotal(data.total)
    }
  }, [page])

  useEffect(() => {
    Promise.all([loadProfile(), loadSources()]).finally(() => setLoading(false))
  }, [loadProfile, loadSources])

  const activateInbox = async () => {
    const res = await fetch("/api/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generateInbox: true }),
    })
    if (res.ok) {
      await loadProfile()
    }
  }

  const copyEmail = () => {
    if (profile?.inboxEmail) {
      navigator.clipboard.writeText(profile.inboxEmail)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const res = await fetch(`/api/sources/${deleteId}`, { method: "DELETE" })
    if (res.ok) {
      setSources(prev => prev.filter(s => s.id !== deleteId))
      setTotal(prev => prev - 1)
    }
    setDeleteId(null)
  }

  const totalPages = Math.ceil(total / limit)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mein Postfach</h1>
        <p className="text-muted-foreground">
          Leite Newsletter an deine persoenliche E-Mail-Adresse weiter, um sie als Quellen zu verwenden.
        </p>
      </div>

      {/* Inbox Email Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Persoenliche E-Mail-Adresse
          </CardTitle>
          <CardDescription>
            Leite Newsletter an diese Adresse weiter. Sie werden automatisch als Quellen gespeichert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profile?.inboxEmail ? (
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded-md bg-muted px-4 py-2 text-sm font-mono">
                {profile.inboxEmail}
              </code>
              <Button variant="outline" size="sm" onClick={copyEmail}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Du hast noch keine persoenliche E-Mail-Adresse. Aktiviere sie, um Newsletter direkt weiterleiten zu koennen.
              </p>
              <Button onClick={activateInbox}>
                <Inbox className="mr-2 h-4 w-4" />
                Postfach aktivieren
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sources List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Eingegangene Newsletter ({total})</CardTitle>
            <CardDescription>Alle an dein Postfach weitergeleiteten Inhalte</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadSources}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
        </CardHeader>
        <CardContent>
          {sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Noch keine Newsletter eingegangen.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Leite einen Newsletter an deine Adresse weiter, um loszulegen.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{source.title}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {source.senderName && <span>{source.senderName}</span>}
                      {source.senderEmail && <span>{source.senderEmail}</span>}
                      <span>{new Date(source.receivedAt).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">
                        {source.status}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-2 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteId(source.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Zurueck
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Seite {page} von {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Weiter
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quelle loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Quelle wird unwiderruflich geloescht. Skripte, die darauf basieren, bleiben erhalten.
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
