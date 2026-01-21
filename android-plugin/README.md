# Android Native Plugin - BatteryOptimization

Este directorio contiene el plugin nativo de Android que debe copiarse al proyecto Android una vez generado.

## Instrucciones de Instalación

1. **Generar el proyecto Android** (si no existe):
   ```bash
   npm run build
   npx cap add android
   npx cap sync
   ```

2. **Copiar el plugin**:
   Copia el archivo `BatteryOptimizationPlugin.java` a:
   ```
   android/app/src/main/java/com/itaxibcn/app/plugins/BatteryOptimizationPlugin.java
   ```

3. **Registrar el plugin** en `MainActivity.java`:
   ```java
   import com.itaxibcn.app.plugins.BatteryOptimizationPlugin;
   
   public class MainActivity extends BridgeActivity {
       @Override
       public void onCreate(Bundle savedInstanceState) {
           registerPlugin(BatteryOptimizationPlugin.class);
           super.onCreate(savedInstanceState);
       }
   }
   ```

4. **Actualizar AndroidManifest.xml** - Añadir estos permisos:
   ```xml
   <!-- Background location (Android 10+) -->
   <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
   
   <!-- Foreground service for location (Android 14+) -->
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
   
   <!-- WakeLock para mantener CPU activa -->
   <uses-permission android:name="android.permission.WAKE_LOCK" />
   
   <!-- Solicitar exclusión de optimización de batería -->
   <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
   
   <!-- Mantener conexión WiFi activa -->
   <uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
   <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
   ```

5. **Sincronizar y compilar**:
   ```bash
   npx cap sync android
   npx cap open android
   ```

## Funcionalidades del Plugin

- `isIgnoringBatteryOptimizations()` - Verifica si la app está excluida de optimización de batería
- `requestIgnoreBatteryOptimizations()` - Solicita exclusión mediante diálogo del sistema
- `openBatterySettings()` - Abre configuración de batería
- `acquireWakeLock()` - Adquiere PARTIAL_WAKE_LOCK para mantener CPU activa
- `releaseWakeLock()` - Libera el WakeLock
- `acquireWifiLock()` - Adquiere WifiLock para mantener conexión activa
- `releaseWifiLock()` - Libera el WifiLock
