# Sistema de Tracking y Colas — iTaxi BCN

Documentación técnica completa del sistema de geolocalización, detección de zonas y cálculo de tiempos de espera.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Zonas activas](#2-zonas-activas)
3. [Arquitectura del sistema](#3-arquitectura-del-sistema)
4. [Capa de localización (frontend)](#4-capa-de-localización-frontend)
5. [Edge Function: check-geofence](#5-edge-function-check-geofence)
6. [Función RPC: fn_process_geofence_event](#6-función-rpc-fn_process_geofence_event)
7. [Máquina de estados](#7-máquina-de-estados)
8. [Tablas de base de datos](#8-tablas-de-base-de-datos)
9. [Cálculo de tiempos de espera](#9-cálculo-de-tiempos-de-espera)
10. [Cálculo de demanda](#10-cálculo-de-demanda)
11. [Dashboard](#11-dashboard)
12. [Configuración y constantes](#12-configuración-y-constantes)
13. [Historial de bugs críticos](#13-historial-de-bugs-críticos)

---

## 1. Visión general

El sistema rastrea en tiempo real cuántos taxistas hay en cada zona de retén del aeropuerto y la estación de Sants. Con esos datos calcula el tiempo de espera estimado en cola y lo muestra en el dashboard junto con la demanda prevista de pasajeros.

**Flujo de datos completo:**

```
App del taxista (móvil)
        │
        │  GPS coords cada ~60s
        ▼
AutoLocationService / backgroundGeolocation
        │
        │  POST {lat, lng, deviceId, accuracy}
        ▼
Edge Function: check-geofence
        │
        │  RPC call
        ▼
fn_process_geofence_event (PostgreSQL)
        │
        ├─► registros_reten (sesiones abiertas/cerradas)
        └─► geofence_logs (auditoría de eventos)
                │
                ▼
        useWaitingTimes hook (frontend)
                │
                ▼
        Dashboard → TerminalCard (tiempos de espera)
```

---

## 2. Zonas activas

| Slug | Nombre | Polígonos | Descripción |
|------|--------|-----------|-------------|
| `T1` | Terminal 1 | 2 | Zona espera T1 + acceso peatonal |
| `T2` | Terminal 2 | 2 | Zona espera T2 principal + cola lateral |
| `T2C_EASY` | T2C Easy | 1 | Zona Easy/lowcost T2C |
| `PUENTE_AEREO` | Puente Aéreo | 1 | Retén puente aéreo BCN-MAD |
| `SANTS` | Estació de Sants | 1 | Retén estación Sants |

Cada zona puede tener **múltiples polígonos** en la tabla `zones` con el mismo `name`. Todos cuentan como la misma zona lógica.

### Coordenadas de los polígonos

**T1 — Polígono 1** (zona espera principal):
```
(41.293414, 2.052955) → (41.291480, 2.054785) → (41.291050, 2.057731)
→ (41.292576, 2.056044) → (41.293693, 2.054042)
```

**T1 — Polígono 2** (acceso):
```
(41.287015, 2.073812) → (41.287235, 2.074420) → (41.289890, 2.072795)
→ (41.289614, 2.072155)
```

**T2 — Polígono 1** (zona principal):
```
(41.304277, 2.067179) → (41.302540, 2.068124) → (41.303069, 2.069830)
→ (41.304828, 2.068744)
```

**T2 — Polígono 2** (cola lateral):
```
(41.301671, 2.071621) → (41.301226, 2.071903) → (41.302190, 2.074682)
→ (41.302677, 2.074442)
```

**PUENTE_AEREO:**
```
(41.289950, 2.073030) → (41.290620, 2.072616) → (41.289648, 2.069489)
→ (41.288922, 2.069853)
```

**T2C_EASY:**
```
(41.305257, 2.080754) → (41.304074, 2.081675) → (41.304576, 2.083332)
→ (41.305782, 2.082448) → (41.305118, 2.081675)
```

**SANTS:**
```
(41.3805, 2.1415) → (41.3805, 2.1390) → (41.3785, 2.1390) → (41.3785, 2.1415)
```

### Detección de zona (punto-en-polígono)

Los polígonos se almacenan como GeoJSON en `zones.polygon` (formato `[lng, lat]`). La función RPC los convierte al tipo nativo PostgreSQL `polygon` (formato `(lat, lng)`) mediante el helper `_geojson_to_polygon()` y usa el operador `@>` para comprobar si un punto está dentro.

Cuando un punto cae en **múltiples zonas** (solapamiento), gana la zona cuyo polígono tiene **menos vértices** (proxy de zona más pequeña/específica).

```sql
SELECT z.name
FROM public.zones z
WHERE z.polygon IS NOT NULL
  AND z.project = 'itaxi'
  AND _geojson_to_polygon(z.polygon) @> point(p_lat, p_lng)
ORDER BY jsonb_array_length(z.polygon->'coordinates'->0) ASC
LIMIT 1;
```

---

## 3. Arquitectura del sistema

```
┌─────────────────────────────────────────────────────────┐
│                     APP (Capacitor)                      │
│                                                         │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │  AutoLocationService │  │ backgroundGeolocation    │  │
│  │  (Web / fallback)    │  │ (Android/iOS nativo)     │  │
│  └──────────┬──────────┘  └────────────┬─────────────┘  │
│             └──────────────────────────┘                 │
│                          │                               │
│               throttle: 60 segundos                      │
└──────────────────────────┼──────────────────────────────┘
                           │ HTTPS POST
                           ▼
┌─────────────────────────────────────────────────────────┐
│              SUPABASE EDGE FUNCTION                      │
│                 check-geofence                           │
│                                                         │
│  • Rate limit: 10 req / 30s por device                  │
│  • Valida parámetros                                     │
│  • Llama RPC fn_process_geofence_event                  │
└──────────────────────────┬──────────────────────────────┘
                           │ RPC call
                           ▼
┌─────────────────────────────────────────────────────────┐
│              POSTGRESQL (Supabase)                       │
│         fn_process_geofence_event()                      │
│                                                         │
│  1. Filtra accuracy > 100m (LOW_ACCURACY)               │
│  2. Detecta zona con operador @>                        │
│  3. Limpia sesiones zombie (> 3h)                       │
│  4. Ejecuta máquina de estados                          │
│  5. Escribe en registros_reten                          │
│  6. Escribe en geofence_logs                            │
└─────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
   registros_reten              geofence_logs
   (sesiones activas)           (auditoría)
              │
              ▼
   useWaitingTimes hook
   (frontend, cada 2 min)
              │
              ▼
   Dashboard → TerminalCards
```

---

## 4. Capa de localización (frontend)

### AutoLocationService (`src/services/location/AutoLocationService.ts`)

Servicio para web y fallback cuando no hay plataforma nativa disponible.

**Comportamiento:**
- Usa `navigator.geolocation.watchPosition()` para detectar movimiento
- Throttle de **60 segundos** entre llamadas al backend (aunque el GPS actualice más rápido)
- `enableHighAccuracy: true`, timeout 15s, maximumAge 30s
- Persiste la última zona en `localStorage` via `getItem/setItem`

**Parámetros que envía a la Edge Function:**
```typescript
{
  lat: number,
  lng: number,
  action: 'register',
  deviceId: string,       // UUID único por dispositivo
  previousZona: string,   // Última zona conocida (informativo)
  accuracy: number,       // Metros de precisión GPS
  deviceName: string,     // Nombre legible (ej: "D24")
  isBackground: boolean   // Si el documento está en background
}
```

**Respuesta que procesa:**
```typescript
{
  success: boolean,
  status: 'STAY' | 'ENTER' | 'EXIT' | 'ZONE_CHANGE' | 'PENDING_EXIT' |
          'RETURNED' | 'RESURRECT' | 'LOW_ACCURACY' | 'OUTSIDE',
  zona: string | null,
  from_zona?: string
}
```

### backgroundGeolocation (`src/services/native/backgroundGeolocation.ts`)

Servicio nativo para Android/iOS usando el plugin `@capacitor-community/background-geolocation`.

**Diferencias respecto al web:**
- Funciona con la app en segundo plano
- Solicita WakeLock y WifiLock para evitar que el SO mate el proceso
- Solicita exclusión de optimización de batería en Android
- Muestra notificación persistente de foreground service
- Registra todos los eventos en `location_debug_logs` para debugging
- Misma lógica de throttle de 60 segundos

---

## 5. Edge Function: check-geofence

**Archivo:** `supabase/functions/check-geofence/index.ts`

### Rate limiting

Implementado en memoria de la Edge Function (no en DB). Map por `deviceId`:
- Ventana: 30 segundos
- Máximo: 10 requests por ventana
- Si se supera: HTTP 429 con `retryAfter` en segundos

### Flujo

```
1. OPTIONS → CORS preflight response
2. Parse body (con normalización de JSON malformado)
3. action === 'ping' → health check response
4. Verificar deviceId presente
5. Comprobar rate limit
6. Crear cliente Supabase con SERVICE_ROLE_KEY
7. Llamar RPC fn_process_geofence_event
8. Retornar resultado del RPC directamente
```

### Variables de entorno requeridas

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (bypasea RLS) |

---

## 6. Función RPC: fn_process_geofence_event

**Signatura:**
```sql
fn_process_geofence_event(
    p_device_id  TEXT,
    p_lat        DOUBLE PRECISION,
    p_lng        DOUBLE PRECISION,
    p_accuracy   DOUBLE PRECISION DEFAULT 0
) RETURNS JSONB
```

**Seguridad:** `SECURITY DEFINER` — se ejecuta con permisos del propietario, no del llamante. Permite que la Edge Function (anon/service role) escriba en tablas protegidas.

### Pasos de ejecución

```
A. Rechazar GPS de baja precisión (> 100m) → LOW_ACCURACY
B. Detectar zona actual (punto-en-polígono, zona más pequeña gana)
C. Limpiar sesiones zombie (abiertas > 3 horas)
D. Obtener sesión abierta actual del device (usando FOUND, no IS NOT NULL)
E. Si no hay sesión abierta, buscar sesión cerrada reciente (< 5 min)
F. Ejecutar máquina de estados → resultado JSONB
```

### Por qué se usa FOUND en vez de IS NOT NULL

En PL/pgSQL, `SELECT * INTO v_record FROM ... WHERE ...` puede encontrar un registro pero aun así devolver un record con todos los campos en NULL si la fila existe pero los campos son NULL. La variable `FOUND` se establece a `TRUE` por PostgreSQL después de cualquier `SELECT INTO` que devuelva al menos una fila, independientemente de los valores.

```sql
-- MAL ❌
IF v_current_session IS NOT NULL THEN ...

-- BIEN ✅
v_has_current_session := FOUND;
IF v_has_current_session THEN ...
```

---

## 7. Máquina de estados

### Estados posibles

| Estado | Descripción | Escribe en DB |
|--------|-------------|---------------|
| `LOW_ACCURACY` | GPS > 100m, ignorado | No |
| `ENTER` | Nueva entrada en zona | `registros_reten` (nuevo), `geofence_logs` |
| `STAY` | Sigue en la misma zona | No |
| `RETURNED` | Volvió antes de confirmar salida | Cancela `pending_exit_at` |
| `PENDING_EXIT` | Salió, esperando 3 min para confirmar | Escribe `pending_exit_at` |
| `EXIT` | Salida confirmada (3 min fuera) | Cierra sesión con `exited_at`, `geofence_logs` |
| `ZONE_CHANGE` | Cambio directo de zona | Cierra sesión anterior, abre nueva, `geofence_logs` |
| `RESURRECT` | Volvió dentro de 5 min tras salir | Reabre sesión (exited_at → NULL) |
| `OUTSIDE` | Fuera de todas las zonas, sin sesión | No |

### Diagrama de transiciones

```
                    ┌─────────────┐
                    │   OUTSIDE   │
                    └──────┬──────┘
                           │ entra en zona
                           ▼
                    ┌─────────────┐
              ┌────►│    ENTER    │◄────────────────┐
              │     └──────┬──────┘                 │
              │            │ sigue en zona          │
              │            ▼                        │
     RESURRECT│     ┌─────────────┐                 │
     (< 5 min)│     │    STAY     │                 │ENTER
              │     └──────┬──────┘                 │(nueva zona)
              │            │ sale de zona           │
              │            ▼                        │
              │     ┌──────────────┐      ┌─────────┴──────┐
              │     │ PENDING_EXIT │      │  ZONE_CHANGE   │
              │     └──────┬───────┘      └────────────────┘
              │            │                    ▲
              │      vuelve│               salta│
              │      < 3min│               directo
              │            ├──────────────────► ┘
              │            │ fuera > 3 min
              │            ▼
              │     ┌─────────────┐
              └─────│    EXIT     │
         (si vuelve │             │
          < 5 min)  └─────────────┘
```

### Caso PENDING_EXIT en detalle

Cuando el device sale de una zona, la función **no cierra la sesión inmediatamente**. En su lugar marca el timestamp de posible salida:

```
1er ping fuera → pending_exit_at = now()       → status: PENDING_EXIT
2o ping fuera  → pending_exit_at < now() - 3min → status: EXIT (se cierra sesión)
                                                   exited_at = pending_exit_at (no now())
ping dentro    → pending_exit_at = NULL         → status: RETURNED
```

Esto evita que un GPS que "salta" fuera del polígono momentáneamente cierre la sesión.

---

## 8. Tablas de base de datos

### `registros_reten` — Sesiones de retén

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | Identificador único |
| `device_id` | TEXT | ID único del dispositivo |
| `zona` | TEXT | Slug de la zona (ej: "T2") |
| `tipo_zona` | TEXT | Siempre "STANDARD" por ahora |
| `evento` | TEXT | "ENTRADA" en inserción |
| `lat` | FLOAT | Latitud de entrada |
| `lng` | FLOAT | Longitud de entrada |
| `created_at` | TIMESTAMPTZ | Momento de entrada en zona |
| `exited_at` | TIMESTAMPTZ | Momento de salida (NULL = sesión abierta) |
| `pending_exit_at` | TIMESTAMPTZ | Timestamp del primer ping fuera (timer de 3 min) |

**Constraint crítico:**
```sql
CREATE UNIQUE INDEX idx_unique_open_session_per_device
ON registros_reten (device_id) WHERE exited_at IS NULL;
```
Solo puede haber **una sesión abierta por dispositivo** simultáneamente.

### `zones` — Definición de zonas

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | |
| `number` | INT | Número de zona (901-905 para zonas iTaxi) |
| `name` | TEXT | Nombre/slug (ej: "T2", "PUENTE_AEREO") |
| `color` | TEXT | Color hex para UI |
| `polygon` | JSONB | GeoJSON Polygon `{type: "Polygon", coordinates: [[[lng,lat],...]]}` |
| `project` | TEXT | `'itaxi'` = activa, `'zonas_bcn'` = otro proyecto (ignoradas) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `geofence_logs` — Auditoría de eventos

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | |
| `event_type` | TEXT | ENTER, EXIT, ZONE_CHANGE, RESURRECT, RETURNED |
| `zona` | TEXT | Zona destino |
| `previous_zona` | TEXT | Zona origen (en ZONE_CHANGE) |
| `lat` | FLOAT | Coordenadas del evento |
| `lng` | FLOAT | |
| `accuracy` | FLOAT | Precisión GPS en metros |
| `device_id` | TEXT | |
| `device_name` | TEXT | Nombre legible del dispositivo |
| `created_at` | TIMESTAMPTZ | |

Solo se loguean transiciones de estado (no STAY ni OUTSIDE) para no saturar.

### `device_registry` — Registro de dispositivos

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | INT PK | |
| `device_uuid` | TEXT | UUID generado en el dispositivo |
| `device_number` | INT | Número asignado (D1, D2...) |
| `device_name` | TEXT | Nombre personalizado |
| `created_at` | TIMESTAMPTZ | Primera vez visto |
| `last_seen_at` | TIMESTAMPTZ | Último ping recibido |

---

## 9. Cálculo de tiempos de espera

**Hook:** `useWaitingTimes` (`src/hooks/useWaitingTimes.ts`)

### Fuente de datos

Consulta `registros_reten` buscando sesiones de las **últimas 2 horas**:
- Tanto sesiones cerradas (con `exited_at`) como abiertas (sin `exited_at`)
- Excluye zona `TRANSIT` (zona de tránsito, no de espera real)

### Fórmula de tiempo de espera

```
duración_sesión = exited_at - created_at   (para sesiones cerradas)
```

Filtros aplicados:
- Duración mínima: **5 minutos** (elimina "TRANSIT" y errores de GPS)
- Duración máxima: **3 horas** (zombie sessions ya limpiadas por la RPC)
- Solo sesiones **cerradas** (con `exited_at` real)

### Umbral de confianza

El tiempo de espera **solo se muestra si hay ≥ 3 muestras completadas** en la zona en las últimas 2 horas. Con menos datos, la UI muestra "—".

```typescript
if (completedWaits.length < 3) {
  return { espera_minutos: null, isRealData: false }
}
const avg = sum(duraciones) / completedWaits.length
```

### Taxistas activos

Se cuenta el número de `device_id` distintos con sesión abierta en cada zona en este momento:
```sql
WHERE exited_at IS NULL AND zona = $zona
```

### Refresh

El hook hace polling cada **2 minutos** al hook `useWaitingTimes`. Los datos del dashboard se actualizan automáticamente.

### Mapping de nombres de zona

El hook normaliza los nombres para consistencia con la UI:

| Nombre en DB | Clave en hook |
|--------------|---------------|
| `T1` | `t1` |
| `T2` | `t2` |
| `PUENTE_AEREO` | `puente_aereo` |
| `T2C_EASY` | `t2c_easy` |
| `SANTS` | `sants` |

---

## 10. Cálculo de demanda

**Hook:** `useDemandForecast` (`src/hooks/useDemandForecast.ts`)

### Fuentes de datos combinadas

| Fuente | Archivo / Origen | Datos usados |
|--------|-----------------|--------------|
| Vuelos | `vuelos.json` | Llegadas por terminal y hora |
| Trenes | `trenes_sants.json` | Salidas/llegadas Sants |
| Cruceros | API / JSON | Barcos en puerto, pasajeros estimados |
| Eventos | JSON | Tipo (Music/Sports/Congress) y asistentes |
| Clima | API meteorológica | Probabilidad lluvia, precipitación |
| Tiempos espera | `useWaitingTimes` | Minutos actuales por zona |

### Score de demanda (0-100)

```
score = puntos_pasajeros (0-40)
      + puntos_densidad_llegadas (0-20)
      + puntos_ratio_oferta_demanda (0-15)
      - penalización_espera_larga (0-10)

score *= multiplicador_lluvia
```

**Multiplicador lluvia:**
- Está lloviendo: `× 1.35`
- Probabilidad ≥ 70%: `× 1.25`
- Sin lluvia: `× 1.0`

### Cálculo por zona (horario)

Para cada zona y cada hora (actual + 3 próximas):

```
pax_T1 = vuelos_llegada_T1_en_hora × pax_por_vuelo_media
pax_T2 = vuelos_llegada_T2_en_hora × pax_por_vuelo_media
pax_SANTS = trenes_en_hora × pax_por_tren_media
pax_cruceros = total_pax_cruceros × 0.15  (15% toman taxi)
pax_eventos = asistentes × factor_tipo    (8% música/deporte, 5% congreso)
```

### Tendencia

Compara el slot actual con el siguiente:
- **subiendo**: próxima hora > actual + umbral
- **bajando**: próxima hora < actual - umbral
- **estable**: diferencia dentro del umbral

### Refresh

El hook hace polling cada **3 minutos**.

---

## 11. Dashboard

**Componente:** `DashboardView` (`src/components/views/DashboardView.tsx`)

### Widgets principales

**Terminal cards** (T1, T2, Puente Aéreo, T2C Easy):
```
┌─────────────────────────┐
│  T2                     │
│                    12   │  ← vuelos próxima hora
│  +8 próx. hora          │
│  ⏱ 23 min   🟡 Media   │  ← tiempo espera real
│  👤 4 taxistas          │  ← contribuidores activos
└─────────────────────────┘
```

Color del badge de espera:
- Verde: < 10 minutos
- Ámbar: 10–25 minutos
- Rojo: > 25 minutos
- Gris "—": sin datos suficientes (< 3 muestras)

**Trenes Sants** — tabla de salidas con:
- Countdown en tiempo real (actualizado cada segundo en UI)
- Destino
- Operador (Renfe/AVE/Alvia...)
- Color urgente si sale en < 5 min, crítico si < 2 min

**Cruceros** — resumen del puerto:
- Número de barcos
- Llegadas / salidas del día
- Pasajeros estimados

**Widget de demanda** — gauge 0–100 con:
- Score actual
- Tendencia (↑ subiendo / → estable / ↓ bajando)
- Multiplicador lluvia si aplica

### Política de caché

| Dato | Refresh |
|------|---------|
| Vuelos / trenes / cruceros | 60 minutos (JSON estático actualizado por cron) |
| Tiempos de espera | 2 minutos (useWaitingTimes) |
| Demanda forecast | 3 minutos (useDemandForecast) |
| Estado de tracking | 10 segundos (polling local) |

---

## 12. Configuración y constantes

### Función RPC (PostgreSQL)

```sql
c_grace_period       = '5 minutes'   -- Resurrección tras cierre de sesión
c_exit_confirmation  = '3 minutes'   -- Tiempo fuera para confirmar salida
c_max_session        = '3 hours'     -- Duración máxima de sesión (zombie cleanup)
```

### Edge Function

```
RATE_LIMIT_WINDOW_MS      = 30000   -- 30 segundos
RATE_LIMIT_MAX_REQUESTS   = 10      -- por device y ventana
```

### Frontend

```
GPS_THROTTLE              = 60000   -- 60 segundos entre llamadas al backend
WAITING_TIMES_REFRESH     = 120000  -- 2 minutos
DEMAND_FORECAST_REFRESH   = 180000  -- 3 minutos
TRANSPORT_DATA_CACHE      = 3600000 -- 60 minutos
MIN_WAIT_DURATION_MS      = 300000  -- 5 min mínimo para contar como espera
MIN_SAMPLES_FOR_DISPLAY   = 3       -- mínimo de muestras para mostrar tiempo
```

---

## 13. Historial de bugs críticos

### Bug 1: RECORD IS NOT NULL en PL/pgSQL (enero 2026)

**Problema:** En PL/pgSQL, comprobar `v_record IS NOT NULL` después de `SELECT * INTO v_record` no funciona correctamente. Puede devolver FALSE aunque se haya encontrado una fila.

**Síntoma:** El sistema no detectaba sesiones abiertas existentes y creaba sesiones duplicadas.

**Fix:** Usar la variable `FOUND` que PostgreSQL establece automáticamente tras cada `SELECT INTO`.

**Migración:** `20260130_fix_found_bug.sql`

---

### Bug 2: Rotura total del geofencing tras migración recreate_zones_table (abril 2026)

**Problema:** La migración `20260402162005_recreate_zones_table` eliminó la tabla `zone_polygons` y la columna `slug` de `zones`, pero `fn_process_geofence_event` seguía referenciándolas.

**Síntoma:** La función fallaba silenciosamente con `relation "public.zone_polygons" does not exist`. El frontend cacheaba la última zona conocida, por lo que parecía que el tracking seguía funcionando cuando en realidad no procesaba nada. Se registraron casos de taxistas que salieron de T2 pero el sistema los mantuvo como "dentro".

**Fix:** 4 migraciones aplicadas:
1. `fix_geofence_after_zones_restructure` — helper `_geojson_to_polygon()` + reinserción de zonas de aeropuerto + reescritura de RPC para usar nuevo esquema
2. `fix_geofence_smallest_zone_priority` — zona más pequeña gana para evitar que Zona 55 (que cubre todo el aeropuerto) se active antes que T1/T2
3. `fix_geofence_use_npoints_for_priority` — `area()` no existe para `polygon` nativo; usar `jsonb_array_length` como proxy de tamaño
4. `add_project_field_to_zones` — campo `project` para separar zonas iTaxi de zonas importadas de otro proyecto sin borrarlas

**Lección:** Las migraciones que recrean tablas deben comprobar qué funciones RPC dependen de ellas.

---

*Actualizado: 2026-04-03*
