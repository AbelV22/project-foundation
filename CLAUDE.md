# Claude Code Project Memory

## Project: TaxiDay - Geofencing App for Taxi Drivers

### Supabase Configuration
- **Project ID:** `uqjwfnevtefdfpbckuwf`
- **URL:** `https://uqjwfnevtefdfpbckuwf.supabase.co`

---

## PL/pgSQL Critical Knowledge

### Bug: RECORD IS NOT NULL doesn't work as expected

**Problem:** In PL/pgSQL, after `SELECT * INTO v_record FROM ...`, checking `v_record IS NOT NULL` does NOT work correctly. It may return FALSE even when data was found.

**Solution:** Use the `FOUND` variable instead:

```sql
-- WRONG ❌
SELECT * INTO v_current_session FROM table WHERE ...;
IF v_current_session IS NOT NULL THEN  -- This doesn't work!

-- CORRECT ✅
SELECT * INTO v_current_session FROM table WHERE ...;
v_has_session := FOUND;  -- FOUND is set by PostgreSQL after SELECT INTO
IF v_has_session THEN
```

**Applied in:** `fn_process_geofence_event` function

---

## Geofencing System Architecture

### Flow
1. **Clients** (APK ≥ 1.1.6 native service, `AutoLocationService.ts`, `backgroundGeolocation.ts`) → call RPC `fn_geofence_check` directly via PostgREST. Edge Function invocations are capped on the free plan (500k/month); REST calls are not.
2. **Edge Function `check-geofence` is deleted** (2026-11-02): APKs < 1.1.6 called it ~135k times/day, far over the free plan's 500k invocations/month. Those APKs no longer get zone detection until they update. CI keeps it deleted (`deploy_supabase.yml`); the source stays in `supabase/functions/check-geofence` in case it's ever needed.
3. **`fn_geofence_check`** → per-device rate limit (20 s, table `geofence_rate_limit`), input validation, then `fn_process_geofence_event` (state machine), plus pacing hints `next_check_s` / `move_m` that the APK uses to decide when to send again.

### Zone Detection
- Uses PostgreSQL native `polygon` type with `@>` operator
- Coordinates stored as `(lat, lng)` format
- Query: `WHERE zp.shape @> point(p_lat, p_lng)`

### State Machine States
- `ENTER` - New session created
- `STAY` - Still in same zone
- `PENDING_EXIT` - Left zone, waiting 3 min to confirm
- `RETURNED` - Came back before exit confirmed
- `EXIT` - Exit confirmed after 3 min outside
- `ZONE_CHANGE` - Moved directly to different zone
- `RESURRECT` - Returned within 5 min grace period
- `LOW_ACCURACY` - GPS accuracy >100m, ignored
- `OUTSIDE` - Not in any zone, no session

### Configuration (in RPC function)
- `c_grace_period`: 5 minutes (resurrect closed session)
- `c_exit_confirmation`: 3 minutes (confirm exit)
- `c_max_session`: 3 hours (zombie cleanup)

### Key Tables
- `registros_reten` - Session records (device_id, zona, created_at, exited_at, pending_exit_at)
- `zones` - Zone definitions (slug, name)
- `zone_polygons` - Polygon shapes for each zone
- `geofence_logs` - Event audit log

### Unique Constraint
```sql
CREATE UNIQUE INDEX idx_unique_open_session_per_device
ON registros_reten (device_id) WHERE exited_at IS NULL;
```
Only ONE open session per device allowed.

---

## Waiting Times Display

Computed server-side in RPC `fn_get_waiting_times()` (clients cannot read `registros_reten`; only admins via `public.is_admin()`).

- Only show real calculated data (no hardcoded defaults)
- Exclude `TRANSIT` sessions from average calculation
- Only count genuine queue waits: duration ≥ **30 minutes** (shorter stays = drivers passing through, not real queue)
- Display "—" when no real data available
- Minimum 5 completed waits required to show average

---

## Migrations Location
`supabase/migrations/`

Key migrations:
- `20260127_robust_geofencing.sql` - Initial zone setup
- `20260130_fix_found_bug.sql` - FOUND variable fix

---

## Traffic Incidents

- Edge Function `traffic-sync` (verify_jwt off, protected by the Vault secret `traffic_sync_secret`) is called every 3 min by the pg_cron job `traffic-sync`. It downloads the Servei Català de Trànsit GML feed and the Ajuntament's TRAMS state + FRASE notices, and replaces each source's rows in `traffic_incidents` via `fn_replace_traffic_incidents`.
- gencat.cat drops connections from the database's network, so the feeds can't be fetched with pg_net directly.
- Clients read `traffic_incidents` via PostgREST (`useTrafficIncidents`, `TrafficWidget` on the dashboard).
