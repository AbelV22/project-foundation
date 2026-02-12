# Google Play Store - Prueba Cerrada: Guía Completa iTaxiBcn

Este documento contiene TODA la información que necesitas para completar
cada sección de Google Play Console para lanzar la prueba cerrada.

---

## 1. INFORMACIÓN DE LA APLICACIÓN

### Descripción breve (máx. 80 caracteres)
```
Herramienta profesional para taxistas de Barcelona con datos en tiempo real.
```

### Descripción completa (máx. 4000 caracteres)
```
iTaxiBcn es la herramienta inteligente diseñada exclusivamente para taxistas profesionales de Barcelona.

SEGUIMIENTO INTELIGENTE DE ZONAS DE ESPERA
Detecta automáticamente cuándo entras en zonas de espera del Aeropuerto (T1 y T2) y la Estación de Sants. Calcula tu tiempo de espera real y lo comparte de forma anónima con la comunidad para que todos los taxistas sepan cuánto se espera en cada zona antes de decidir dónde ir.

VUELOS EN TIEMPO REAL
Consulta las llegadas y salidas del Aeropuerto de Barcelona-El Prat organizadas por hora. Visualiza el flujo de pasajeros esperado para planificar mejor tu jornada.

TRENES Y AVE
Horarios completos de trenes de alta velocidad (AVE, IRYO, OUIGO, TGV) en la Estación de Sants. Filtra por ciudad de origen, operador o franja horaria para anticiparte a la demanda.

CRUCEROS EN EL PUERTO
Información sobre cruceros que llegan al Puerto de Barcelona, con datos de pasajeros y horarios de desembarque.

EVENTOS EN BARCELONA
Calendario de eventos, conciertos, congresos y ferias en la ciudad. Sabe dónde habrá concentración de pasajeros potenciales.

REGISTRO DE GANANCIAS Y GASTOS
Lleva un control detallado de tus carreras y gastos profesionales. Registra ingresos rápidamente y visualiza tus estadísticas diarias, semanales y mensuales.

MERCADO DE LICENCIAS
Consulta los precios actuales del mercado de licencias de taxi en Barcelona con tendencias históricas y análisis de precios.

RECOMENDACIONES INTELIGENTES (¿DÓNDE VOY?)
Algoritmo inteligente que analiza múltiples factores (vuelos, trenes, eventos, hora del día, meteorología) para recomendarte la mejor zona donde buscar pasajeros.

METEOROLOGÍA
Información meteorológica actualizada para Barcelona, integrada en las recomendaciones del sistema.

DISEÑADO PARA PROFESIONALES
- Interfaz oscura optimizada para uso nocturno
- Funciona en segundo plano sin agotar batería
- Datos anónimos y privados
- Sin publicidad
- 100% gratuita

iTaxiBcn: Trabaja más inteligente, no más duro.
```

---

## 2. TIPO DE CONTENIDO DE LA APLICACIÓN

En Google Play Console → Contenido de la app:

| Pregunta | Respuesta |
|----------|-----------|
| ¿Tu app es una app, un juego o ambos? | **App** |
| ¿Es una app social o de comunicación? | **No** |
| ¿Tu app es una app de noticias? | **No** |

---

## 3. POLÍTICA DE PRIVACIDAD

**URL a configurar en Play Console:**
```
https://itaxibcn.com/privacy
```

> **IMPORTANTE**: Debes hospedar la política de privacidad en una URL pública accesible.
> Opciones:
> 1. Página en tu dominio itaxibcn.com/privacy
> 2. GitHub Pages (gratis): sube el archivo privacy.html
> 3. Firebase Hosting (gratis)
>
> He creado el archivo `privacy.html` en esta carpeta para que lo subas.

---

## 4. ACCESO A LAS APLICACIONES

| Pregunta | Respuesta |
|----------|-----------|
| ¿Todas las funciones de tu app están disponibles sin credenciales de acceso? | **Sí** |
| ¿Se necesita cuenta/login para usar la app? | **No** (la app funciona sin login) |

> La app no requiere registro ni login. Todas las funciones están disponibles
> directamente al abrir la app.

---

## 5. ANUNCIOS

| Pregunta | Respuesta |
|----------|-----------|
| ¿Tu app contiene anuncios? | **No** |
| ¿Contiene anuncios intersticiales? | **No** |

---

## 6. CLASIFICACIÓN DE CONTENIDO (Cuestionario IARC)

Debes completar el cuestionario en Play Console. Respuestas sugeridas:

