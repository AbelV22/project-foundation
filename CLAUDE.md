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
1. **Frontend** (`AutoLocationService.ts`) → calls Edge Function with lat/lng
2. **Edge Function** (`check-geofence/index.ts`) → calls RPC `fn_process_geofence_event`
3. **RPC Function** → handles state machine logic in database

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

- Only show real calculated data (no hardcoded defaults)
- Exclude `TRANSIT` sessions (< 5 min) from average calculation
- Display "—" when no real data available
- Minimum 3 completed waits required to show average

---

## Migrations Location
`supabase/migrations/`

Key migrations:
- `20260127_robust_geofencing.sql` - Initial zone setup
- `20260130_fix_found_bug.sql` - FOUND variable fix
