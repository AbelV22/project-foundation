import { useState, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Plane, Search, ExternalLink, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { deduplicateFlights } from "@/lib/flightUtils";
import type { VueloRaw } from "@/lib/flightUtils";

interface FlightListViewProps {
    onBack?: () => void;
}

const getTerminalGroup = (terminal: string, vuelo: string): string => {
    const t = terminal?.toUpperCase() || "";
    const v = vuelo?.toUpperCase() || "";
    if (t.includes("T2C") || t.includes("EASY") || v.startsWith("EJU") || v.startsWith("EZY")) return "T2C";
    if (t.includes("T2A") || t.includes("T2B")) return "T2";
    if (t.includes("T2") && !t.includes("T2C")) return "T2";
    if (t.includes("T1")) return "T1";
    return "T2";
};

const getEstadoColor = (estado: string) => {
    const s = estado?.toUpperCase() || "";
    if (s.includes("FINALIZ")) return "text-emerald-400";
    if (s.includes("SALA")) return "text-blue-400";
    if (s.includes("HORA")) return "text-cyan-400";
    if (s.includes("RETRAS")) return "text-amber-400";
    if (s.includes("CANCEL")) return "text-red-400";
    return "text-muted-foreground";
};

export function FlightListView({ onBack }: FlightListViewProps) {
    const [vuelos, setVuelos] = useState<VueloRaw[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterTerminal, setFilterTerminal] = useState<string>("all");
    const [filterDia, setFilterDia] = useState<number>(0);
    const [selectedHour, setSelectedHour] = useState<number | null>(null);
    const flightListRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch("/vuelos.json?t=" + Date.now())
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) setVuelos(deduplicateFlights(data));
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const now = new Date();
    const currentHour = now.getHours();

    const dias = useMemo(() => {
        const d = new Set(vuelos.map(v => v.dia_relativo));
        return Array.from(d).sort();
    }, [vuelos]);

    // All flights for current day, optionally filtered by terminal
    const dayFlights = useMemo(() => {
        return vuelos
            .filter(v => v.dia_relativo === filterDia)
            .filter(v => {
                if (filterTerminal !== "all") {
                    return getTerminalGroup(v.terminal, v.vuelo) === filterTerminal;
                }
                return true;
            })
            .filter(v => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toUpperCase();
                return (
                    v.vuelo?.toUpperCase().includes(q) ||
                    v.origen?.toUpperCase().includes(q) ||
                    v.hora?.includes(q)
                );
            })
            .sort((a, b) => {
                const [ha, ma] = (a.hora || "00:00").split(":").map(Number);
                const [hb, mb] = (b.hora || "00:00").split(":").map(Number);
                return (ha * 60 + ma) - (hb * 60 + mb);
            });
    }, [vuelos, filterDia, filterTerminal, searchQuery]);

    // Terminal counts
    const terminalCounts = useMemo(() => {
        const df = vuelos.filter(v => v.dia_relativo === filterDia);
        const counts: Record<string, number> = { all: df.length, T1: 0, T2: 0, T2C: 0 };
        df.forEach(v => {
            const g = getTerminalGroup(v.terminal, v.vuelo);
            counts[g] = (counts[g] || 0) + 1;
        });
        return counts;
    }, [vuelos, filterDia]);

    // Group by hour
    const hourGroups = useMemo(() => {
        const groups: Record<number, VueloRaw[]> = {};
        for (let h = 0; h < 24; h++) groups[h] = [];
        dayFlights.forEach(v => {
            const h = parseInt(v.hora?.split(":")[0] || "0", 10);
            groups[h].push(v);
        });
        return groups;
    }, [dayFlights]);

    // Get flights for selected hour
    const selectedFlights = selectedHour !== null ? hourGroups[selectedHour] || [] : [];

    const handleHourClick = (hour: number) => {
        if (selectedHour === hour) {
            setSelectedHour(null); // Toggle off
        } else {
            setSelectedHour(hour);
            // Scroll to flight list
            setTimeout(() => {
                flightListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 50);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto pb-20">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-background border-b border-border/50">
                <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                        {onBack && (
                            <button onClick={onBack} className="p-1 -ml-1">
                                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                            </button>
                        )}
                        <Plane className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">Base de Datos Vuelos</span>
                    </div>
                    <a
                        href="https://www.aena.es/es/infovuelos.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 text-[10px] text-primary bg-primary/10 rounded-md"
                    >
                        <ExternalLink className="h-3 w-3" /> Comparar AENA
                    </a>
                </div>

                {/* Day + Terminal tabs */}
                <div className="flex items-center gap-2 px-3 py-1">
                    {/* Day */}
                    <div className="flex gap-1">
                        {dias.map(d => (
                            <button
                                key={d}
                                onClick={() => { setFilterDia(d); setSelectedHour(null); }}
                                className={cn(
                                    "px-2 py-0.5 text-[10px] font-medium rounded-full",
                                    filterDia === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                )}
                            >
                                {d === 0 ? "Hoy" : d === 1 ? "Mañana" : `+${d}`}
                            </button>
                        ))}
                    </div>
                    <div className="w-px h-4 bg-border/50" />
                    {/* Terminal */}
                    {[
                        { key: "all", label: "Todos" },
                        { key: "T1", label: "T1" },
                        { key: "T2", label: "T2" },
                        { key: "T2C", label: "T2C" },
                    ].map(t => (
                        <button
                            key={t.key}
                            onClick={() => { setFilterTerminal(t.key); setSelectedHour(null); }}
                            className={cn(
                                "px-2 py-0.5 text-[10px] font-medium rounded-full",
                                filterTerminal === t.key
                                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                                    : "bg-muted/50 text-muted-foreground"
                            )}
                        >
                            {t.label} <span className="font-mono font-bold">{terminalCounts[t.key] || 0}</span>
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="px-3 py-1.5">
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setSelectedHour(null); }}
                            placeholder="Buscar vuelo, ciudad, IATA..."
                            className="w-full h-7 pl-7 pr-2 rounded-md bg-muted/50 border border-border/50 text-[11px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                </div>
            </div>

            {/* HOUR GRID - Click to expand all flights of that hour */}
            <div className="px-3 py-2">
                <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
                    Selecciona una hora para ver todos los vuelos
                </div>
                <div className="grid grid-cols-6 gap-1">
                    {Array.from({ length: 24 }, (_, h) => {
                        const count = hourGroups[h]?.length || 0;
                        const isSelected = selectedHour === h;
                        const isCurrent = filterDia === 0 && h === currentHour;
                        return (
                            <button
                                key={h}
                                onClick={() => handleHourClick(h)}
                                className={cn(
                                    "flex flex-col items-center py-1.5 rounded-lg text-center transition-all",
                                    isSelected
                                        ? "bg-primary text-primary-foreground ring-2 ring-primary"
                                        : isCurrent
                                            ? "bg-primary/10 text-primary border border-primary/30"
                                            : count > 0
                                                ? "bg-muted/50 text-foreground hover:bg-muted"
                                                : "bg-muted/20 text-muted-foreground/40"
                                )}
                                disabled={count === 0}
                            >
                                <span className="text-[10px] font-medium">{h.toString().padStart(2, "0")}:00</span>
                                <span className={cn(
                                    "font-mono text-sm font-black tabular-nums",
                                    count === 0 && "opacity-30"
                                )}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* If searching, show all search results directly */}
            {searchQuery.trim() && (
                <div ref={flightListRef}>
                    <div className="px-3 py-1.5 bg-muted/30 border-y border-border/20 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">
                            Resultados de búsqueda
                        </span>
                        <span className="font-mono text-[10px] font-bold text-foreground">{dayFlights.length} vuelos</span>
                    </div>
                    {dayFlights.map((v, idx) => (
                        <FlightRow key={idx} vuelo={v} />
                    ))}
                </div>
            )}

            {/* EXPANDED FLIGHT LIST for selected hour */}
            {selectedHour !== null && !searchQuery.trim() && (
                <div ref={flightListRef} className="border-t border-primary/30">
                    <div className="sticky top-[120px] z-[5] px-3 py-2 bg-primary/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary">
                                {selectedHour.toString().padStart(2, "0")}:00 — {selectedHour.toString().padStart(2, "0")}:59
                            </span>
                            <span className="font-mono text-xs font-black text-primary">{selectedFlights.length} vuelos</span>
                        </div>
                        <button onClick={() => setSelectedHour(null)} className="text-[10px] text-primary flex items-center gap-0.5">
                            Cerrar <ChevronUp className="h-3 w-3" />
                        </button>
                    </div>

                    {selectedFlights.length === 0 ? (
                        <div className="py-8 text-center text-xs text-muted-foreground">Sin vuelos en esta hora</div>
                    ) : (
                        selectedFlights.map((v, idx) => (
                            <FlightRow key={idx} vuelo={v} />
                        ))
                    )}
                </div>
            )}

            {/* No hour selected hint */}
            {selectedHour === null && !searchQuery.trim() && (
                <div className="py-8 text-center text-xs text-muted-foreground">
                    <Plane className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
                    Toca una hora para ver todos sus vuelos
                </div>
            )}
        </div>
    );
}

/* Individual flight row component */
function FlightRow({ vuelo: v }: { vuelo: VueloRaw }) {
    const tGroup = getTerminalGroup(v.terminal, v.vuelo);
    const numCodes = v.vuelo ? v.vuelo.split("/").filter(c => c.trim()).length : 0;
    const originCity = v.origen && v.origen !== "N/A" && v.origen !== "-"
        ? v.origen.split("(")[0].split("/")[0].trim()
        : "—";
    const originCode = v.origen?.match(/\(([A-Z]{3})\)/)?.[1] || "";

    return (
        <div className="grid grid-cols-[48px_1fr] gap-1.5 px-3 py-2 border-b border-border/10">
            {/* Time */}
            <span className="font-mono text-xs font-bold tabular-nums text-foreground text-center pt-0.5">
                {v.hora}
            </span>

            {/* Details */}
            <div className="min-w-0 space-y-0.5">
                {/* Origin + Terminal + Status */}
                <div className="flex items-center gap-1">
                    <span className="text-[11px] font-medium text-foreground truncate flex-1">
                        {originCity}
                        {originCode && <span className="text-muted-foreground ml-1">({originCode})</span>}
                    </span>
                    <span className={cn(
                        "text-[8px] font-bold px-1.5 py-0.5 rounded",
                        tGroup === "T1" ? "bg-amber-500/20 text-amber-400"
                            : tGroup === "T2C" ? "bg-orange-500/20 text-orange-400"
                                : "bg-blue-500/20 text-blue-400"
                    )}>
                        {v.terminal || tGroup}
                    </span>
                    <span className={cn("text-[8px] font-medium", getEstadoColor(v.estado))}>
                        {v.estado}
                    </span>
                </div>

                {/* Flight codes - show ALL, no truncation */}
                <div className="text-[9px] text-muted-foreground/70 font-mono break-all leading-tight">
                    {v.vuelo || "N/A"}
                    {numCodes > 1 && (
                        <span className="text-purple-400/60 ml-1">({numCodes} codeshares)</span>
                    )}
                </div>

                {/* Sala */}
                {v.sala && v.sala !== "-" && v.sala !== "" && (
                    <div className="text-[8px] text-muted-foreground/50">Sala: {v.sala}</div>
                )}
            </div>
        </div>
    );
}
