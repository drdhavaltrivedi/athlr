# Tempo

A privacy-first GPS activity tracker for running, cycling, walking and hiking.
Built with React Native (Expo) + TypeScript.

## Positioning (vs. incumbents)

| Incumbent weakness | Tempo's answer |
| --- | --- |
| Paywall creep — free features keep moving behind subscription | Core tracking + analytics free forever; clear, stable premium line |
| GPS bugs: routes through lakes, inflated distance, flaky auto-pause | Dedicated GPS filter layer (accuracy/speed/jitter gates + smoothing) |
| Privacy: routes reveal where you live | **Private by default**, planned home-zone blur, on-device storage |
| Closed API, data lock-in | Free GPX export built into v0.1; open API planned |
| No customer support | In-app support channel planned with response-time SLA |

## What's implemented (v0.1 scaffold)

- **Record screen** — live map with route polyline, giant distance/time/pace
  stats, sport picker (run / ride / walk / hike), start / pause / resume /
  finish, keep-awake while recording.
- **Background tracking** — `expo-location` + `expo-task-manager` with an
  Android foreground service so recording survives screen-off.
- **GPS reliability layer** (`src/services/gpsFilter.ts`) — accuracy gate,
  sport-aware speed gate (no teleporting across lakes), stationary jitter
  gate, exponential smoothing, auto-pause detection.
- **Offline-first storage** — every activity saved to on-device SQLite;
  no network required, ever. Schema includes a `synced` flag ready for
  cloud sync later.
- **Activity detail** — fitted route map, stat grid, per-km splits with
  pace bars, GPX export via the share sheet, delete.
- **Profile** — lifetime stats, auto-pause toggle, the privacy promise.
- **Privacy** — activities are `private` by default at the data-model level.

## Project structure

```
app/                    # expo-router screens
  (tabs)/index.tsx      # activity list
  (tabs)/record.tsx     # recording screen
  (tabs)/profile.tsx    # stats + settings
  activity/[id].tsx     # activity detail
src/
  services/
    locationService.ts  # background GPS (swap-in point for Transistorsoft)
    gpsFilter.ts        # reliability layer
  store/recordingStore.ts  # zustand live-recording state machine
  db/database.ts        # SQLite offline storage
  utils/geo.ts          # haversine, splits, elevation gain, rolling pace
  utils/gpx.ts          # GPX export
  utils/format.ts       # pace/distance/duration formatting
  theme.ts              # design tokens
  types/index.ts        # domain types
```

## Running it

Background location requires native modules, so use a **dev build** (not Expo Go):

```bash
npm install
npx expo prebuild
npx expo run:android   # or: npx expo run:ios (needs macOS + Xcode)
```

For iOS maps no key is needed (Apple Maps). For Google Maps on Android,
add an API key under `android.config.googleMaps.apiKey` in `app.json`,
or keep the default OS map provider.

> Tip: test GPS in an emulator with a GPX route
> (Android Studio → Extended Controls → Location → Routes).

## Roadmap

**Phase 2 — accounts & social**
- Backend (NestJS or Supabase; PostgreSQL + PostGIS), auth (Apple/Google)
- Cloud sync of the local SQLite store (the `synced` flag is already there)
- Follows, feed, kudos, comments; visibility controls per activity
- Home-zone blur: auto-hide a radius around saved private places

**Phase 3 — training & premium**
- Weekly/monthly trends, personal records, training load
- Friend-group challenges and ghost-racing your own past efforts
  (note: avoid cloning segments/heatmaps 1:1 — there is active patent
  litigation in this space; get legal review first)
- HealthKit / Health Connect import, heart-rate sensors via BLE
- Premium tier: AI insights, training plans, route builder

**Production hardening**
- Swap `expo-location` for `react-native-background-geolocation`
  (Transistorsoft) — `locationService.ts` is the single swap point
- Crash reporting (Sentry), analytics, E2E tests (Maestro)
- Battery profiling on low-end Android devices
