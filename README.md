# Athlr 🏃‍♂️

> **A privacy-first, offline-capable GPS fitness tracker** — built with Expo & React Native.  
> Inspired by Strava. Designed to be simple, fast, and 100% open.

<div align="center">

![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-blue?style=flat-square)
![Expo](https://img.shields.io/badge/Expo-52.0-black?style=flat-square&logo=expo)
![React Native](https://img.shields.io/badge/React%20Native-0.76-61dafb?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178c6?style=flat-square&logo=typescript)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

</div>

---

## Table of Contents

1. [Why We Built This](#why-we-built-this)
2. [What Athlr Does](#what-athlr-does)
3. [User Flow](#user-flow)
4. [App Architecture](#app-architecture)
5. [Tech Stack & Key Decisions](#tech-stack--key-decisions)
6. [Project Structure](#project-structure)
7. [Core Modules Explained](#core-modules-explained)
8. [Data Model](#data-model)
9. [GPS Pipeline](#gps-pipeline)
10. [Monetization Strategy](#monetization-strategy)
11. [Roadmap](#roadmap)
12. [Getting Started (Developer Guide)](#getting-started-developer-guide)
13. [Building & Releasing](#building--releasing)
14. [Contributing](#contributing)

---

## Why We Built This

The fitness tracking market is dominated by **Strava**, **Garmin Connect**, and **Apple Fitness+** — all of which have grown bloated, paywalled, or ecosystem-locked.

**The problems we saw:**

| Problem | Our answer |
|---|---|
| Strava hides basic features (segment comparisons, training load) behind a $80/yr paywall | Core recording & analytics are always free |
| Most apps send your GPS data to the cloud immediately | Athlr is **offline-first** — your data lives on-device until you choose otherwise |
| No app lets you own your data cleanly | One-tap **GPX export** of every activity, free, forever |
| Giant app bundles (Strava is 150 MB+) | Athlr targets <30 MB with zero unnecessary dependencies |

**The target user:** Recreational runners, cyclists, hikers, and walkers who want a clean, fast activity recorder — no social pressure, no algorithmic feed, no upsell every screen.

---

## What Athlr Does

### Core Features (Shipped)

- 🗺️ **GPS Activity Recording** — Real-time tracking with route polyline on a live map
- ⏸️ **Auto-Pause / Manual Pause** — Clock stops when you stop moving (configurable)
- 📊 **Live Stats Panel** — Distance (km/mi), moving time, current pace (min/km or min/mi) updated every second
- 🏃 **Sport Types** — Run, Ride, Walk, Hike, Swim, Yoga, HIIT, Strength, Tennis, and more.
- 📐 **Per-Kilometer/Mile Splits** — Automatically computed with pace bar visualisation
- 📍 **Background Tracking** — GPS keeps recording when screen locks
- 🗃️ **Offline SQLite Storage** — All activities stored on-device; nothing sent anywhere
- 📤 **GPX Export** — Share standard GPX files to any app
- 📸 **Share as Image** — Generate a beautiful, Instagram-ready map and stats card to share.
- ☁️ **Cloud Backup & Sync** — Securely sync your offline activities to Firebase Firestore so you never lose them.
- 🤝 **Social Feed** — Follow your friends and view their public activities in a customized community feed.
- 🔒 **Private by Default** — Visibility is `private` unless you explicitly change it
- 📈 **Lifetime & Training Stats** — Total activities, distance, moving time, elevation gain, calendar heatmaps, and weekly/monthly breakdowns.
- ✏️ **Edit Activities** — Title editing and visibility toggles per activity.
- 🧹 **Clean Delete** — Remove any activity with its full GPS trace

### In Progress / Planned

- Apple Health / Google Fit export
- Advanced segment leaderboards
- Offline maps download
- Apple Watch / WearOS companion apps

---

## User Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        APP OPEN                             │
│                           │                                 │
│              ┌────────────┴────────────┐                    │
│              ▼                         ▼                    │
│         Activities Tab            Record Tab                │
│     (list of past workouts)    (map + controls)            │
│              │                         │                    │
│     Tap any card              Select sport type             │
│              │                (Run/Ride/Walk/Hike)          │
│              ▼                         │                    │
│      Activity Detail              Press START               │
│    ┌─────────────────┐                 │                    │
│    │ • Route map     │       Request location permission    │
│    │ • 4 stat tiles  │                 │                    │
│    │ • Splits table  │      ┌──────────┴──────────┐        │
│    │ • Export GPX    │      │   RECORDING STATE   │        │
│    │ • Delete        │      │ Live map + polyline  │        │
│    └─────────────────┘      │ Stats update / 1 s  │        │
│                              │ Auto-pause detects  │        │
│                              │ stationary periods  │        │
│                              └──────────┬──────────┘        │
│                                         │                   │
│                              PAUSE ◄────┤────► RESUME       │
│                                         │                   │
│                                    Press STOP               │
│                                         │                   │
│                              ┌──────────┴──────────┐        │
│                              │  Finish Dialog      │        │
│                              │  Save | Discard     │        │
│                              └──────────┬──────────┘        │
│                                         │                   │
│                                    SAVE ACTIVITY            │
│                                         │                   │
│                         ┌───────────────┴────────────┐      │
│                         │  Compute & persist to DB   │      │
│                         │  • Splits (per km)         │      │
│                         │  • Elevation gain          │      │
│                         │  • Avg pace                │      │
│                         │  • Full GPS point array    │      │
│                         └───────────────┬────────────┘      │
│                                         │                   │
│                              Navigate → Activity Detail     │
└─────────────────────────────────────────────────────────────┘
```

### Screen-by-Screen Breakdown

#### 1. Activities Feed (`/`)
- Loads all activities from SQLite on focus (no stale cache issues)
- Each card shows: sport icon, title, date/time, distance, moving time, pace
- Empty state guides new users to the Record tab
- Tap any card → Activity Detail

#### 2. Record (`/record`)
- On mount: requests location permission; centers map on current position
- Sport picker (horizontal scroll) — affects GPS filter speed limits
- **START** → starts background GPS task + in-memory recording state
- Live map follows athlete with animated camera
- Stats update every 1 second via `setInterval`
- Auto-pause: if GPS speed < 0.5 m/s for 8 seconds → `state: 'paused'`
- **PAUSE** / **RESUME** → preserves points, freezes moving-time clock
- **STOP** → confirmation dialog → Save (navigates to detail) or Discard

#### 3. Activity Detail (`/activity/[id]`)
- Loads full activity (including GPS point array) from SQLite
- Static map with route polyline fitted to bounding box
- 4 stat tiles: distance, moving time, avg pace, elevation gain
- Splits table with pace bar chart
- Actions: Export GPX | Delete

#### 4. Profile (`/profile`)
- Lifetime aggregate stats from a single SQL query
- Auto-pause setting (persisted in Zustand store)
- "Our promise" card — commitment to privacy and data portability

---

## App Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   EXPO ROUTER (file-based)               │
│  app/                                                    │
│  ├── _layout.tsx          ← Root Stack navigator         │
│  ├── (tabs)/                                             │
│  │   ├── _layout.tsx      ← Tab bar config               │
│  │   ├── index.tsx        ← Activities feed              │
│  │   ├── record.tsx       ← GPS recording screen         │
│  │   └── profile.tsx      ← Stats + settings             │
│  └── activity/[id].tsx    ← Activity detail (modal-ish)  │
└──────────────────────────────────────────────────────────┘
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
   ┌──────────────┐ ┌──────────┐ ┌──────────────┐
   │ Zustand Store│ │ Services │ │    SQLite DB  │
   │              │ │          │ │               │
   │ recording    │ │ location │ │ activities    │
   │ State (RAM)  │ │ Service  │ │ table (WAL)   │
   │              │ │          │ │               │
   │ • state      │ │ • start/ │ │ • id (PK)     │
   │ • sport      │ │   stop   │ │ • sport       │
   │ • points[]   │ │   Track  │ │ • title       │
   │ • distanceM  │ │ • req    │ │ • points_json │
   │ • movingS    │ │   Perms  │ │ • splits_json │
   │ • pace       │ │          │ │ • ...stats    │
   └──────┬───────┘ └────┬─────┘ └──────────────┘
          │              │
          │    GPS fixes │  (background task)
          └──────────────┘
                  │
          ┌───────▼────────┐
          │   GpsFilter    │
          │                │
          │ 1. accuracy    │
          │ 2. speed gate  │
          │ 3. jitter gate │
          │ 4. smoothing   │
          └────────────────┘
```

### State Management Philosophy

- **Zustand** for recording state (ephemeral, in-memory). Chosen over Redux for minimal boilerplate and direct selector subscriptions without re-render cascades.
- **SQLite** (via `expo-sqlite`) for persistence. No ORM — raw SQL for predictable query plans.
- **No global React context** — components talk to Zustand or the DB directly.
- **No network layer** (yet) — the app is designed to work on a plane with zero connectivity.

---

## Tech Stack & Key Decisions

| Layer | Choice | Why |
|---|---|---|
| Framework | **Expo SDK 52** | Managed workflow = faster iteration; EAS Build for CI/CD |
| Navigation | **Expo Router 4** | File-based routing, typed routes, native stack performance |
| Language | **TypeScript 5.3** | Strict mode, no `any` in domain types |
| State | **Zustand 5** | Minimal API, no context boilerplate, works outside React (store.getState() in background task) |
| Maps | **react-native-maps 1.18** | Native MapKit (iOS) / Google Maps (Android); best perf for live polylines |
| Storage | **expo-sqlite 15** | WAL mode, on-device, no sync risk, survives offline |
| Location | **expo-location 18** | Background task via expo-task-manager; foreground service on Android |
| Icons | **@expo/vector-icons** | Ionicons subset; tree-shaken at build time |
| Build | **EAS Build** | Cloud build with `autoIncrement: true` on all profiles |

### Why NOT these alternatives

| Rejected | Reason |
|---|---|
| Redux / RTK | Overkill for single recording flow; too much boilerplate |
| Realm / WatermelonDB | Heavier bundle; SQLite is sufficient and universal |
| react-navigation (manual) | Expo Router provides same performance with less config |
| `@react-native-async-storage` | Not suitable for relational query (activities × splits) |
| Firebase Firestore (default) | Privacy-first: no cloud by default |

---

## Project Structure

```
athlr/
├── app/                         # Expo Router screens
│   ├── _layout.tsx              # Root Stack + StatusBar
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab bar (Activities / Record / You)
│   │   ├── index.tsx            # Activities feed
│   │   ├── record.tsx           # GPS recording (main screen)
│   │   └── profile.tsx          # Lifetime stats + settings
│   └── activity/
│       └── [id].tsx             # Activity detail + splits + map
│
├── src/
│   ├── db/
│   │   └── database.ts          # SQLite schema, CRUD, aggregate queries
│   │
│   ├── services/
│   │   ├── locationService.ts   # expo-location background task wrapper
│   │   └── gpsFilter.ts         # 4-stage GPS reliability pipeline
│   │
│   ├── store/
│   │   └── recordingStore.ts    # Zustand store: all recording state + logic
│   │
│   ├── types/
│   │   └── index.ts             # Domain types: Activity, TrackPoint, Split…
│   │
│   ├── utils/
│   │   ├── format.ts            # Display: distance, pace, duration, date
│   │   ├── geo.ts               # Haversine, elevation gain, splits, pace
│   │   └── gpx.ts               # GPX file builder + expo-sharing export
│   │
│   └── theme.ts                 # Design tokens: colors, spacing, typography
│
├── android/                     # Android native project (auto-generated by Expo)
├── ios/                         # iOS native project (auto-generated by Expo)
├── app.json                     # Expo config: bundle IDs, permissions, plugins
├── eas.json                     # EAS Build profiles with autoIncrement
├── babel.config.js
├── tsconfig.json
└── package.json
```

---

## Core Modules Explained

### `src/services/gpsFilter.ts` — GPS Reliability Pipeline

Raw GPS on mobile is noisy. This module runs every fix through 4 sequential gates before it touches any distance or pace calculation:

```
Raw GPS Fix
    │
    ▼
[1] Accuracy Gate     → drop if horizontal accuracy > 35 m
    │
    ▼
[2] Speed Gate        → drop if implied speed exceeds sport max
    │                   (run: 30 km/h, ride: 90 km/h, walk: 12 km/h)
    ▼
[3] Jitter Gate       → drop if movement < 2 m (standing still)
    │
    ▼
[4] EMA Smoothing     → exponential moving average (α=0.6) on lat/lng
    │                   removes GPS zig-zag without cutting real corners
    ▼
Accepted TrackPoint → added to recording state
```

**Auto-pause detection** (`isStationary`):
- Uses 8-second sliding window of recent fixes
- Prefers GPS-reported `speed` field when available
- Falls back to positional distance if speed is null
- Threshold: < 0.5 m/s average → trigger pause

### `src/store/recordingStore.ts` — Zustand Recording State

The single source of truth for an in-progress activity. Key design choices:

- `start()` calls `filter.reset()` — ensures a clean GPS filter state for each new activity
- `ingest(raw)` runs the GPS filter, appends the point, recomputes distance/elevation/pace
- `tick()` fires every 1s from the UI via `setInterval` — only increments `movingS` when `state === 'recording'`
- `finish()` persists to SQLite and resets state atomically
- The store is accessed outside React (`useRecordingStore.getState().ingest`) inside the background location task — this is why Zustand was chosen

### `src/db/database.ts` — SQLite with WAL Mode

```sql
CREATE TABLE activities (
  id                TEXT PRIMARY KEY,   -- "act_{startedAt}_{random}"
  sport             TEXT NOT NULL,
  title             TEXT NOT NULL,
  started_at        INTEGER NOT NULL,   -- unix epoch ms
  ended_at          INTEGER NOT NULL,
  elapsed_s         INTEGER NOT NULL,   -- total time including pauses
  moving_s          INTEGER NOT NULL,   -- time spent moving
  distance_m        INTEGER NOT NULL,   -- meters
  elevation_gain_m  INTEGER NOT NULL,   -- meters
  avg_pace_s_per_km INTEGER NOT NULL,
  visibility        TEXT DEFAULT 'private',
  points_json       TEXT NOT NULL,      -- JSON array of TrackPoint
  splits_json       TEXT NOT NULL,      -- JSON array of Split
  synced            INTEGER DEFAULT 0   -- cloud sync flag (future)
);
```

- **WAL mode** (`PRAGMA journal_mode = WAL`) — concurrent reads don't block writes. Critical during recording when the feed screen might be open
- `points_json` is stored as a JSON blob rather than a separate table — simplifies schema while keeping read performance acceptable for up to ~10,000 points per activity (~3h of running at 1 fix/sec)
- `synced = 0` flag is pre-built for future cloud sync without a migration

### `src/utils/geo.ts` — Geospatial Calculations

Pure TypeScript, no native module required:

- **`haversineM()`** — Great-circle distance between two lat/lng points using the haversine formula (accurate to < 0.5% for activity distances)
- **`elevationGainM()`** — Noise-threshold accumulator: only counts climbs once pending ascent exceeds 3m (matches Garmin/Strava methodology)
- **`computeSplits()`** — Segments the point array into per-km chunks; last partial split included if > 50 m
- **`rollingPaceSPerKm()`** — 30-second sliding window pace for the live "current pace" display (avoids showing spiky instantaneous pace)

### `src/utils/gpx.ts` — GPX Export

Generates a standard [GPX 1.1](https://www.topografix.com/GPX/1/1/) file from any saved activity:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Athlr" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Morning Run</name>
    <time>2026-06-11T09:30:00.000Z</time>
  </metadata>
  <trk>
    <name>Morning Run</name>
    <trkseg>
      <trkpt lat="..." lon="...">
        <ele>...</ele>
        <time>...</time>
      </trkpt>
      ...
    </trkseg>
  </trk>
</gpx>
```

Shared via `expo-sharing` — compatible with Strava, Komoot, Garmin Connect, Google Maps, and any GPX-aware tool.

---

## Data Model

```typescript
// A saved, completed workout
interface Activity {
  id: string;                    // "act_1718088000000_x7k2p1"
  sport: SportType;              // 'run' | 'ride' | 'walk' | 'hike'
  title: string;                 // "Morning Run"
  startedAt: number;             // unix epoch ms
  endedAt: number;
  elapsedS: number;              // total wall-clock seconds
  movingS: number;               // seconds actually moving
  distanceM: number;             // meters
  elevationGainM: number;        // meters
  avgPaceSPerKm: number;         // seconds per km (moving time ÷ km)
  visibility: 'private' | 'followers' | 'everyone';
  points: TrackPoint[];          // full GPS trace
  splits: Split[];               // per-km breakdown
}

// A single GPS fix (filtered)
interface TrackPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;       // meters above sea level
  accuracy: number | null;       // horizontal accuracy, meters
  speed: number | null;          // m/s (device-reported)
  timestamp: number;             // unix epoch ms
}

// One kilometer split
interface Split {
  index: number;                 // 1-based km number
  distanceM: number;             // actual distance (last may be partial)
  durationS: number;             // seconds for this split
  paceSPerKm: number;            // pace for this split
  elevationGainM: number;        // elevation climbed in this split
}
```

---

## GPS Pipeline

```
                    ┌─────────────────────────┐
                    │   expo-location          │
                    │   (background task)      │
                    │                          │
                    │  accuracy: BestForNav    │
                    │  timeInterval: 1000 ms   │
                    │  distanceInterval: 2 m   │
                    └────────────┬────────────┘
                                 │  raw LocationObject[]
                                 ▼
                    ┌─────────────────────────┐
                    │   locationService.ts     │
                    │   TaskManager handler    │
                    │                          │
                    │  toTrackPoint(loc) →     │
                    │  { lat, lng, alt,        │
                    │    accuracy, speed, ts } │
                    └────────────┬────────────┘
                                 │  TrackPoint
                                 ▼
                    ┌─────────────────────────┐
                    │   recordingStore.ts      │
                    │   ingest(raw)            │
                    │                          │
                    │  ┌─── GpsFilter ───┐    │
                    │  │ 1. accuracy     │    │
                    │  │ 2. speed gate   │    │
                    │  │ 3. jitter gate  │    │
                    │  │ 4. EMA smooth   │    │
                    │  └────────┬────────┘    │
                    │           │ accepted?    │
                    │           ▼              │
                    │  append to points[]      │
                    │  + haversineM → dist     │
                    │  + elevationGain         │
                    │  + rollingPace           │
                    │  + isStationary? → pause │
                    └────────────┬────────────┘
                                 │  store update
                                 ▼
                    ┌─────────────────────────┐
                    │   React UI              │
                    │   (Zustand selectors)   │
                    │                          │
                    │  MapView Polyline        │
                    │  Distance / Pace / Time  │
                    └─────────────────────────┘
```

### Background Recording on iOS & Android

| Platform | Mechanism |
|---|---|
| **Android** | `foregroundService` config in `startLocationUpdatesAsync` — shows a persistent notification ("Athlr is recording"). Required by Android since API 26 for reliable background execution |
| **iOS** | `UIBackgroundModes: ["location"]` in `Info.plist` + `NSLocationAlwaysAndWhenInUseUsageDescription` — CoreLocation keeps the app active in background |

---

## Monetization Strategy

Athlr is built with a **freemium** model in mind — all core features free forever, with optional premium upgrades.

### Free Tier (Always)

| Feature | Free |
|---|---|
| GPS recording (all sport types) | ✅ |
| Unlimited activities stored on-device | ✅ |
| Per-km splits | ✅ |
| GPX export | ✅ |
| Lifetime stats | ✅ |
| Auto-pause | ✅ |

### Athlr Pro (Planned — ~$3.99/month or $29.99/year)

| Feature | Pro |
|---|---|
| Cloud backup & sync across devices | ✅ |
| Training load & readiness score | ✅ |
| Heart rate zone analysis (BLE devices) | ✅ |
| AI activity insights ("Athlete Intelligence") | ✅ |
| Custom segment leaderboards | ✅ |
| Advanced route planning | ✅ |
| Watch app (Wear OS / watchOS) | ✅ |

### Revenue Channels

1. **In-app subscription** — Primary revenue. Managed via RevenueCat for cross-platform receipt validation, grace periods, and churn analytics
2. **EAS Build / OTA Updates** — Low infra cost via Expo's managed infrastructure
3. **Affiliate gear links** — Contextual "Gear used on this run" cards linked to affiliate products (running shoes, bikes). Non-intrusive, relevant
4. **Data insights (anonymised, opt-in)** — Aggregate heatmaps and popular routes sold to urban planners / city councils (à la Strava Metro). Strict opt-in only

### Anti-Patterns We Avoid

- ❌ No activity-count limit on free tier (Strava limits to 3 features)
- ❌ No ads in the recording flow (dangerous for athletes)
- ❌ No mandatory account creation — the app works fully offline
- ❌ No selling individual user data

---

## Roadmap

### v0.2 — UX Polish (in progress)
- [ ] Training Log calendar heatmap (4th tab)
- [ ] Sport picker expanded to 10+ types
- [ ] Pull-to-refresh on activity feed
- [ ] Inline activity title editing
- [ ] Live elevation gain tile on recording screen
- [ ] 3-2-1 countdown before recording starts
- [ ] Haptic feedback on start / stop

### v0.3 — Profile & Analytics
- [ ] User display name & avatar
- [ ] This week / this month stat breakdowns
- [ ] Pace chart on activity detail
- [ ] km ↔ miles unit toggle
- [ ] Share activity as image card

### v0.4 — Cloud (Optional)
- [ ] Firebase Auth (email + Apple Sign-In + Google)
- [ ] Firestore sync (activities marked `synced=0` are uploaded in background)
- [ ] Cross-device access
- [ ] Activity visibility enforcement via Firestore Security Rules

### v0.5 — Social
- [ ] Follow / unfollow athletes
- [ ] Kudos (Strava-style likes)
- [ ] Activity comments
- [ ] Friends' activity feed

### v1.0 — Pro Features
- [ ] RevenueCat subscription integration
- [ ] BLE heart rate monitor support
- [ ] AI workout insights
- [ ] Route discovery ("popular nearby routes")

---

## Getting Started (Developer Guide)

### Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18+ |
| Xcode (macOS only, for iOS) | 15+ |
| Android Studio | Hedgehog+ |
| Expo CLI | via `npx expo` |
| EAS CLI | `npm i -g eas-cli` |

### 1. Clone & Install

```bash
git clone https://github.com/drdhavaltrivedi/athlr.git
cd athlr
npm install
```

### 2. Run in Expo Go (Quick Start)

> ⚠️ Background location and the foreground-service notification are **not available** in Expo Go. Use this for UI work only.

```bash
npx expo start
```

Scan the QR code with the Expo Go app on your device.

### 3. Run on Physical Device (Full GPS Features)

For background GPS to work you **must** run a native development build:

```bash
# iOS
npx expo run:ios --device

# Android
npx expo run:android --device
```

This builds a full native app with all permissions and installs it on your connected device.

### 4. Requesting Location Permissions

The app requests permissions in two steps:

1. **Foreground** (`requestForegroundPermissionsAsync`) — required to start recording
2. **Background** (`requestBackgroundPermissionsAsync`) — required for screen-off tracking

On iOS, you must select **"Allow While Using App"** first, then the system will ask for "Always Allow" separately.

On Android 10+, the user must manually go to Settings → App Info → Location → "Allow all the time".

### Environment Variables

No `.env` file required for core features. When cloud features are added, a `FIREBASE_CONFIG` will be needed (documented separately).

### TypeScript Checks

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
```

---

## Building & Releasing

### EAS Build Profiles

Defined in [`eas.json`](./eas.json):

| Profile | Use case | Distribution |
|---|---|---|
| `development` | Daily dev builds | Internal (your devices) |
| `preview` | QA / TestFlight / Firebase App Distribution | Internal |
| `production` | App Store / Play Store submission | Public |

All profiles have `"autoIncrement": true` — EAS automatically bumps `buildNumber` (iOS) and `versionCode` (Android) on every build. **You never manually edit these.**

### Create a Build

```bash
# Install EAS CLI
npm i -g eas-cli

# Login (uses drdhavaltrivedi account)
eas login

# Development build (for device testing)
eas build --platform ios --profile development
eas build --platform android --profile development

# Production build
eas build --platform all --profile production
```

### Submit to Stores

```bash
# iOS → App Store Connect
eas submit --platform ios

# Android → Google Play
eas submit --platform android
```

Fill in the `submit.production` block in `eas.json` with your Apple Team ID and Android Service Account key path before running.

### App IDs

| Platform | Bundle / Package ID |
|---|---|
| iOS | `com.brilwors.athlr` |
| Android | `com.brilwors.athlr` |

---

## Contributing

### Branch Strategy

```
main          → always production-ready
feature/*     → new features (PR into main)
fix/*         → bug fixes
chore/*       → tooling, deps, refactors
```

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add training log calendar tab
fix: movingS increments during auto-pause (closes #12)
chore: bump expo-sqlite to 15.1.4
docs: update GPS pipeline diagram
```

### Pull Request Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] Tested on a physical device (not just simulator) for GPS-related changes
- [ ] Added/updated JSDoc on public functions
- [ ] Updated this README if architecture changed

---

## Privacy

- **No analytics SDKs** — no Amplitude, no Mixpanel, no Firebase Analytics (yet)
- **No crash reporting** — no Sentry, no Crashlytics (yet)
- **No network calls** — the app makes zero HTTP requests in its current state
- **Data portability** — GPX export works for every activity, always free
- **Permissions** — only `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION`; no contacts, camera, microphone, or notifications (except the foreground service notification)

Full Privacy Policy: _to be published at https://athlr.app/privacy_

---

## License

MIT © 2026 [drdhavaltrivedi](https://github.com/drdhavaltrivedi)

---

<div align="center">
Built with ❤️ and 🏃 by the Athlr team
</div>
