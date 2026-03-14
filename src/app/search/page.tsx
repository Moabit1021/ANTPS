"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, FileText, CheckCircle2 } from "lucide-react"
import Link from "next/link"

interface SearchResult {
  sourceId: string
  title: string
  senderName: string | null
  receivedAt: string
  similarity: number
  matchedChunk: string
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async () => {
    if (query.trim().length < 2) return
    setSearching(true)
    setHasSearched(true)

    try {
      const res = await fetch(`/api/sources/search?q=${encodeURIComponent(query)}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results)
      }
    } catch (e) {
      console.error("Search error:", e)
    }
    setSearching(false)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Themensuche</h1>
        <p className="text-muted-foreground">
          Finde Newsletter zu einem bestimmten Thema mit semantischer Suche.
        </p>
      </div>

      {/* Search Input */}
      <div className="flex gap-3">
        <Input
          placeholder="z.B. KI im Gesundheitswesen, Datenschutz DSGVO, Cloud Migration..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={query.trim().length < 2 || searching}>
          <Search className="mr-2 h-4 w-4" />
          {searching ? "Suche..." : "Suchen"}
        </Button>
      </div>

      {/* Selected Sources Action */}
      {selectedIds.size > 0 && (
        <Card className="border-primary">
          <CardContent className="flex items-center justify-between py-3">
            <span className="text-sm font-medium">
              {selectedIds.size} Quelle(n) ausgewaehlt
            </span>
            <Link
              href={`/scripts/new?sourceIds=${Array.from(selectedIds).join(",")}`}
            >
              <Button size="sm">
                Podcast erstellen
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {hasSearched && results.length === 0 && !searching && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Keine Ergebnisse fuer &quot;{query}&quot;</p>
          <p className="text-sm text-muted-foreground mt-1">
            Versuche andere Suchbegriffe oder warte bis mehr Newsletter eingegangen sind.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{results.length} Ergebnisse</p>
          {results.map((result) => (
            <Card
              key={result.sourceId}
              className={`cursor-pointer transition-colors ${
                selectedIds.has(result.sourceId) ? "border-primary bg-primary/5" : "hover:bg-accent/50"
              }`}
              onClick={() => toggleSelect(result.sourceId)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {result.title}
                  </CardTitle>
                  {selectedIds.has(result.sourceId) && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{result.matchedChunk}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="text-primary font-medium">
                    {Math.round(result.similarity * 100)}% relevant
                  </span>
                  {result.senderName && <span>von {result.senderName}</span>}
                  <span>
                    {new Date(result.receivedAt).toLocaleDateString("de-DE")}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
