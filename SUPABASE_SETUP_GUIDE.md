# Complete Supabase Setup Guide

Follow these steps to connect your own Supabase project.

---

## Step 1: Create Tables in Supabase

1. Go to your Supabase project: https://supabase.com/dashboard
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents of `supabase_setup_complete.sql`
5. Paste it into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)

You should see "Success. No rows returned" - this means all tables were created.

---

## Step 2: Deploy the Edge Function

### Option A: Via Supabase CLI (Recommended)

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project (get project-ref from your Supabase URL)
# If your URL is https://abcdefghij.supabase.co, your project-ref is "abcdefghij"
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the edge function
supabase functions deploy check-geofence
```

### Option B: Manual via Dashboard

1. Go to your Supabase project dashboard
2. Click **Edge Functions** in the left sidebar
3. Click **Create a new function**
4. Name it: `check-geofence`
5. Copy the contents of `supabase/functions/check-geofence/index.ts`
6. Paste and deploy

---

## Step 3: Get Your Credentials

From your Supabase project dashboard:

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://YOUR_PROJECT_ID.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6...`

---

## Step 4: Update Your Local .env File

Edit the `.env` file in your project root:

```env
VITE_SUPABASE_URL="https://YOUR_PROJECT_ID.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-public-key-here"
```

---

## Step 5: Update Lovable Environment Variables

1. Go to your Lovable project dashboard
2. Click **Settings** or **Environment Variables**
3. Add/update these variables:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
4. Redeploy your app

---

## Step 6: Verify Everything Works

1. Open your app
2. Go to the Admin panel (`/admin`)
3. Enable location tracking
4. Check the Supabase **Table Editor** to see data appearing in:
   - `location_debug_logs` - Immediate logs
   - `geofence_logs` - When entering/exiting zones
   - `registros_reten` - Zone entry/exit records

---

## Tables Overview

| Table | Purpose |
|-------|---------|
| `registros_reten` | Entry/exit timestamps for waiting time calculation |
| `geofence_logs` | All geofence events (ENTER, EXIT, POSITION_UPDATE) |
| `location_debug_logs` | Diagnostic logs for debugging tracking issues |
| `registros_carreras` | Taxi fare records (PRO feature) |
| `device_registry` | Maps device UUIDs to simple numeric IDs |

---

## Troubleshooting

### "No data appearing"
- Check the Edge Function logs in Supabase dashboard
- Verify your anon key has the right permissions
- Make sure RLS policies are created (they allow public inserts)

### "Edge function not found"
- Deploy the function using `supabase functions deploy check-geofence`
- Or create it manually in the dashboard

### "Permission denied"
- Run the SQL script again - the RLS policies should fix this
- Check that you're using the anon key, not the service role key

---

## Quick Test

You can test the edge function directly:

```bash
curl -X POST "https://YOUR_PROJECT_ID.supabase.co/functions/v1/check-geofence" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"action": "ping"}'
```

Expected response:
```json
{"success":true,"message":"🟢 Edge Function operativa","timestamp":"..."}
```
