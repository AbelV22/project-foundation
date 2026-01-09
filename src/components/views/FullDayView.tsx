import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Plane, RefreshCw, Flame, Clock, ChevronDown, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface VueloRaw {
  hora: string;
  vuelo: string;
  aerolinea: string;
  origen: string;
  terminal: string;
  sala: string;
  estado: string;
  dia_relativo: number;
}

interface FullDayViewProps {
  onBack?: () => void;
}

// Lista de orígenes de larga distancia (high ticket)
const LONG_HAUL_ORIGINS = [
  "NEW YORK",
  "LOS ANGELES",
  "MIAMI",
  "CHICAGO",
  "WASHINGTON",
  "BOSTON",
  "SAN FRANCISCO",
  "TORONTO",
  "MONTREAL",
  "MEXICO",
  "BOGOTA",
  "BUENOS AIRES",
  "SAO PAULO",
  "LIMA",
  "SANTIAGO",
  "DOHA",
  "DUBAI",
  "ABU DHABI",
  "TOKYO",
  "SEOUL",
  "BEIJING",
  "SHANGHAI",
  "SINGAPORE",
  "HONG KONG",
  "BANGKOK",
  "DELHI",
  "MUMBAI",
  "JOHANNESBURG",
  "CAPE TOWN",
  "SYDNEY",
  "MELBOURNE",
  "TEL AVIV",
  "CAIRO",
  "EL CAIRO",
  "LAX",
  "JFK",
  "ORD",
  "DFW",
  "DOH",
  "DXB",
];

const isLongHaul = (origen: string): boolean => {
  const origenUpper = origen?.toUpperCase() || "";
  return LONG_HAUL_ORIGINS.some((lh) => origenUpper.includes(lh));
};

const getTerminalType = (vuelo: VueloRaw): "t1" | "t2" | "t2c" | "puente" => {
  const terminal = vuelo.terminal?.toUpperCase() || "";
  const codigosVuelo = vuelo.vuelo?.toUpperCase() || "";
  const origen = vuelo.origen?.toUpperCase() || "";
  if (terminal.includes("T2C") || terminal.includes("EASYJET")) return "t2c";
  if (codigosVuelo.includes("EJU") || codigosVuelo.includes("EZY")) return "t2c";
  if (origen.includes("MADRID") && codigosVuelo.includes("IBE")) return "puente";
  if (terminal.includes("T2A") || terminal.includes("T2B")) return "t2";
  if (terminal.includes("T1")) return "t1";
  return "t2";
};

const generateHourSlots = (startHour: number): string[] => {
  const slots: string[] = [];
  for (let i = 0; i < 24; i++) {
    const hour = (startHour + i) % 24;
    const nextHour = (hour + 1) % 24;
    slots.push(`${hour.toString().padStart(2, "0")} - ${nextHour.toString().padStart(2, "0")}`);
  }
  return slots;
};

