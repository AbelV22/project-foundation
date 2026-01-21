import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, MapPin, Clock, Users, Lock, LogOut, Eye, EyeOff, Play, Square, Activity, Navigation, Smartphone, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { enableTestingMode, disableTestingMode, getTrackingStatus, forceLocationCheck, checkConnection } from "@/services/location/AutoLocationService";
import { requestBrowserPermission, getLastGeolocationError, hasRecentGeolocationSuccess } from "@/services/native/geolocation";
import { 
    initBackgroundGeolocation, 
    stopBackgroundGeolocation, 
    getBackgroundStatus,
    isNativePlatform,
    openLocationSettings
} from "@/services/native/backgroundGeolocation";

// Admin password
const ADMIN_PASSWORD = "laraabel22";

interface RegistroReten {
    id: string;
    zona: string;
    tipo_zona: string;
    evento: string;
    created_at: string;
    exited_at: string | null;
    device_id: string | null;
    lat: number;
    lng: number;
}

interface ZonaStats {
    zona: string;
    taxistas_activos: number;
    espera_promedio: number;
    ultimo_registro: string | null;
}

interface GeofenceLog {
    id: string;
    event_type: string;
    zona: string | null;
    previous_zona: string | null;
    lat: number;
    lng: number;
    accuracy: number | null;
    device_id: string;
    device_name: string | null;
    created_at: string;
}