| Pregunta | Respuesta |
|----------|-----------|
| Categoría de la app | **Utilidad / Productividad** |
| ¿Contiene violencia? | **No** |
| ¿Contiene contenido sexual? | **No** |
| ¿Contiene lenguaje soez? | **No** |
| ¿Contiene sustancias controladas (drogas/alcohol/tabaco)? | **No** |
| ¿Permite interacción entre usuarios? | **No** |
| ¿Permite compartir ubicación del usuario con otros? | **Sí** (datos anónimos de tiempos de espera) |
| ¿Permite compras digitales? | **No** |
| ¿Contiene juegos de azar? | **No** |
| ¿Incluye contenido generado por usuarios? | **No** |

> **Resultado esperado**: Clasificación **PEGI 3 / Everyone**

---

## 7. AUDIENCIA OBJETIVO

| Pregunta | Respuesta |
|----------|-----------|
| Grupo de edad objetivo | **18 años o más** |
| ¿La app está dirigida a niños? | **No** |
| ¿Cumple con la política de familias de Google? | **No aplica** (no está dirigida a menores) |

> **IMPORTANTE**: Selecciona SOLO el rango "18+" ya que es una herramienta
> profesional para taxistas.

---

## 8. SEGURIDAD DE LOS DATOS (Data Safety)

Esta es la sección más compleja. Respuestas detalladas:

### 8.1 Recopilación de datos

| Pregunta | Respuesta |
|----------|-----------|
| ¿Tu app recopila o comparte datos de usuario? | **Sí** |

### 8.2 Tipos de datos recopilados

| Tipo de dato | ¿Se recopila? | ¿Se comparte? | Obligatorio/Opcional | Propósito |
|---|---|---|---|---|
| **Ubicación aproximada** | Sí | No | Obligatorio | Funcionalidad de la app |
| **Ubicación precisa** | Sí | No | Obligatorio | Funcionalidad de la app |
| **Información del dispositivo (ID anónimo)** | Sí | No | Obligatorio | Funcionalidad de la app, Análisis |
| **Otra info del dispositivo (modelo, batería)** | Sí | No | Obligatorio | Análisis, Diagnóstico |
| **Datos financieros del usuario (ganancias/gastos)** | Sí | No | Opcional | Funcionalidad de la app |

### 8.3 Prácticas de seguridad

| Pregunta | Respuesta |
|----------|-----------|
| ¿Los datos se cifran en tránsito? | **Sí** (HTTPS/TLS con Supabase) |
| ¿Los usuarios pueden solicitar la eliminación de datos? | **Sí** (contacto: soporte@itaxibcn.com) |
| ¿La app está dirigida a niños? | **No** |

### 8.4 Ubicación en segundo plano

| Pregunta | Respuesta |
|----------|-----------|
| ¿Tu app accede a la ubicación en segundo plano? | **Sí** |
| Propósito | Detección automática de zonas de espera de taxi (aeropuerto T1/T2, Estación de Sants) para calcular tiempos de espera comunitarios |
| ¿Es esencial para la funcionalidad principal? | **Sí** |

> **NOTA sobre ACCESS_BACKGROUND_LOCATION**: Google requiere una justificación
> detallada. Ver sección "Justificación de permisos" más abajo.

---

## 9. APLICACIONES GUBERNAMENTALES

| Pregunta | Respuesta |
|----------|-----------|
| ¿Tu app es una aplicación gubernamental? | **No** |

---

## 10. FUNCIONES FINANCIERAS

| Pregunta | Respuesta |
|----------|-----------|
| ¿Tu app ofrece funciones financieras? | **No** |
| ¿Facilita préstamos personales? | **No** |
| ¿Permite a usuarios enviar/recibir dinero? | **No** |
| ¿Ofrece asesoramiento financiero? | **No** |

> Nota: El registro de ganancias/gastos es solo un registro personal del
> conductor, NO es una función financiera (no procesa pagos ni transacciones).

---

## 11. SALUD

| Pregunta | Respuesta |
|----------|-----------|
| ¿Tu app es una aplicación de salud? | **No** |
| ¿Proporciona información médica? | **No** |
| ¿Se conecta a dispositivos médicos? | **No** |

---

## 12. CATEGORÍA DE LA APP Y DATOS DE CONTACTO

### Categoría

| Campo | Valor |
|-------|-------|
| Tipo de aplicación | **Aplicación** (no juego) |
| Categoría | **Mapas y navegación** (alternativa: **Herramientas**) |

### Datos de contacto del desarrollador

| Campo | Valor |
|-------|-------|
| Nombre del desarrollador | iTaxiBcn |
| Email de contacto | soporte@itaxibcn.com |
| Sitio web | https://itaxibcn.com |
| Teléfono (opcional) | _(tu número de contacto)_ |

