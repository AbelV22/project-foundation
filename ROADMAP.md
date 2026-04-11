# iTaxiBCN - Roadmap & Mejoras Pendientes

> Auditoria completa del estado actual de la app. Ultima revision: 2026-04-11

---

## Estado General

| Area | Progreso | Notas |
|------|----------|-------|
| Dashboard & Widgets | 95% | Completo y funcional |
| Gestoria Fiscal | 95% | Modelos 130/131/303, exportacion PDF/CSV |
| Geofencing & Radar | 90% | Android nativo completo, iOS pendiente |
| Vuelos / Trenes / Cruceros / Eventos | 95% | Datos en tiempo real |
| Auth & Cuentas | 40% | Solo signup, falta login y recuperacion |
| Seguridad | 50% | RLS permisivo, admin password expuesto |
| Testing | 0% | Sin tests |
| Accesibilidad | 10% | Sin ARIA labels ni keyboard nav |

---

## CRITICO - Seguridad

### 1. Password de admin expuesto en el bundle
- `VITE_ADMIN_PASSWORD` en `.env` se compila en el JS publico
- Cualquiera puede verlo en DevTools
- **Solucion:** Mover la autenticacion del admin a Supabase (RPC con password hasheado o auth con rol admin)

### 2. Edge Functions sin verificacion JWT
- `check-geofence` y `scan-ticket` tienen `verify_jwt = false`
- Cualquier cliente puede invocarlas sin autenticacion
- **Solucion:** Habilitar JWT o anadir validacion de API key interna

### 3. RLS policies demasiado permisivas
- La mayoria de tablas permiten INSERT/SELECT anonimo (`WITH CHECK (true)`)
- La aislacion de datos depende del `device_id` en codigo, no en la BD
- **Solucion:** Validar `device_id` en las policies o usar `auth.uid()` cuando haya cuentas

---

## ALTA PRIORIDAD - Funcionalidad

### 4. Flujo de login para cuentas existentes
- Solo existe signup, no hay forma de iniciar sesion en otro dispositivo
- Falta "Olvidaste tu contrasena?"
- **Archivos:** `AccountCreationDialog.tsx`, `SettingsView.tsx`
- **Solucion:** Anadir formulario de login con `signInWithPassword` y reset via `resetPasswordForEmail`

### 5. iOS - Tracking de ubicacion nativo
- Android tiene ForegroundService + AlarmManager completo
- iOS no tiene implementacion nativa (solo web tracking)
- **Archivos:** `services/native/proTracking.ts`, plugins Capacitor
- **Solucion:** Implementar CLLocationManager con background modes

### 6. Offline resiliente
- Si no hay conexion, las vistas muestran errores
- Existe `offlineQueue.ts` para ubicacion pero no para datos generales
- **Solucion:** Cachear respuestas de API en IndexedDB, mostrar datos stale con indicador

### 7. Imagen OG apunta a Lovable
- `og:image` en `index.html` apunta a `lovable.dev/opengraph-image-p98pqg.png`
- **Solucion:** Crear preview image propia y hostearla

---

## MEDIA PRIORIDAD - UX & Polish

### 8. Settings incompletos
Faltan:
- Info de version y "Acerca de"
- Boton para limpiar cache
- Eliminacion de cuenta (GDPR)
- Exportar/importar datos del usuario

### 9. Feedback UI no conectado
- `useFeedback.ts` esta completo (submit, votar, categorias)
- `CommunityView.tsx` tiene la UI
- Verificar que la UI de submit esta conectada y funcional

### 10. Lazy loading de vistas
- Todas las vistas se cargan en el bundle inicial (2MB)
- **Solucion:** `React.lazy()` + `Suspense` para las vistas secundarias

### 11. Assets sin optimizar
- `logo-new.png` (560KB) no se usa, ocupa espacio
- Multiples versiones del logo (`logo-adaptive.png`, `logo-itaxibcn.png`, `logo-optimized.png`)
- Verificar que `pwa-192x192.png` y `pwa-512x512.png` existen en `/public`
- **Solucion:** Limpiar assets no usados, verificar iconos PWA

### 12. Validacion de formularios inconsistente
- Algunos formularios usan regex manual, otros nada
- **Solucion:** Usar Zod (ya instalado) de forma consistente

---

## BAJA PRIORIDAD - Nice to Have

### 13. Accesibilidad (a11y)
- Sin `aria-label`, `aria-describedby`, ni `role` en componentes interactivos
- Sin gestion de focus ni skip links
- **Solucion:** Auditar con axe-core y anadir ARIA labels progresivamente

### 14. Testing
- 0 tests unitarios o E2E
- **Solucion:** Configurar Vitest + tests para: auth, geofencing, data fetching, gestoria fiscal

### 15. Error tracking en produccion
- Solo `console.error` — no hay visibilidad de crashes en produccion
- **Solucion:** Integrar Sentry o similar

### 16. Notificaciones push - backend
- Push notifications configuradas en el cliente (FCM)
- No hay backend para enviar pushes (ej: "Hay poca cola en T1")
- **Solucion:** Edge Function con cron para pushes inteligentes

### 17. Analytics avanzados
- `useAnalytics.ts` trackea eventos basicos a `app_events`
- No hay dashboard ni agregacion
- **Solucion:** Vista admin con metricas de uso

### 18. Internacionalizacion
- Todo en castellano, hardcodeado
- Para expansion futura: i18n con catalan/ingles

### 19. Listas largas sin virtualizar
- Vuelos, trenes, cruceros renderizan todas las filas
- **Solucion:** `react-window` o `@tanstack/virtual` para listas >50 items

---

## Lo Que Funciona Bien

- **Dashboard principal** — Completo con predicciones, KPIs, datos en vivo
- **Gestoria fiscal** — Modelos AEAT, cuota autonomo, amortizacion, exportacion PDF/CSV
- **Geofencing Android** — ForegroundService + AlarmManager robusto
- **Sistema de cache** — Doble capa (dataService + React Query) con TTL por tipo
- **UI/UX** — Mobile-first, dark/light mode con auto, animaciones Framer Motion
- **Tema y responsive** — Variables CSS completas, responsive con breakpoints
- **Onboarding** — 6 slides con mockups interactivos y logo de marca
- **Comunidad** — Votacion de features, categorias, estados
- **Tickets OCR** — Escaneo con Gemini Vision integrado
- **Navegacion** — Bottom nav glassmorphic, Command Palette (Cmd+K)
- **Loading/Empty states** — Skeletons, spinners y estados vacios en la mayoria de vistas
- **Toasts** — Sonner + useToast con variantes success/error
