import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Clock, MapPin, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserPresence {
    id: string;
    device_id: string;
    zona: string;
    created_at: string;
    exited_at: string | null;
    lat: number;
    lng: number;
}

interface TimelineItemProps {
    presence: UserPresence;
}

const ZONE_COLORS: Record<string, string> = {
    T1: "bg-blue-500",
    T2: "bg-purple-500",
    SANTS: "bg-green-500",
    PUENTE_AEREO: "bg-orange-500",
    T2C_EASY: "bg-pink-500",
};

export function UserPresenceTimeline() {
    const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
    const [historicalData, setHistoricalData] = useState<UserPresence[]>([]);
    const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
    const [selectedZone, setSelectedZone] = useState<string | "all">("all");
    const [loading, setLoading] = useState(false);

    const zones = ["T1", "T2", "SANTS", "PUENTE_AEREO", "T2C_EASY"];

    // Fetch active users (currently in zones)
    const fetchActiveUsers = async () => {
        const { data, error } = await supabase
            .from("registros_reten")
            .select("*")
            .is("exited_at", null)
            .in("zona", zones)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching active users:", error);
            return;
        }
        setActiveUsers(data || []);
    };

    // Fetch historical timeline data
    const fetchHistoricalData = async () => {
        setLoading(true);
        try {
            const hoursAgo = timeRange === "24h" ? 24 : timeRange === "7d" ? 168 : 720;
            const startTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

            let query = supabase
                .from("registros_reten")
                .select("*")
                .gte("created_at", startTime)
                .in("zona", selectedZone === "all" ? zones : [selectedZone])
                .order("created_at", { ascending: false })
                .limit(200);

            const { data, error } = await query;

            if (error) throw error;
            setHistoricalData(data || []);
        } catch (error) {
            console.error("Error fetching historical data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActiveUsers();
        fetchHistoricalData();

        // Real-time subscription for active users
        const channel = supabase
            .channel("presence_changes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "registros_reten",
                },
                () => {
                    fetchActiveUsers();
                    fetchHistoricalData();
                }
            )
            .subscribe();

        // Refresh every 10 seconds
        const interval = setInterval(() => {
            fetchActiveUsers();
        }, 10000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [timeRange, selectedZone]);

    const formatDeviceId = (deviceId: string) => {
        if (deviceId.match(/^D\d+$/)) {
            return deviceId;
        }
        return deviceId.substring(0, 4) + "..." + deviceId.substring(deviceId.length - 4);
    };

    const calculateDuration = (startTime: string, endTime: string | null): string => {
        const start = new Date(startTime).getTime();
        const end = endTime ? new Date(endTime).getTime() : Date.now();
        const durationMinutes = Math.floor((end - start) / 60000);

        if (durationMinutes < 60) {
            return `${durationMinutes} min`;
        }
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        return `${hours}h ${minutes}m`;
    };

    const getTimeAgo = (timestamp: string): string => {
        const now = Date.now();
        const time = new Date(timestamp).getTime();
        const diffMinutes = Math.floor((now - time) / 60000);

        if (diffMinutes < 1) return "Ahora";
        if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
        const hours = Math.floor(diffMinutes / 60);
        if (hours < 24) return `Hace ${hours}h`;
        const days = Math.floor(hours / 24);
        return `Hace ${days}d`;
    };

    // Active users grouped by zone
    const activeByZone = zones.reduce((acc, zone) => {
        acc[zone] = activeUsers.filter((u) => u.zona === zone);
        return acc;
    }, {} as Record<string, UserPresence[]>);

    return (
        <div className="space-y-4">
            {/* Section 1: Currently Active Users */}
            <section className="card-glass p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-emerald-400" />
                        <h3 className="font-semibold text-white">Usuarios Activos en Zonas</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                            🟢 {activeUsers.length} activos
                        </span>
                    </div>
                </div>

                {activeUsers.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No hay usuarios activos en zonas</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {zones.map((zone) => {
                            const usersInZone = activeByZone[zone];
                            if (usersInZone.length === 0) return null;

                            return (
                                <div
                                    key={zone}
                                    className="bg-black/20 rounded-lg p-3 border border-white/5"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={cn(
                                                    "w-2 h-2 rounded-full",
                                                    ZONE_COLORS[zone] || "bg-gray-500"
                                                )}
                                            />
                                            <span className="font-medium text-white text-sm">
                                                {zone.replace("_", " ")}
                                            </span>
                                        </div>
                                        <span className="text-xs text-emerald-400 font-bold">
                                            {usersInZone.length}
                                        </span>
                                    </div>

                                    <div className="space-y-1.5">
                                        {usersInZone.map((user) => (
                                            <div
                                                key={user.id}
                                                className="flex items-center justify-between text-xs bg-white/5 rounded px-2 py-1.5"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-white font-mono">
                                                        {formatDeviceId(user.device_id)}
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        {getTimeAgo(user.created_at)}
                                                    </span>
                                                </div>
                                                <span className="text-amber-400 font-medium">
                                                    {calculateDuration(user.created_at, null)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Section 2: Historical Timeline */}
            <section className="card-glass p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-400" />
                        <h3 className="font-semibold text-white">Historial de Presencia</h3>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {/* Time Range Selector */}
                    <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1">
                        <button
                            onClick={() => setTimeRange("24h")}
                            className={cn(
                                "px-3 py-1 rounded text-xs font-medium transition-colors",
                                timeRange === "24h"
                                    ? "bg-primary text-black"
                                    : "text-muted-foreground hover:text-white"
                            )}
                        >
                            24h
                        </button>
                        <button
                            onClick={() => setTimeRange("7d")}
                            className={cn(
                                "px-3 py-1 rounded text-xs font-medium transition-colors",
                                timeRange === "7d"
                                    ? "bg-primary text-black"
                                    : "text-muted-foreground hover:text-white"
                            )}
                        >
                            7d
                        </button>
                        <button
                            onClick={() => setTimeRange("30d")}
                            className={cn(
                                "px-3 py-1 rounded text-xs font-medium transition-colors",
                                timeRange === "30d"
                                    ? "bg-primary text-black"
                                    : "text-muted-foreground hover:text-white"
                            )}
                        >
                            30d
                        </button>
                    </div>

                    {/* Zone Filter */}
                    <div className="flex items-center gap-1 bg-black/20 rounded-lg p-1">
                        <button
                            onClick={() => setSelectedZone("all")}
                            className={cn(
                                "px-3 py-1 rounded text-xs font-medium transition-colors",
                                selectedZone === "all"
                                    ? "bg-primary text-black"
                                    : "text-muted-foreground hover:text-white"
                            )}
                        >
                            Todas
                        </button>
                        {zones.map((zone) => (
                            <button
                                key={zone}
                                onClick={() => setSelectedZone(zone)}
                                className={cn(
                                    "px-3 py-1 rounded text-xs font-medium transition-colors",
                                    selectedZone === zone
                                        ? "bg-primary text-black"
                                        : "text-muted-foreground hover:text-white"
                                )}
                            >
                                {zone}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Timeline Items */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p className="text-sm">Cargando...</p>
                        </div>
                    ) : historicalData.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No hay datos históricos</p>
                        </div>
                    ) : (
                        historicalData.map((presence) => (
                            <TimelineItem key={presence.id} presence={presence} />
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}

function TimelineItem({ presence }: TimelineItemProps) {
    const duration = presence.exited_at
        ? Math.floor(
              (new Date(presence.exited_at).getTime() -
                  new Date(presence.created_at).getTime()) /
                  60000
          )
        : Math.floor((Date.now() - new Date(presence.created_at).getTime()) / 60000);

    const maxDuration = 120; // 2 hours for visualization
    const widthPercent = Math.min((duration / maxDuration) * 100, 100);

    const formatDeviceId = (deviceId: string) => {
        if (deviceId.match(/^D\d+$/)) {
            return deviceId;
        }
        return deviceId.substring(0, 4) + "..." + deviceId.substring(deviceId.length - 4);
    };

    const formatTime = (isoString: string) => {
        return new Date(isoString).toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="bg-black/20 rounded-lg p-3 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div
                        className={cn(
                            "w-2 h-2 rounded-full",
                            ZONE_COLORS[presence.zona] || "bg-gray-500"
                        )}
                    />
                    <span className="font-medium text-white text-sm">
                        {presence.zona.replace("_", " ")}
                    </span>
                    <span
                        className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full",
                            presence.exited_at
                                ? "bg-muted-foreground/20 text-muted-foreground"
                                : "bg-emerald-500/20 text-emerald-400"
                        )}
                    >
                        {presence.exited_at ? "Completado" : "🟢 Activo"}
                    </span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                    {formatDeviceId(presence.device_id)}
                </span>
            </div>

            {/* Duration Bar */}
            <div className="mb-2">
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className={cn(
                            "h-full rounded-full transition-all duration-300",
                            ZONE_COLORS[presence.zona] || "bg-gray-500"
                        )}
                        style={{ width: `${widthPercent}%` }}
                    />
                </div>
            </div>

            {/* Event Details */}
            <div className="flex items-center justify-between text-xs">
                <div className="text-muted-foreground">
                    {new Date(presence.created_at).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </div>
                <span className="text-amber-400 font-medium">
                    {duration < 60 ? `${duration} min` : `${Math.floor(duration / 60)}h ${duration % 60}m`}
                </span>
            </div>

            {/* Google Maps Link */}
            <a
                href={`https://maps.google.com/?q=${presence.lat},${presence.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] text-primary hover:underline mt-1 inline-block"
            >
                📍 Ver en Google Maps ↗
            </a>
        </div>
    );
}