export default function Admin() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [registros, setRegistros] = useState<RegistroReten[]>([]);
    const [zonaStats, setZonaStats] = useState<ZonaStats[]>([]);
    const [geofenceLogs, setGeofenceLogs] = useState<GeofenceLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'stats' | 'logs'>('stats');
    const [testingModeActive, setTestingModeActive] = useState(false);
    const [deviceNameInput, setDeviceNameInput] = useState("");
    const [trackingStatus, setTrackingStatus] = useState<ReturnType<typeof getTrackingStatus> | null>(null);
    const [customLat, setCustomLat] = useState("");
    const [customLng, setCustomLng] = useState("");
    const [useCustomCoords, setUseCustomCoords] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'requesting'>('unknown');
    const [geoError, setGeoError] = useState<string | null>(null);
    const [backgroundStatus, setBackgroundStatus] = useState(getBackgroundStatus());
    const [isNative, setIsNative] = useState(isNativePlatform());
    const navigate = useNavigate();

    // Background geolocation controls
    const handleStartBackgroundTracking = async () => {
        const success = await initBackgroundGeolocation();
        if (success) {
            setBackgroundStatus(getBackgroundStatus());
        }
    };

    const handleStopBackgroundTracking = async () => {
        await stopBackgroundGeolocation();
        setBackgroundStatus(getBackgroundStatus());
    };

    // Check if already authenticated (session storage)
    useEffect(() => {
        const auth = sessionStorage.getItem("admin_auth");
        if (auth === "true") {
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            setIsAuthenticated(true);
            sessionStorage.setItem("admin_auth", "true");
            setError("");
        } else {
            setError("Contraseña incorrecta");
        }
    };

    const handleLogout = () => {
        setIsAuthenticated(false);
        sessionStorage.removeItem("admin_auth");
        navigate("/");
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch recent registrations (last 24 hours)
            const { data: registrosData, error: registrosError } = await supabase
                .from("registros_reten")
                .select("*")
                .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .order("created_at", { ascending: false })
                .limit(100);

            if (registrosError) throw registrosError;
            setRegistros(registrosData || []);

            // Calculate stats per zone
            const stats: Record<string, ZonaStats> = {};
            const zonas = ["T1", "T2", "SANTS", "PUENTE_AEREO", "T2C_EASY"];

            for (const zona of zonas) {
                const zonaRegistros = (registrosData || []).filter(r => r.zona === zona);
                const activos = zonaRegistros.filter(r => !r.exited_at).length;

                // Calculate average waiting time
                const completedWaits = zonaRegistros.filter(r => r.exited_at);
                let avgWait = 0;
                if (completedWaits.length > 0) {
                    const totalWait = completedWaits.reduce((acc, r) => {
                        const start = new Date(r.created_at).getTime();
                        const end = new Date(r.exited_at!).getTime();
                        return acc + (end - start) / 60000; // Convert to minutes
                    }, 0);
                    avgWait = Math.round(totalWait / completedWaits.length);
                }

                stats[zona] = {
                    zona,
                    taxistas_activos: activos,
                    espera_promedio: avgWait || getDefaultEspera(zona),
                    ultimo_registro: zonaRegistros[0]?.created_at || null
                };
            }

            setZonaStats(Object.values(stats));
        } catch (error) {
            console.error("Error fetching admin data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            // Check initial testing mode status
            const status = getTrackingStatus();
            setTestingModeActive(status.isTestingMode);
            setTrackingStatus(status);
            if (status.deviceName) setDeviceNameInput(status.deviceName);

            // Check geolocation status
            setGeoError(getLastGeolocationError());
            if (hasRecentGeolocationSuccess()) {
                setPermissionStatus('granted');
            }

            fetchData();
            fetchGeofenceLogs();

            // Refresh data and status periodically
            const interval = setInterval(() => {
                fetchData();
                fetchGeofenceLogs();
                setTrackingStatus(getTrackingStatus());
                setGeoError(getLastGeolocationError());
                setBackgroundStatus(getBackgroundStatus());
            }, 5000); // Refresh every 5s for real-time status

            return () => clearInterval(interval);
        }
    }, [isAuthenticated]);

    const fetchGeofenceLogs = async () => {
        try {
            const { data, error } = await supabase
                .from("geofence_logs")
                .select("*")
                .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .order("created_at", { ascending: false })
                .limit(200);

            if (error) {
                console.error("Error fetching geofence logs:", error);
                return;
            }
            setGeofenceLogs((data as GeofenceLog[]) || []);
        } catch (err) {
            console.error("Error fetching geofence logs:", err);
        }
    };

    const handleToggleTestingMode = () => {
        if (testingModeActive) {
            disableTestingMode();
            setTestingModeActive(false);
        } else {
            enableTestingMode(deviceNameInput || "Taxi");
            setTestingModeActive(true);
        }
        setTimeout(() => setTrackingStatus(getTrackingStatus()), 500);
    };

    const handleForceCheck = async () => {
        await forceLocationCheck();
        setTimeout(() => {
            setTrackingStatus(getTrackingStatus());
            fetchGeofenceLogs();
        }, 1000);
    };



    const handleRequestPermission = async () => {
        setPermissionStatus('requesting');
        const result = await requestBrowserPermission();
        if (result.granted) {
            setPermissionStatus('granted');
            setGeoError(null);
            // Try to get position immediately
            await handleForceCheck();
        } else {
            setPermissionStatus('denied');
            setGeoError(result.error || 'Permiso denegado');
        }
    };

    const getDefaultEspera = (zona: string): number => {
        const defaults: Record<string, number> = { T1: 25, T2: 15, SANTS: 10, PUENTE_AEREO: 8, T2C_EASY: 12 };
        return defaults[zona] || 20;
    };

    const formatTime = (isoString: string) => {
        return new Date(isoString).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    };

    const anonymizeDeviceId = (deviceId: string | null) => {
        if (!deviceId) return "---";
        return deviceId.substring(0, 4) + "..." + deviceId.substring(deviceId.length - 4);
    };

    // Login screen
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="w-full max-w-sm card-glass p-6 space-y-6">
                    <div className="text-center">
                        <Lock className="h-12 w-12 text-primary mx-auto mb-4" />
                        <h1 className="text-xl font-bold text-white">Panel Admin</h1>
                        <p className="text-sm text-muted-foreground">Acceso restringido</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Contraseña"
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>

                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                        <button
                            type="submit"
                            className="w-full bg-primary text-black font-semibold py-3 rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            Entrar
                        </button>
                    </form>

                    <button
                        onClick={() => navigate("/")}
                        className="w-full text-sm text-muted-foreground hover:text-white transition-colors"
                    >
                        ← Volver al inicio
                    </button>
                </div>
            </div>
        );
    }

    // Admin dashboard
    return (
        <div className="min-h-screen bg-background p-4 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-bold text-white">Panel Admin</h1>
                    <p className="text-sm text-muted-foreground">Developer Testing Dashboard</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { fetchData(); fetchGeofenceLogs(); }}
                        disabled={loading}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <RefreshCw className={cn("h-5 w-5 text-white", loading && "animate-spin")} />
                    </button>
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors"
                    >
                        <LogOut className="h-5 w-5 text-red-400" />
                    </button>
                </div>
            </div>

            {/* Background Geolocation Control (Native only) */}
            {isNative && (
                <section className="card-glass p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Smartphone className={cn("h-5 w-5", backgroundStatus.isActive ? "text-emerald-400" : "text-muted-foreground")} />
                            <span className="font-semibold text-white">Background Tracking</span>
                            <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full",
                                backgroundStatus.isActive
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-muted-foreground/20 text-muted-foreground"
                            )}>
                                {backgroundStatus.isActive ? "ACTIVO" : "INACTIVO"}
                            </span>
                        </div>
                        <button
                            onClick={backgroundStatus.isActive ? handleStopBackgroundTracking : handleStartBackgroundTracking}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors",
                                backgroundStatus.isActive
                                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                    : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                            )}
                        >
                            {backgroundStatus.isActive ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            {backgroundStatus.isActive ? "Detener" : "Iniciar"}
                        </button>
                    </div>
                    {backgroundStatus.lastPosition && (
                        <div className="text-xs text-muted-foreground">
                            Última posición: {backgroundStatus.lastPosition.lat.toFixed(5)}, {backgroundStatus.lastPosition.lng.toFixed(5)}
                            {backgroundStatus.lastUpdateTime && ` (${new Date(backgroundStatus.lastUpdateTime).toLocaleTimeString('es-ES')})`}
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                        📱 Tracking continuo incluso con la app en segundo plano
                    </p>
                </section>
            )}

            {/* Testing Mode Control Panel */}
            <section className="card-glass p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Activity className={cn("h-5 w-5", testingModeActive ? "text-emerald-400" : "text-muted-foreground")} />
                        <span className="font-semibold text-white">Modo Testing</span>
                        <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            testingModeActive
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-muted-foreground/20 text-muted-foreground"
                        )}>
                            {testingModeActive ? "ACTIVO (30s)" : "INACTIVO"}
                        </span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleForceCheck}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-sm bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                        >
                            <Navigation className="h-4 w-4" />
                            Forzar
                        </button>
                        <button
                            onClick={handleToggleTestingMode}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors",
                                testingModeActive
                                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                    : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                            )}
                        >
                            {testingModeActive ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            {testingModeActive ? "Detener" : "Iniciar"}
                        </button>
                    </div>
                </div>

                {/* Geolocation Permission Status */}
                <div className="mb-3 p-3 rounded-lg bg-black/20 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-white flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            Ubicación Real
                        </span>
                        <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            permissionStatus === 'granted' ? "bg-emerald-500/20 text-emerald-400" :
                                permissionStatus === 'denied' ? "bg-red-500/20 text-red-400" :
                                    permissionStatus === 'requesting' ? "bg-amber-500/20 text-amber-400" :
                                        "bg-muted-foreground/20 text-muted-foreground"
                        )}>
                            {permissionStatus === 'granted' ? '✅ Activo' :
                                permissionStatus === 'denied' ? '❌ Bloqueado' :
                                    permissionStatus === 'requesting' ? '⏳ Solicitando...' :
                                        '❓ Desconocido'}
                        </span>
                    </div>

                    {geoError && (
                        <p className="text-xs text-red-400 mb-2 p-2 bg-red-500/10 rounded">
                            ⚠️ {geoError}
                        </p>
                    )}

                    <button
                        onClick={handleRequestPermission}
                        disabled={permissionStatus === 'requesting'}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-sm bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-50"
                    >
                        <MapPin className="h-4 w-4" />
                        {permissionStatus === 'requesting' ? 'Solicitando permiso...' : 'Solicitar ubicación real'}
                    </button>
                    <p className="text-[10px] text-muted-foreground mt-2 text-center">
                        ⚠️ En iframes/previews la ubicación suele estar bloqueada. Usa la app publicada o coordenadas de prueba.
                    </p>
                </div>

                {/* Device Name */}
                <div className="mb-3">
                    <input
                        type="text"
                        value={deviceNameInput}
                        onChange={(e) => setDeviceNameInput(e.target.value)}
                        placeholder="Nombre del dispositivo (ej: Taxi Papá)"
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                </div>

                {/* Using real GPS location only */}

                {/* Real-time Status */}
                {trackingStatus && (
                    <div className="mt-3 p-3 bg-black/20 rounded-lg text-xs space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Estado:</span>
                            <span className={cn(
                                trackingStatus.isTracking ? "text-emerald-400" : "text-muted-foreground"
                            )}>
                                {trackingStatus.isTracking ? "Trackeando" : "Detenido"}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Zona actual:</span>
                            <span className={cn(
                                trackingStatus.lastZona && trackingStatus.lastZona !== 'DEBUG'
                                    ? "text-primary font-medium"
                                    : "text-muted-foreground"
                            )}>
                                {trackingStatus.lastZona || "—"}
                            </span>
                        </div>
                        {trackingStatus.lastPosition && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Última posición:</span>
                                <span className="text-blue-400 font-mono">
                                    {trackingStatus.lastPosition.lat.toFixed(5)}, {trackingStatus.lastPosition.lng.toFixed(5)}
                                </span>
                            </div>
                        )}
                        {trackingStatus.lastCheckTime && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Último check:</span>
                                <span className="text-white">
                                    {new Date(trackingStatus.lastCheckTime).toLocaleTimeString('es-ES')}
                                </span>
                            </div>
                        )}
                        {trackingStatus.lastError && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Error:</span>
                                <span className="text-red-400">{trackingStatus.lastError}</span>
                            </div>
                        )}
                    </div>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                    💡 Activa modo testing para trackeo cada 30 segundos. Usa coordenadas de prueba si la ubicación real no funciona.
                </p>
            </section>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setActiveTab('stats')}
                    className={cn(
                        "flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors",
                        activeTab === 'stats'
                            ? "bg-primary text-black"
                            : "bg-white/5 text-muted-foreground hover:bg-white/10"
                    )}
                >
                    📊 Estadísticas
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={cn(
                        "flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-colors",
                        activeTab === 'logs'
                            ? "bg-primary text-black"
                            : "bg-white/5 text-muted-foreground hover:bg-white/10"
                    )}
                >
                    📋 Developer Logs ({geofenceLogs.length})
                </button>
            </div>

            {activeTab === 'stats' ? (
                <>
                    {/* Stats Grid */}
                    <section className="mb-6">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase mb-3">Estadísticas en Tiempo Real</h2>
                        <div className="grid grid-cols-2 gap-2">
                            {zonaStats.map((stat) => (
                                <div key={stat.zona} className="card-glass p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-semibold text-white">{stat.zona.replace("_", " ")}</span>
                                        <div className="flex items-center gap-1 text-emerald-400">
                                            <Users className="h-3 w-3" />
                                            <span className="text-xs font-bold">{stat.taxistas_activos}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-amber-400" />
                                        <span className="text-lg font-mono font-bold text-amber-400">{stat.espera_promedio}'</span>
                                    </div>
                                    {stat.ultimo_registro && (
                                        <p className="text-[10px] text-muted-foreground mt-1">
                                            Último: {formatTime(stat.ultimo_registro)}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Recent Activity */}
                    <section>
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
                            Actividad Reciente ({registros.length} registros)
                        </h2>
                        <div className="card-glass overflow-hidden">
                            <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                                {registros.length === 0 ? (
                                    <p className="p-4 text-center text-muted-foreground text-sm">No hay registros recientes</p>
                                ) : (
                                    registros.map((reg) => (
                                        <div key={reg.id} className="px-3 py-2.5 border-b border-white/5">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className={cn("h-3 w-3", reg.exited_at ? "text-muted-foreground" : "text-emerald-400")} />
                                                    <span className="text-sm font-medium text-white">{reg.zona}</span>
                                                    <span className={cn(
                                                        "text-[10px] px-2 py-0.5 rounded-full",
                                                        reg.exited_at ? "bg-muted-foreground/20 text-muted-foreground" : "bg-emerald-500/20 text-emerald-400"
                                                    )}>
                                                        {reg.exited_at ? "Salió" : "En cola"}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">{anonymizeDeviceId(reg.device_id)}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-[10px] mt-1">
                                                <span className="font-mono text-blue-400">
                                                    📍 {reg.lat.toFixed(6)}, {reg.lng.toFixed(6)}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    {formatTime(reg.created_at)}
                                                    {reg.exited_at && ` → ${formatTime(reg.exited_at)}`}
                                                </span>
                                            </div>
                                            <a
                                                href={`https://maps.google.com/?q=${reg.lat},${reg.lng}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[9px] text-primary hover:underline mt-1 inline-block"
                                            >
                                                Ver en Google Maps ↗
                                            </a>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </section>
                </>
            ) : (
                /* Developer Logs Tab */
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase">
                            Geofence Logs ({geofenceLogs.length})
                        </h2>
                        <button
                            onClick={async () => {
                                const toast = document.createElement('div');
                                toast.className = "fixed bottom-4 right-4 bg-primary text-black px-4 py-2 rounded-lg shadow-lg z-50 animate-bounce";
                                toast.innerText = "Probando conexión...";
                                document.body.appendChild(toast);

                                const result = await checkConnection();

                                toast.className = `fixed bottom-4 right-4 text-white px-4 py-2 rounded-lg shadow-lg z-50 ${result.success ? 'bg-emerald-600' : 'bg-red-600'}`;
                                toast.innerText = result.message;

                                setTimeout(() => document.body.removeChild(toast), 5000);
                            }}
                            className="text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition-colors flex items-center gap-1"
                        >
                            <Activity className="h-3 w-3" /> Probar Conexión
                        </button>
                    </div>
                    <div className="card-glass overflow-hidden">
                        <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                            {geofenceLogs.length === 0 ? (
                                <div className="p-6 text-center">
                                    <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-muted-foreground text-sm">No hay logs de geofencing</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Activa el modo testing y muévete para generar logs
                                    </p>
                                </div>
                            ) : (
                                geofenceLogs.map((log) => (
                                    <div key={log.id} className="px-3 py-2.5">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                {/* Event Type Icon */}
                                                {log.event_type === 'ENTER_ZONE' && (
                                                    <span className="text-emerald-400 text-lg">📍</span>
                                                )}
                                                {log.event_type === 'EXIT_ZONE' && (
                                                    <span className="text-red-400 text-lg">🚪</span>
                                                )}
                                                {log.event_type === 'POSITION_UPDATE' && (
                                                    <span className="text-blue-400 text-lg">📡</span>
                                                )}

                                                {/* Event Type Badge */}
                                                <span className={cn(
                                                    "text-xs px-2 py-0.5 rounded-full font-medium",
                                                    log.event_type === 'ENTER_ZONE' && "bg-emerald-500/20 text-emerald-400",
                                                    log.event_type === 'EXIT_ZONE' && "bg-red-500/20 text-red-400",
                                                    log.event_type === 'POSITION_UPDATE' && "bg-blue-500/20 text-blue-400"
                                                )}>
                                                    {log.event_type === 'ENTER_ZONE' && "ENTRADA"}
                                                    {log.event_type === 'EXIT_ZONE' && "SALIDA"}
                                                    {log.event_type === 'POSITION_UPDATE' && "UPDATE"}
                                                </span>

                                                {/* Zone Transition */}
                                                {(log.previous_zona || log.zona) && (
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                        <span className={cn(
                                                            log.previous_zona === 'DEBUG' || !log.previous_zona
                                                                ? "text-muted-foreground"
                                                                : "text-white font-medium"
                                                        )}>
                                                            {log.previous_zona || "—"}
                                                        </span>
                                                        <span className="text-muted-foreground">→</span>
                                                        <span className={cn(
                                                            log.zona === 'DEBUG' || !log.zona
                                                                ? "text-muted-foreground"
                                                                : "text-white font-medium"
                                                        )}>
                                                            {log.zona || "—"}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Time */}
                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                {formatTime(log.created_at)}
                                            </span>
                                        </div>

                                        {/* Details Row */}
                                        <div className="flex items-center gap-3 text-[10px] mt-1 text-muted-foreground">
                                            <span className="font-mono text-blue-400">
                                                {log.lat.toFixed(5)}, {log.lng.toFixed(5)}
                                            </span>
                                            {log.accuracy && (
                                                <span>±{log.accuracy.toFixed(0)}m</span>
                                            )}
                                            {log.device_name && (
                                                <span className="text-amber-400">🚕 {log.device_name}</span>
                                            )}
                                            <span>{anonymizeDeviceId(log.device_id)}</span>
                                        </div>

                                        {/* Google Maps Link */}
                                        <a
                                            href={`https://maps.google.com/?q=${log.lat},${log.lng}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[9px] text-primary hover:underline mt-1 inline-block"
                                        >
                                            Ver en mapa ↗
                                        </a>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