---

## 13. FICHA DE PLAY STORE

### Textos

| Campo | Valor |
|-------|-------|
| Nombre de la app | **iTaxiBcn** |
| Descripción breve | _(ver sección 1)_ |
| Descripción completa | _(ver sección 1)_ |

### Gráficos requeridos

| Recurso | Estado | Requisitos |
|---------|--------|------------|
| Icono de la app | ✅ Listo (`resources/icon.png`) | 512x512 px, PNG 32-bit |
| Gráfico de funciones | ✅ Listo (`resources/feature_graphic.png`) | 1024x500 px |
| Capturas de pantalla (teléfono) | ❌ NECESITAS AL MENOS 2 | Mín. 320px, máx. 3840px, ratio 16:9 o 9:16 |
| Capturas de pantalla (tablet 7") | ⚠️ Opcional para prueba cerrada | Mismo formato |
| Capturas de pantalla (tablet 10") | ⚠️ Opcional para prueba cerrada | Mismo formato |

> **CAPTURAS DE PANTALLA**: Necesitas mínimo 2 capturas (recomiendo 4-6).
> Sugerencia de pantallas a capturar:
> 1. Dashboard principal con tiempos de espera
> 2. Vista de vuelos del aeropuerto
> 3. Vista de trenes en Sants
> 4. Registro de ganancias
> 5. Recomendación "¿Dónde voy?"
> 6. Vista de eventos en Barcelona

---

## 14. JUSTIFICACIÓN DE PERMISOS ESPECIALES

### ACCESS_BACKGROUND_LOCATION (requerida por Google)

Google pide un vídeo o explicación detallada de por qué necesitas ubicación en segundo plano.

**Texto para la declaración:**
```
iTaxiBcn necesita acceso a la ubicación en segundo plano para su función principal:
la Detección Automática de Zonas de Espera de Taxi.

Cuando un taxista entra en una zona de espera del Aeropuerto de Barcelona
(Terminal 1, Terminal 2) o la Estación de Barcelona-Sants, la app detecta
automáticamente la entrada y salida de estas zonas mediante geofencing.

Esto permite:
1. Calcular el tiempo real de espera del taxista en cada zona
2. Compartir estos tiempos de forma anónima con la comunidad de taxistas
3. Que otros taxistas vean cuánto tiempo de espera hay en cada zona antes
   de decidir dónde dirigirse

Esta funcionalidad REQUIERE ubicación en segundo plano porque:
- Los taxistas mantienen el teléfono en espera mientras aguardan en la cola
- La detección debe ser continua y automática, sin que el conductor tenga
  que mantener la app abierta
- La pantalla del dispositivo suele estar apagada durante las esperas que
  pueden durar horas

Sin ubicación en segundo plano, la función principal de la app (detección
automática y cálculo de tiempos de espera) no puede funcionar.

La app muestra una notificación persistente cuando el seguimiento está activo,
informando al usuario de que su ubicación está siendo registrada.
```

### SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM
```
Se utiliza como mecanismo de respaldo para mantener activo el servicio de
seguimiento de ubicación durante el modo Doze de Android. Cuando el sistema
operativo suspende la app, las alarmas exactas reactivan brevemente el servicio
para registrar la posición actual del taxista, garantizando la continuidad del
cálculo de tiempos de espera.
```

---

## 15. CONFIGURACIÓN DE PRUEBA CERRADA

### Pasos en Play Console:

1. **Crear pista de prueba cerrada** → Pruebas → Prueba cerrada
2. **Crear lista de testers** → Añadir emails de los taxistas beta testers
3. **Subir AAB** (Android App Bundle) → Generar con:
   ```bash
   cd android && ./gradlew bundleRelease
   ```
   El archivo estará en: `android/app/build/outputs/bundle/release/app-release.aab`
4. **Completar todas las secciones** de este documento
5. **Enviar para revisión**

### Checklist final antes de enviar:

- [ ] Descripción breve y completa rellenadas
- [ ] Icono 512x512 subido
- [ ] Feature graphic 1024x500 subido
- [ ] Mínimo 2 capturas de pantalla subidas
- [ ] Política de privacidad URL configurada y accesible
- [ ] Cuestionario de clasificación de contenido completado
- [ ] Seguridad de los datos completada
- [ ] Audiencia objetivo: 18+
- [ ] Categoría: Mapas y navegación
- [ ] Datos de contacto del desarrollador
- [ ] AAB firmado subido a la pista de prueba cerrada
- [ ] Lista de testers creada con emails
- [ ] Declaración de ubicación en segundo plano enviada
