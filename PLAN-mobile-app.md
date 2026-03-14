# PodBrief Mobile App & Multi-Tenant Erweiterung - Implementierungsplan

## Architektur-Übersicht

```
┌──────────────────┐     ┌──────────────────────────────────┐
│  SwiftUI App     │────▶│  Next.js API (erweitert)         │
│  (iPhone)        │     │  - JWT Auth (Bearer Token)       │
└──────────────────┘     │  - Multi-Tenant (userId scope)   │
                         │  - Inbound Email Webhook         │
┌──────────────────┐     │  - Embedding/Vector Search       │
│  Web App         │────▶│  - Automation Rules Engine       │
│  (Browser)       │     └──────────┬───────────────────────┘
└──────────────────┘                │
                         ┌──────────▼───────────────────────┐
┌──────────────────┐     │  PostgreSQL + pgvector            │
│  Mailserver      │────▶│  - Source embeddings              │
│  (separater VPS) │     │  - Automation rules               │
│  Catch-All →     │     └──────────────────────────────────┘
│  Webhook an API  │
└──────────────────┘
```

## Phase 1: Backend - Multi-Tenant & API-Erweiterung

### 1.1 Datenbank-Schema Erweiterungen

**User-Model erweitern:**
- `inboxAlias` (unique) - z.B. "u-a8f3k2" → user bekommt u-a8f3k2@inbox.podbriefapp.com
- `apiToken` (unique, hashed) - für Mobile-App Authentifizierung

**Source-Model erweitern:**
- `userId` - Zuordnung zum Benutzer (bisher global)
- `embedding` (vector) - OpenAI Embedding für semantische Suche
- `embeddingModel` - welches Modell verwendet wurde

**Neues Model: AutomationRule**
- `userId` - Besitzer der Regel
- `name` - z.B. "Morgen-Podcast"
- `isActive` - ein/aus
- `schedule` - Cron-Expression (z.B. "0 8 * * 1-5" = Mo-Fr 8 Uhr)
- `sourceFilter` - JSON: welche Newsletter/Absender einbeziehen
- `topicFilter` - Optional: thematischer Filter (semantische Suche)
- `speakers` - 1 oder 2
- `duration` - Zieldauer in Minuten
- `autoPublish` - automatisch als Episode veröffentlichen?

**PodcastScript, PodcastAudio, PodcastEpisode erweitern:**
- `userId` - Zuordnung zum Benutzer

### 1.2 pgvector für Embedding-Suche

- PostgreSQL-Extension `pgvector` aktivieren
- OpenAI `text-embedding-3-small` (1536 Dimensionen)
- Embeddings bei Source-Erstellung generieren
- Cosine-Similarity Suche für Topic-basierte Auswahl

### 1.3 API-Erweiterungen

**Neue Endpoints:**
- `POST /api/inbound-email` - Webhook für eingehende E-Mails vom Mailserver
- `GET /api/sources/search` - Semantische Suche über Sources
- `GET/POST/PUT/DELETE /api/automations` - Automation Rules CRUD
- `POST /api/auth/token` - API Token generieren (für Mobile-App)
- `GET /api/me` - User-Profil inkl. Inbox-Adresse

**Bestehende Endpoints anpassen:**
- Alle Source/Script/Audio/Episode-Endpoints: userId-Scoping
- Admin sieht alles, Creator nur eigene Daten

### 1.4 Automation Engine

- BullMQ Cron-Jobs basierend auf AutomationRule
- Bei Trigger: relevante Sources sammeln → Script generieren → Audio generieren → optional Episode publizieren
- Worker-Erweiterung für automatische Pipeline

## Phase 2: Mailserver Setup

### 2.1 Docker-basierter Mailserver (separater VPS)

**Empfehlung: Stalwart Mail Server**
- Modern, Rust-basiert, leichtgewichtig
- Catch-All Support
- Webhook-Integration
- Docker-Image verfügbar

**Alternative: docker-mailserver (DMS)**
- Bewährt, gut dokumentiert
- Braucht postfix-Konfiguration für Catch-All + Pipe-to-Script

### 2.2 DNS-Konfiguration

```
inbox.podbriefapp.com  MX    10  mail.podbriefapp.com
mail.podbriefapp.com   A         <VPS-IP>
                       SPF       "v=spf1 ip4:<VPS-IP> -all"
                       DKIM      (auto-generiert)
```

### 2.3 E-Mail → Webhook Pipeline

1. Mail kommt rein an `u-a8f3k2@inbox.podbriefapp.com`
2. Mailserver parst den Alias ("u-a8f3k2")
3. HTTP POST an `https://app.podbriefapp.com/api/inbound-email`
   - Headers: Shared Secret für Auth
   - Body: from, to, subject, html, text, attachments
