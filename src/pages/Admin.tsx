import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, MapPin, Clock, Users, Lock, LogOut, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function Admin() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [registros, setRegistros] = useState<RegistroReten[]>([]);
    const [zonaStats, setZonaStats] = useState<ZonaStats[]>([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

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
            fetchData();
            const interval = setInterval(fetchData, 30000); // Refresh every 30s
            return () => clearInterval(interval);
        }
    }, [isAuthenticated]);

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
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-white">Panel Admin</h1>
                    <p className="text-sm text-muted-foreground">Monitoring en tiempo real</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchData}
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
                                    {/* GPS Coordinates for debugging */}
                                    <div className="flex items-center gap-4 text-[10px] mt-1">
                                        <span className="font-mono text-blue-400">
                                            📍 {reg.lat.toFixed(6)}, {reg.lng.toFixed(6)}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {formatTime(reg.created_at)}
                                            {reg.exited_at && ` → ${formatTime(reg.exited_at)}`}
                                        </span>
                                    </div>
                                    {/* Google Maps link for verification */}
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
        </div>
    );
}
