# iTaxiBcn - Architecture & CTO Analysis Document

> **Last Updated:** January 2026
> **Purpose:** Deep technical analysis for all agents and developers working on this codebase

---

## Executive Summary

iTaxiBcn is a **hybrid mobile/web taxi intelligence platform** for Barcelona taxi drivers. Built with React + Capacitor, it provides real-time location tracking, geofencing, waiting time analytics, and smart destination recommendations.

**Tech Stack:** React 18 | Capacitor 6 | Supabase | TypeScript | Tailwind CSS | Shadcn UI

**Current State:** Beta - Core features working, needs hardening for production

**Overall Score:** 6.5/10

---

## Table of Contents

1. [Application Structure](#1-application-structure)
2. [Database Schema](#2-database-schema)
3. [Core Services](#3-core-services)
4. [Native Mobile Implementation](#4-native-mobile-implementation)
5. [UI Components](#5-ui-components)
6. [Critical Issues](#6-critical-issues)
7. [Missing Features](#7-missing-features)
8. [Performance Considerations](#8-performance-considerations)
9. [Security Assessment](#9-security-assessment)
10. [Recommended Improvements](#10-recommended-improvements)

---

## 1. Application Structure

```
project-foundation/
├── src/
│   ├── pages/              # 3 main pages (Index, Admin, NotFound)
│   ├── components/
│   │   ├── ui/             # 48 Shadcn UI components
│   │   ├── views/          # 11 dashboard views
│   │   ├── widgets/        # Reusable widget components
│   │   └── layout/         # Header, BottomNav, etc.
│   ├── services/
│   │   ├── location/       # AutoLocationService, diagnostics
│   │   └── native/         # Capacitor plugin wrappers
│   ├── hooks/              # React hooks (useEarnings, useWaitingTimes, etc.)
│   ├── lib/                # Utilities (deviceId, utils)
│   └── integrations/       # Supabase client & types
├── android-plugin/         # Custom native Android code
│   └── tracking/           # ForegroundService, AlarmReceiver
├── supabase/
│   ├── functions/          # Edge functions (check-geofence)
│   └── migrations/         # Database schema
├── android/                # Capacitor Android project
└── public/                 # Static data (vuelos.json, trenes.json)
```

### Pages & Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Index | Main dashboard hub with 11 switchable views |
| `/admin` | Admin | Developer testing & diagnostics (password protected) |
| `*` | NotFound | 404 error page |

### Dashboard Views (within Index)

1. **DashboardView** - Main hub with terminal cards, trains, events
2. **FlightsView** - Full flight arrivals/departures table
3. **TrainsFullDayView** - 23-hour train timeline
4. **TrainsByCityView** - Trains filtered by destination
5. **TrainsByOperatorView** - Trains filtered by operator
6. **EventsView** - Barcelona events calendar
7. **LicensesView** - Taxi license market analysis
8. **EarningsView** - Driver income tracking
9. **AlertsView** - Notification preferences
10. **TerminalDetailView** - Deep dive into specific terminal
11. **FullDayView** - Flight timeline by hour

---

## 2. Database Schema

### Supabase Tables

#### `registros_reten` (Waiting/Queue Records)
```sql
- id: UUID PRIMARY KEY
- device_id: TEXT                    -- Device identifier (D1, D2, etc.)
- zona: TEXT NOT NULL                -- Zone name (T1, T2, SANTS, PUENTE_AEREO, T2C_EASY)
- tipo_zona: TEXT DEFAULT 'aeropuerto'
- evento: TEXT NOT NULL              -- ENTRADA or SALIDA
- lat: DOUBLE PRECISION NOT NULL
- lng: DOUBLE PRECISION NOT NULL
- created_at: TIMESTAMPTZ            -- Entry time
- exited_at: TIMESTAMPTZ             -- Exit time (NULL = still waiting)
```
**Purpose:** Track when drivers enter/exit zones, calculate waiting times

#### `registros_carreras` (Earnings Records)
```sql
- id: UUID PRIMARY KEY
- device_id: TEXT
- importe: DECIMAL                   -- Fare amount
- propina: DECIMAL                   -- Tip amount
- metodo_pago: TEXT                  -- efectivo/tarjeta
- zona: TEXT                         -- Zone context
- created_at: TIMESTAMPTZ
```
**Purpose:** Driver earnings logging and analytics

#### `geofence_logs` (Debug/Analytics)
```sql
- id: UUID PRIMARY KEY
- event_type: TEXT                   -- ENTER_ZONE, EXIT_ZONE, POSITION_UPDATE, ZONE_CHANGE
- zona: TEXT
- previous_zona: TEXT
- lat, lng: DOUBLE PRECISION
- accuracy: DOUBLE PRECISION
- device_id: TEXT
- device_name: TEXT
- created_at: TIMESTAMPTZ
```
**Purpose:** Detailed event logging for development and analytics

#### `location_debug_logs` (Native Service Diagnostics)
```sql
- id: UUID PRIMARY KEY
- device_id: TEXT
- device_name: TEXT
- event_type: TEXT                   -- location_received, error, service_start, etc.
- message: TEXT
- latitude, longitude: DECIMAL
- accuracy: REAL
- is_background: BOOLEAN
- app_state: TEXT                    -- foreground/background
- battery_level: INTEGER
- created_at: TIMESTAMPTZ
```
**Purpose:** Troubleshoot background tracking failures

#### `device_registry` (Device Identification)
```sql
- id: SERIAL PRIMARY KEY
- device_uuid: TEXT UNIQUE           -- Internal UUID
- device_number: INTEGER UNIQUE      -- Simple number (1, 2, 3...)
- device_name: TEXT
- created_at, last_seen_at: TIMESTAMPTZ
```
**Purpose:** Assign simple device IDs (D1, D2, D3) instead of UUIDs

---

## 3. Core Services

### Location Tracking Services

#### `AutoLocationService.ts`
- **Purpose:** Web-based location tracking with zone detection
- **Interval:** 60 seconds between checks
- **Features:**
  - Browser Geolocation API on web
  - Throttling to prevent spam
  - Testing mode for simulation
  - Zone detection via edge function

#### `backgroundGeolocation.ts`
- **Purpose:** Continuous tracking when app backgrounded (Android)
- **Tech:** @capacitor-community/background-geolocation
- **Features:**
  - 50m distance filter
  - 60s minimum interval
  - WakeLock + WiFiLock management
  - Battery optimization exclusion

#### `proTracking.ts`
- **Purpose:** Enterprise-grade native tracking
- **Tech:** Custom ForegroundService + AlarmManager
- **Features:**
  - Survives Doze mode
  - Direct HTTP to Supabase (bypasses WebView)
  - 60-second intervals

### Edge Functions

#### `check-geofence` (supabase/functions/check-geofence/index.ts)
**Purpose:** Core geofencing engine

**Zone Definitions (5 zones):**
- T1 - Terminal 1 (Airport)
- T2 - Terminal 2 (Airport)
- SANTS - Sants Train Station
- PUENTE_AEREO - Puente Aéreo
- T2C_EASY - T2C Easy Parking

**Algorithm:**
1. Ray-casting for point-in-polygon detection
2. 100m tolerance buffer at boundaries
3. State machine: ENTER_ZONE, EXIT_ZONE, ZONE_CHANGE, POSITION_UPDATE
4. Rate limiting: 1 entry per zone per 5 minutes

**Response:**
```json
{
  "success": true,
  "zona": "T1" | null,
  "message": "✅ T1" | "📍 Fuera de zonas"
}
```

### React Hooks

| Hook | Purpose | Refresh |
|------|---------|---------|
| `useEarnings` | Fetch/add earnings records | On demand |
| `useWaitingTimes` | Calculate zone wait times from registros_reten | 2 minutes |
| `useEvents` | Load Barcelona events from static JSON | Never (static) |
| `useWeather` | OpenMeteo weather API | 15 minutes |
| `useWhereNext` | Smart destination recommendations | 5 minutes |

#### `useWhereNext` Scoring Algorithm (0-100 points)
```
Base: 40 points
+ Upcoming arrivals (0-35): ≥5 flights/trains = +35
+ Wait time (0-20): ≤10 min = +20, >45 min = -10
+ Competition (0-15 or -8): 0 taxis = +15, >30 taxis = -8
+ Distance (-10 to 0): >30 min away = -10
```

---

## 4. Native Mobile Implementation

### Android Plugin Structure

```
android-plugin/
├── BatteryOptimizationPlugin.java     # WakeLock, WiFiLock, battery settings
├── ProLocationTrackingPlugin.java     # Capacitor bridge for tracking
└── tracking/
    ├── LocationTrackingService.java   # ForegroundService (main)
    ├── LocationApiClient.java         # Direct HTTP to Supabase
    ├── AlarmReceiver.java             # Doze mode alarm handler
    └── ProTrackingPlugin.java         # Plugin registration
```

### LocationTrackingService.java
- **Type:** Android ForegroundService with persistent notification
- **Location Provider:** FusedLocationProviderClient (Google Play Services)
- **Update Interval:** 60 seconds
- **Fastest Interval:** 30 seconds
- **Doze Resistance:** AlarmManager.setExactAndAllowWhileIdle()
- **Locks:** PARTIAL_WAKE_LOCK + WiFiLock

### Required Android Permissions
```xml
ACCESS_FINE_LOCATION
ACCESS_COARSE_LOCATION
ACCESS_BACKGROUND_LOCATION (Android 10+)
FOREGROUND_SERVICE
FOREGROUND_SERVICE_LOCATION (Android 14+)
WAKE_LOCK
REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
SCHEDULE_EXACT_ALARM
POST_NOTIFICATIONS (Android 13+)
INTERNET
```

### iOS Status
- **Current:** Not implemented (web-only on iOS)
- **Needed:** CLLocationManager, background modes, APNS

---

## 5. UI Components

### Design System
- **Component Library:** Shadcn UI (48 components)
- **Styling:** Tailwind CSS 3.4.17
- **Theme:** Dark-first with golden primary (#FACC15)
- **Fonts:** Space Grotesk (headers) + Inter (body)
- **Icons:** Lucide React

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| BottomNav | `components/layout/BottomNav.tsx` | Mobile navigation (5 items) |
| Header | `components/layout/Header.tsx` | Top bar with weather, settings |
| QuickStats | `components/widgets/QuickStats.tsx` | 4-stat summary grid |
| TerminalCard | `components/widgets/TerminalCard.tsx` | Zone badge |
| WhereNextSheet | `components/widgets/WhereNextSheet.tsx` | Recommendation overlay |
| QuickEarningsSheet | `components/widgets/QuickEarningsSheet.tsx` | Fast fare entry |
| LocationDiagnosticsPanel | `components/LocationDiagnosticsPanel.tsx` | Debug panel |
| NativeDebugLogsPanel | `components/NativeDebugLogsPanel.tsx` | Service logs |

### Responsive Breakpoints
- `sm`: 640px
- `md`: 768px (used extensively)
- `lg`: 1024px
- `2xl`: 1400px

---

## 6. Critical Issues

### P0 - Must Fix Immediately

#### 1. Hardcoded Admin Password
- **File:** `src/pages/Admin.tsx:20`
- **Code:** `const ADMIN_PASSWORD = "laraabel22"`
- **Risk:** Security vulnerability
- **Fix:** Environment variable + proper auth

#### 2. No Offline Queue
- **Files:** `LocationApiClient.java`, `backgroundGeolocation.ts`
- **Issue:** Location data lost during network outages
- **Impact:** Gaps in tracking when in tunnels/poor coverage
- **Fix:** Room database with background sync

#### 3. WakeLock Never Released
- **File:** `LocationTrackingService.java:76-79`
- **Issue:** Battery drain 15-25%/hour
- **Fix:** Periodic release/reacquire strategy

#### 4. No Error States
- **Issue:** Failed data fetches show empty screens
- **Fix:** Error boundaries, retry buttons

#### 5. No User Authentication
- **Issue:** Device-based only, data can be spoofed
- **Fix:** Supabase Auth integration

---

## 7. Missing Features

### Critical for Production

1. **User Authentication** - Login, session management
2. **Offline-First Architecture** - Local cache, sync queue
3. **Push Notifications** - Flight alerts, wait time alerts
4. **Error Tracking** - Sentry integration
5. **Rate Limiting** - Prevent API abuse

### Driver Experience

6. **Driver Status** - On/off duty toggle
7. **Ride Tracking** - Start/end ride, fare calculation
8. **Earnings Export** - CSV/PDF reports
9. **Tax Estimation** - Based on logged earnings
10. **Route History** - Past trip playback

### Intelligence

11. **Demand Prediction** - ML-based peak hour forecasting
12. **Real-Time Heatmap** - Active driver distribution
13. **Smart Alerts** - Proactive recommendations
14. **Voice Commands** - Hands-free operation

### Platform

15. **iOS Implementation** - Full native support
16. **Analytics Dashboard** - Admin metrics
17. **Multi-Language** - Currently Spanish only

---

## 8. Performance Considerations

### Current Bottlenecks

1. **Waiting Times Query** - Full table scan every 2 minutes
   - **Fix:** Materialized view for zone aggregations

2. **No List Virtualization** - 50+ flights cause scroll lag
   - **Fix:** react-window for long lists

3. **No Code Splitting** - All views bundled (~500KB)
   - **Fix:** Lazy load routes

4. **Static Data Re-fetched** - vuelos.json on every load
   - **Fix:** HTTP caching headers

### Battery Optimization Gaps

- Same tracking at 5% battery as 95%
- WiFi lock drains battery unnecessarily
- No adaptive polling based on movement

### Recommended Optimizations

1. Lazy load Admin page and detail views
2. Virtualize flight/train lists with >20 items
3. Implement battery-aware tracking intervals
4. Add stale-while-revalidate caching
5. Use SVG instead of PNG for logo

---

## 9. Security Assessment

### Strengths
- ✅ API keys in environment variables
- ✅ HTTPS enforced
- ✅ RLS policies on tables
- ✅ Input validation in edge function

### Weaknesses
- ❌ Hardcoded admin password
- ❌ No user authentication
- ❌ No request signing (HMAC)
- ❌ No rate limiting
- ❌ No certificate pinning
- ❌ Location data stored indefinitely

### Recommendations

1. **Implement Supabase Auth** - Link earnings to users
2. **Move admin password** - To environment variable
3. **Add rate limiting** - 1 req/device/30s on geofence
4. **Data retention policy** - Auto-delete logs >90 days
5. **GDPR compliance** - Consent flow, data export

---

## 10. Recommended Improvements

### Phase 1: Critical Fixes (Week 1-2)
1. Remove hardcoded admin password
2. Add error states with retry buttons
3. Fix WakeLock battery drain
4. Add network state monitoring
5. Add BOOT_COMPLETED receiver

### Phase 2: Core Features (Week 3-6)
6. Implement Supabase Auth
7. Add offline queue system
8. Implement push notifications
9. URL-based routing
10. Driver status system

### Phase 3: Intelligence (Week 7-10)
11. Earnings dashboard enhancements
12. Real-time taxi heatmap
13. Smart alerts system
14. Basic demand prediction

### Phase 4: Polish (Week 11-14)
15. Accessibility audit
16. Performance optimizations
17. iOS implementation start
18. Analytics dashboard

---

## Quick Reference

### Environment Variables
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

### Key File Locations
- **Main App:** `src/App.tsx`
- **Dashboard:** `src/pages/Index.tsx`
- **Admin:** `src/pages/Admin.tsx`
- **Geofence Logic:** `supabase/functions/check-geofence/index.ts`
- **Native Tracking:** `android-plugin/tracking/LocationTrackingService.java`
- **Device ID:** `src/lib/deviceId.ts`

### Commands
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npx cap sync         # Sync Capacitor
npx cap open android # Open Android Studio
```

### Admin Access
- **URL:** `/admin`
- **Password:** (check environment variables)

---

## Changelog

| Date | Change |
|------|--------|
| Jan 2026 | Initial CTO analysis document created |
| Jan 2026 | Auto-start tracking implemented |
| Jan 2026 | Simple device ID system (D1, D2, D3) added |
| Jan 2026 | Tracking interval changed to 60 seconds |
