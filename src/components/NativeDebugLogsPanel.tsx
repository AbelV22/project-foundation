import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Smartphone, Wifi, WifiOff, MapPin, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface DebugLog {
  id: string;
  device_id: string;
  device_name: string | null;
  event_type: string;
  message: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  is_background: boolean | null;
  app_state: string | null;
  created_at: string;
}

interface Props {
  deviceFilter?: string;
  maxItems?: number;
  autoRefresh?: boolean;
}

export function NativeDebugLogsPanel({ deviceFilter, maxItems = 50, autoRefresh = true }: Props) {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("location_debug_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(maxItems);

      // Filter by device if provided
      if (deviceFilter) {
        query = query.or(`device_id.eq.${deviceFilter},device_name.eq.${deviceFilter}`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching debug logs:", error);
        return;
      }

      setLogs(data || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();

    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 10000); // Refresh every 10s
      return () => clearInterval(interval);
    }
  }, [deviceFilter, autoRefresh]);

  const getEventIcon = (eventType: string, message: string) => {
    if (message.includes("✅") || eventType.includes("success")) {
      return <MapPin className="h-4 w-4 text-emerald-400" />;
    }
    if (message.includes("❌") || eventType.includes("error")) {
      return <AlertTriangle className="h-4 w-4 text-red-400" />;
    }
    if (eventType.includes("network") || eventType.includes("http")) {
      return message.includes("❌") 
        ? <WifiOff className="h-4 w-4 text-red-400" />
        : <Wifi className="h-4 w-4 text-blue-400" />;
    }
    return <Smartphone className="h-4 w-4 text-muted-foreground" />;
  };

  const getEventBgColor = (eventType: string, message: string) => {
    if (message.includes("✅") || eventType.includes("success")) {
      return "bg-emerald-500/10 border-emerald-500/20";
    }
    if (message.includes("❌") || eventType.includes("error")) {
      return "bg-red-500/10 border-red-500/20";
    }
    if (message.includes("⚠️") || eventType.includes("warning")) {
      return "bg-amber-500/10 border-amber-500/20";
    }
    if (eventType.includes("alarm") || eventType.includes("triggered")) {
      return "bg-blue-500/10 border-blue-500/20";
    }
    return "bg-white/5 border-white/10";
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Hoy";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Ayer";
    }
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  // Group logs by date
  const groupedLogs: Record<string, DebugLog[]> = {};
  logs.forEach(log => {
    const dateKey = formatDate(log.created_at);
    if (!groupedLogs[dateKey]) {
      groupedLogs[dateKey] = [];
    }
    groupedLogs[dateKey].push(log);
  });

  // Count success/error
  const successCount = logs.filter(l => l.message.includes("✅") || l.event_type.includes("success")).length;
  const errorCount = logs.filter(l => l.message.includes("❌") || l.event_type.includes("error")).length;

  return (
    <section className="card-glass p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <span className="font-semibold text-white">Logs Servicio Nativo</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
            Android
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400">✅ {successCount}</span>
            <span className="text-red-400">❌ {errorCount}</span>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4 text-white", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {lastRefresh && (
        <p className="text-[10px] text-muted-foreground mb-2">
          Última actualización: {lastRefresh.toLocaleTimeString("es-ES")}
        </p>
      )}

      {logs.length === 0 ? (
        <div className="text-center py-8">
          <Smartphone className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No hay logs del servicio nativo
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Los logs aparecerán cuando uses la APK en Android
          </p>
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto space-y-3">
          {Object.entries(groupedLogs).map(([dateKey, dateLogs]) => (
            <div key={dateKey}>
              <div className="sticky top-0 bg-background/80 backdrop-blur-sm py-1 mb-2">
                <span className="text-xs font-medium text-muted-foreground">{dateKey}</span>
              </div>
              <div className="space-y-1">
                {dateLogs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "p-2 rounded-lg border text-xs",
                      getEventBgColor(log.event_type, log.message)
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {getEventIcon(log.event_type, log.message)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-mono text-muted-foreground">
                            {formatTime(log.created_at)}
                          </span>
                          {log.device_name && (
                            <span className="text-primary truncate max-w-[100px]">
                              {log.device_name}
                            </span>
                          )}
                        </div>
                        <p className="text-white break-words">{log.message}</p>
                        {log.app_state && (
                          <p className="text-muted-foreground mt-1">
                            Estado: {log.app_state}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-3 text-center">
        📱 Estos logs vienen del servicio nativo Android (ForegroundService + AlarmManager)
      </p>
    </section>
  );
}