export function FullDayView({ onBack }: FullDayViewProps) {
  const [vuelos, setVuelos] = useState<VueloRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  useEffect(() => {
    fetch("/vuelos.json?t=" + Date.now())
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setVuelos(data);
        } else if (data?.vuelos) {
          setVuelos(data.vuelos);
          if (data.meta?.update_time) {
            setLastUpdate(data.meta.update_time);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const now = new Date();
  const currentHour = now.getHours();
  const startHour = (currentHour - 1 + 24) % 24;

  const hourSlots = useMemo(() => generateHourSlots(startHour), [startHour]);

  const vuelosActivos = useMemo(() => vuelos.filter((v) => !v.estado?.toLowerCase().includes("cancelado")), [vuelos]);

  const vuelosPorTerminal = useMemo(() => {
    const data: Record<string, VueloRaw[]> = { t1: [], t2: [], t2c: [], puente: [] };
    vuelosActivos.forEach((v) => {
      const type = getTerminalType(v);
      data[type].push(v);
    });
    return data;
  }, [vuelosActivos]);

  // Agrupar vuelos por hora para T1 y T2
  const vuelosPorHora = useMemo(() => {
    const groups: Record<number, { t1: VueloRaw[]; t2: VueloRaw[] }> = {};
    for (let h = 0; h < 24; h++) {
      groups[h] = { t1: [], t2: [] };
    }

    vuelosPorTerminal.t1.forEach((v) => {
      const hour = parseInt(v.hora?.split(":")[0] || "0", 10);
      groups[hour].t1.push(v);
    });

    vuelosPorTerminal.t2.forEach((v) => {
      const hour = parseInt(v.hora?.split(":")[0] || "0", 10);
      groups[hour].t2.push(v);
    });

    return groups;
  }, [vuelosPorTerminal]);

  const countByHourAndTerminal = useMemo(() => {
    const counts: Record<string, Record<number, number>> = { t1: {}, t2: {}, t2c: {}, puente: {} };
    Object.entries(vuelosPorTerminal).forEach(([terminal, vuelos]) => {
      vuelos.forEach((v) => {
        const hour = parseInt(v.hora?.split(":")[0] || "0", 10);
        counts[terminal][hour] = (counts[terminal][hour] || 0) + 1;
      });
    });
    return counts;
  }, [vuelosPorTerminal]);

  const getVuelosHoraExacta = (terminal: "t2c" | "puente"): VueloRaw[] => {
    const nowMinutes = currentHour * 60 + now.getMinutes();
    const startMinutes = nowMinutes - 30;

    return vuelosPorTerminal[terminal]
      .filter((v) => {
        if (v.estado?.toLowerCase().includes("finalizado")) return false;
        const [h, m] = (v.hora || "00:00").split(":").map(Number);
        const vueloMinutes = h * 60 + m;
        return vueloMinutes >= startMinutes;
      })
      .sort((a, b) => {
        const [ha, ma] = (a.hora || "00:00").split(":").map(Number);
        const [hb, mb] = (b.hora || "00:00").split(":").map(Number);
        return ha * 60 + ma - (hb * 60 + mb);
      });
  };

  const maxT1 = Math.max(...Object.values(countByHourAndTerminal.t1), 1);
  const maxT2 = Math.max(...Object.values(countByHourAndTerminal.t2), 1);

  const totalT1 = vuelosPorTerminal.t1.length;
  const totalT2 = vuelosPorTerminal.t2.length;
  const totalPuente = vuelosPorTerminal.puente.length;
  const totalT2C = vuelosPorTerminal.t2c.length;

  const fechaFormateada = now.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  const diaSemana = now.toLocaleDateString("es-ES", { weekday: "long" }).toUpperCase();

  const puenteVuelos = getVuelosHoraExacta("puente");
  const t2cVuelos = getVuelosHoraExacta("t2c");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando vuelos...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border shadow-md hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-xl text-foreground">Vista Día</h1>
          <p className="text-[11px] text-muted-foreground">Toca una franja horaria para ver detalles</p>
        </div>
        {lastUpdate && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30">
            <Clock className="h-3 w-3 text-primary" />
            <span className="text-[10px] text-primary font-medium">{lastUpdate}</span>
          </div>
        )}
      </div>

      {/* Fecha */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 bg-card rounded-xl py-2.5 px-4 text-center border border-border shadow-sm">
          <span className="font-display font-bold text-foreground text-sm">{fechaFormateada}</span>
        </div>
        <div className="flex-1 bg-card rounded-xl py-2.5 px-4 text-center border border-border shadow-sm">
          <span className="font-display font-bold text-foreground text-sm capitalize">{diaSemana}</span>
        </div>
      </div>

      {/* Tabla con Acordeón - T1 y T2 */}
      <div className="grid grid-cols-2 gap-2">
        {/* Columna izquierda: T1 y T2 con acordeón */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-black/10">
          {/* Header */}
          <div className="grid grid-cols-3 bg-muted border-b border-border">
            <div className="py-2.5 px-1 text-center border-r border-border">
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">
                Hora
              </span>
            </div>
            <div className="py-2.5 px-1 text-center border-r border-border">
              <span className="text-[10px] font-display font-bold text-amber-500 uppercase tracking-wide">T1</span>
            </div>
            <div className="py-2.5 px-1 text-center">
              <span className="text-[10px] font-display font-bold text-blue-500 uppercase tracking-wide">T2</span>
            </div>
          </div>

          {/* Filas con Acordeón */}
          <div className="max-h-[55vh] overflow-y-auto scrollbar-dark">
            <Accordion type="single" collapsible className="w-full">
              {hourSlots.map((slot, idx) => {
                const hour = (startHour + idx) % 24;
                const countT1 = countByHourAndTerminal.t1[hour] || 0;
                const countT2 = countByHourAndTerminal.t2[hour] || 0;
                const isHotT1 = countT1 >= maxT1 * 0.7 && countT1 > 0;
                const isHotT2 = countT2 >= maxT2 * 0.7 && countT2 > 0;
                const isCurrentHour = hour === currentHour;
                const hasFlights = countT1 > 0 || countT2 > 0;
                const flightsT1 = vuelosPorHora[hour]?.t1 || [];
                const flightsT2 = vuelosPorHora[hour]?.t2 || [];
                const longHaulT1 = flightsT1.filter((f) => isLongHaul(f.origen)).length;
                const longHaulT2 = flightsT2.filter((f) => isLongHaul(f.origen)).length;

                return (
                  <AccordionItem
                    key={slot}
                    value={slot}
                    className={cn("border-b border-border/40", isCurrentHour && "bg-primary/15")}
                  >
                    <AccordionTrigger className="py-0 px-0 hover:no-underline [&[data-state=open]>div]:bg-muted/50">
                      <div className={cn("grid grid-cols-3 w-full", hasFlights && "cursor-pointer")}>
                        <div
                          className={cn(
                            "py-2 px-1 text-center border-r border-border/40 flex items-center justify-center gap-1",
                            isCurrentHour && "bg-primary/10",
                          )}
                        >
                          <span
                            className={cn(
                              "text-[9px] font-mono font-medium",
                              isCurrentHour ? "font-bold text-primary" : "text-muted-foreground",
                            )}
                          >
                            {slot}
                          </span>
                          {hasFlights && <ChevronDown className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
                        </div>
                        <div
                          className={cn(
                            "py-2 px-1 text-center border-r border-border/40 flex items-center justify-center gap-0.5",
                            isHotT1 && "bg-amber-500/15",
                          )}
                        >
                          {isHotT1 && <Flame className="h-3 w-3 text-amber-500" />}
                          <span
                            className={cn(
                              "font-display font-bold text-sm",
                              isHotT1 ? "text-amber-500" : "text-foreground",
                              countT1 === 0 && "text-muted-foreground/40",
                            )}
                          >
                            {countT1.toString().padStart(2, "0")}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "py-2 px-1 text-center flex items-center justify-center gap-0.5",
                            isHotT2 && "bg-blue-500/15",
                          )}
                        >
                          {isHotT2 && <Flame className="h-3 w-3 text-blue-500" />}
                          <span
                            className={cn(
                              "font-display font-bold text-sm",
                              isHotT2 ? "text-blue-500" : "text-foreground",
                              countT2 === 0 && "text-muted-foreground/40",
                            )}
                          >
                            {countT2.toString().padStart(2, "0")}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                      {hasFlights && (
                        <div className="bg-muted/30 border-t border-border/40">
                          {/* T1 Flights */}
                          {flightsT1.length > 0 && (
                            <div className="p-2 border-b border-border/30">
                              <span className="text-[9px] font-bold text-amber-500 uppercase mb-1 block">T1</span>
                              <div className="space-y-1">
                                {flightsT1.slice(0, 5).map((f, i) => {
                                  const isHighTicket = isLongHaul(f.origen);
                                  return (
                                    <div
                                      key={i}
                                      className={cn(
                                        "flex items-center gap-2 text-[10px] py-1 px-1.5 rounded",
                                        isHighTicket && "bg-yellow-500/10",
                                      )}
                                    >
                                      <span className="font-mono font-semibold text-white w-10">{f.hora}</span>
                                      <span className="text-muted-foreground truncate flex-1">
                                        {f.vuelo?.split("/")[0]}
                                      </span>
                                      {isHighTicket && <Globe className="h-3 w-3 text-yellow-500 shrink-0" />}
                                      <span className="text-muted-foreground/70 truncate max-w-[60px]">
                                        {f.origen?.split("(")[0]?.trim()}
                                      </span>
                                    </div>
                                  );
                                })}
                                {flightsT1.length > 5 && (
                                  <p className="text-[9px] text-muted-foreground text-center">
                                    +{flightsT1.length - 5} más
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                          {/* T2 Flights */}
                          {flightsT2.length > 0 && (
                            <div className="p-2">
                              <span className="text-[9px] font-bold text-blue-500 uppercase mb-1 block">T2</span>
                              <div className="space-y-1">
                                {flightsT2.slice(0, 5).map((f, i) => {
                                  const isHighTicket = isLongHaul(f.origen);
                                  return (
                                    <div
                                      key={i}
                                      className={cn(
                                        "flex items-center gap-2 text-[10px] py-1 px-1.5 rounded",
                                        isHighTicket && "bg-yellow-500/10",
                                      )}
                                    >
                                      <span className="font-mono font-semibold text-white w-10">{f.hora}</span>
                                      <span className="text-muted-foreground truncate flex-1">
                                        {f.vuelo?.split("/")[0]}
                                      </span>
                                      {isHighTicket && <Globe className="h-3 w-3 text-yellow-500 shrink-0" />}
                                      <span className="text-muted-foreground/70 truncate max-w-[60px]">
                                        {f.origen?.split("(")[0]?.trim()}
                                      </span>
                                    </div>
                                  );
                                })}
                                {flightsT2.length > 5 && (
                                  <p className="text-[9px] text-muted-foreground text-center">
                                    +{flightsT2.length - 5} más
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          {/* Totales */}
          <div className="grid grid-cols-3 bg-muted border-t border-border">
            <div className="py-2.5 px-1 text-center border-r border-border">
              <span className="text-[10px] font-display font-bold text-muted-foreground uppercase">Total</span>
            </div>
            <div className="py-2.5 px-1 text-center border-r border-border">
              <span className="font-display font-bold text-base text-amber-500">{totalT1}</span>
            </div>
            <div className="py-2.5 px-1 text-center">
              <span className="font-display font-bold text-base text-blue-500">{totalT2}</span>
            </div>
          </div>
        </div>

        {/* Columna derecha: Puente Aéreo y T2C */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg shadow-black/10">
          <div className="grid grid-cols-2 border-b border-border bg-muted">
            <div className="py-2.5 px-2 text-center border-r border-border">
              <span className="text-[9px] font-display font-bold text-red-500 uppercase leading-tight block">
                Puente
              </span>
              <span className="text-[9px] font-display font-bold text-red-500 uppercase leading-tight block">
                Aéreo
              </span>
            </div>
            <div className="py-2.5 px-2 text-center">
              <span className="text-[9px] font-display font-bold text-orange-500 uppercase leading-tight block">
                T2C
              </span>
              <span className="text-[9px] font-display font-bold text-orange-500 uppercase leading-tight block">
                EasyJet
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 max-h-[48vh] overflow-y-auto scrollbar-dark">
            <div className="border-r border-border">
              {puenteVuelos.length === 0 ? (
                <div className="p-4 text-center text-[10px] text-muted-foreground">Sin vuelos</div>
              ) : (
                puenteVuelos.map((vuelo, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-2.5 border-b border-border/40">
                    <span className="font-display font-bold text-xs text-red-500">{vuelo.hora}</span>
                    <Plane className="h-3 w-3 text-muted-foreground/60" />
                  </div>
                ))
              )}
            </div>

            <div>
              {t2cVuelos.length === 0 ? (
                <div className="p-4 text-center text-[10px] text-muted-foreground">Sin vuelos</div>
              ) : (
                t2cVuelos.map((vuelo, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-2.5 border-b border-border/40">
                    <span className="font-display font-bold text-xs text-orange-500">{vuelo.hora}</span>
                    <Plane className="h-3 w-3 text-muted-foreground/60" />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 bg-muted border-t border-border">
            <div className="py-2.5 px-2 text-center border-r border-border">
              <span className="font-display font-bold text-base text-red-500">{totalPuente}</span>
            </div>
            <div className="py-2.5 px-2 text-center">
              <span className="font-display font-bold text-base text-orange-500">{totalT2C}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-3 p-3 rounded-xl bg-card border border-border shadow-sm space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Flame className="h-4 w-4 text-amber-500" />
          <span className="font-medium">= Hora caliente</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe className="h-4 w-4 text-yellow-500" />
          <span className="font-medium">= Larga Distancia (High Ticket)</span>
        </div>
      </div>
    </div>
  );
}