4. API-Endpoint:
   - Extrahiert Alias aus To-Adresse
   - Findet User per `inboxAlias`
   - Erstellt Source mit `userId`
   - Generiert Embedding async

## Phase 3: SwiftUI iPhone App

### 3.1 Projektstruktur

```
PodBrief/
├── PodBriefApp.swift           (App Entry)
├── Models/
│   ├── User.swift
│   ├── Source.swift
│   ├── PodcastScript.swift
│   ├── PodcastAudio.swift
│   ├── AutomationRule.swift
│   └── Episode.swift
├── Services/
│   ├── APIClient.swift          (HTTP Client mit Bearer Token)
│   ├── AuthService.swift        (Login + Token Management)
│   ├── AudioPlayer.swift        (AVAudioPlayer + Background)
│   └── KeychainService.swift    (Sichere Token-Speicherung)
├── Views/
│   ├── Auth/
│   │   ├── LoginView.swift
│   │   └── RegisterView.swift
│   ├── Inbox/
│   │   ├── InboxView.swift      (Newsletter-Übersicht)
│   │   └── SourceDetailView.swift
│   ├── Podcasts/
│   │   ├── CreatePodcastView.swift  (Manuelle Erstellung)
│   │   ├── TopicSearchView.swift    (Themen-Suche)
│   │   ├── PodcastListView.swift
│   │   └── PodcastDetailView.swift
│   ├── Player/
│   │   ├── PlayerView.swift         (Full-Screen Player)
│   │   └── MiniPlayerView.swift     (Compact Player Bar)
│   ├── Automations/
│   │   ├── AutomationListView.swift
│   │   └── AutomationEditView.swift
│   └── Settings/
│       └── SettingsView.swift
├── Components/
│   ├── SourceRow.swift
│   ├── PodcastRow.swift
│   └── LoadingView.swift
└── Utilities/
    ├── Constants.swift
    └── Extensions.swift
```

### 3.2 Kern-Features

**Audio Player:**
- AVAudioSession Konfiguration für Background Playback
- MPRemoteCommandCenter für Lock Screen / Bluetooth Controls
- MPNowPlayingInfoCenter für Metadaten
- Streaming von API-Endpoint
- Download für Offline-Nutzung

**Newsletter Inbox:**
- Liste aller empfangenen Newsletter
- Gruppierung nach Absender
- Multi-Select für Podcast-Erstellung
- Pull-to-Refresh

**Podcast-Erstellung:**
- Aus ausgewählten Newslettern (manuell)
- Über Themen-Suche (semantisch)
- Speaker/Duration Konfiguration
- Progress-Tracking (Generierung → Audio)

**Automation:**
- Regeln erstellen/bearbeiten
- Zeitplan konfigurieren
- Source-Filter (nach Absender)
- Topic-Filter (semantische Suche)

### 3.3 App Store Distribution

- **Unlisted App**: Nicht über Suche auffindbar
- **Invite-Code**: Bestehendes Invite-System nutzen
- Registrierung in der App über Invite-Link (Deep Link)

## Phase 4: Web-App Erweiterungen

### 4.1 Neue Seiten

- **Inbox/Meine Newsletter** - persönliche Newsletter-Übersicht mit individueller E-Mail-Adresse
- **Themen-Suche** - semantische Suche über alle eigenen Newsletter
- **Automationen** - Regeln erstellen und verwalten

### 4.2 Bestehende Seiten anpassen

- **Dashboard**: persönliche Statistiken
- **Sources**: userId-Filter, Inbox-Adresse anzeigen
- **Scripts/Audio/Episodes**: userId-Scoping

## Umsetzungsreihenfolge

| Schritt | Was | Aufwand |
|---------|-----|---------|
| 1 | DB-Schema + pgvector + Migrations | Backend |
| 2 | Multi-Tenant userId-Scoping aller Endpoints | Backend |
| 3 | Inbound Email Webhook API | Backend |
| 4 | OpenAI Embeddings + Vektor-Suche | Backend |
| 5 | Automation Rules CRUD + Engine | Backend |
| 6 | API Token Auth (Bearer) für Mobile | Backend |
| 7 | Web-UI Erweiterungen (Inbox, Suche, Automationen) | Frontend |
| 8 | SwiftUI App Grundgerüst + Auth | iOS |
| 9 | SwiftUI Inbox + Podcast-Erstellung | iOS |
| 10 | SwiftUI Audio Player + Bluetooth | iOS |
| 11 | SwiftUI Automationen | iOS |
| 12 | Mailserver Setup Dokumentation | Infra |

## Offene Entscheidungen

1. **Domain für Inbound-Email** - Welche Domain soll verwendet werden?
2. **App Name im Store** - "PodBrief" oder anderer Name?
3. **Apple Developer Account** - Bereits vorhanden?
