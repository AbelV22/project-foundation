# 🔧 Solución Error 500 en Geofence

## ❌ Problema
Error HTTP 500 al llamar a la edge function `check-geofence` desde el admin o la app.

## 🔍 Causas Comunes

### 1. **Falta SUPABASE_SERVICE_ROLE_KEY** (MÁS COMÚN)
La edge function necesita la Service Role Key para acceder a la base de datos.

**Solución:**
1. Ve a tu proyecto Supabase: https://supabase.com/dashboard
2. Ve a **Settings** → **API**
3. Copia la **service_role key** (secret)
4. Ve a **Edge Functions** → **check-geofence** → **Settings**
5. Agrega la variable de entorno:
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: `[tu service_role key]`
6. Guarda y **redespliega** la función

### 2. **Rate Limiting (429 → 500)**
La función limita a 2 requests por 30 segundos por dispositivo.

**Solución:**
- Espera 30 segundos entre requests
- O modifica `RATE_LIMIT_MAX_REQUESTS` en la edge function

### 3. **Coordenadas Inválidas**
Las coordenadas deben estar en Europa (lat: 35-72, lng: -25-45).

**Solución:**
- Verifica que las coordenadas GPS sean correctas
- Para pruebas, usa coordenadas de Barcelona: `41.3874, 2.1686`

### 4. **Error de Base de Datos**
Permisos RLS incorrectos o tabla no creada.

**Solución:**
1. Ve a Supabase → **SQL Editor**
2. Ejecuta:
```sql
-- Verificar que las tablas existen
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename IN ('registros_reten', 'geofence_logs');
```

### 5. **Edge Function No Desplegada**
La función puede no estar desplegada correctamente.

**Solución:**
```bash
cd supabase
npx supabase functions deploy check-geofence
```

## 📋 Checklist de Diagnóstico

- [ ] Service Role Key configurada en edge function
- [ ] Edge function desplegada (verde en dashboard)
- [ ] Tablas `registros_reten` y `geofence_logs` creadas
- [ ] RLS policies configuradas correctamente
- [ ] Coordenadas dentro del rango válido
- [ ] No más de 2 requests en 30 segundos por dispositivo

## 🧪 Probar la Función

### 1. Test desde Admin
En el admin panel, ve al tab "Developer Logs" y haz clic en "Probar Conexión".

### 2. Test Manual (curl)
```bash
curl -X POST https://[tu-proyecto].supabase.co/functions/v1/check-geofence \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [tu-anon-key]" \
  -d '{
    "action": "ping"
  }'
```

Deberías recibir: `{"success":true,"message":"🟢 Edge Function operativa"}`

## 📊 Ver Logs en Tiempo Real

1. Ve a Supabase Dashboard
2. **Edge Functions** → **check-geofence** → **Logs**
3. Observa los errores en tiempo real

## 🚀 Solución Rápida (Resumen)

**Paso 1:** Configura Service Role Key
```
Settings → API → Copiar service_role
Edge Functions → check-geofence → Settings → Variables de Entorno
Agregar: SUPABASE_SERVICE_ROLE_KEY = [tu-key]
```

**Paso 2:** Redespliega
```bash
cd supabase
npx supabase functions deploy check-geofence
```

**Paso 3:** Verifica
Usa el botón "Probar Conexión" en el admin.

---

## 📞 Soporte Adicional

Si el problema persiste:
1. Revisa los logs de Supabase Edge Functions
2. Verifica la consola del navegador (F12) para errores
3. Comprueba que la URL de Supabase sea correcta en `.env`
