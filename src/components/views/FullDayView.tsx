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

      {/* Two-Table Layout */}
      <div className="grid grid-cols-2 gap-2">
        {/* Left Table: T1 & T2 */}
        <div className="rounded-xl border border-border bg-card shadow-lg shadow-black/10 overflow-hidden flex flex-col">
          {/* Header - using table for perfect alignment */}
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-muted to-muted/80">
                <th className="w-[72px] py-2.5 px-1 text-center border-b border-border">
                  <span className="text-[10px] font-display font-bold text-muted-foreground uppercase tracking-wide">
                    Hora
                  </span>
                </th>
                <th className="py-2.5 px-1 text-center border-b border-l border-border">
                  <span className="text-[11px] font-display font-bold text-amber-500 uppercase tracking-wide">T1</span>
                </th>
                <th className="py-2.5 px-1 text-center border-b border-l border-border">
                  <span className="text-[11px] font-display font-bold text-blue-500 uppercase tracking-wide">T2</span>
                </th>
              </tr>
            </thead>
          </table>

          {/* Body with Accordion */}
          <div className="flex-1 max-h-[50vh] overflow-y-auto scrollbar-dark">
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
                    className={cn("border-b border-border/30", isCurrentHour && "bg-primary/10")}
                  >
                    <AccordionTrigger className="py-0 px-0 hover:no-underline [&[data-state=open]>table]:bg-muted/30">
                      <table className="w-full table-fixed border-collapse">
                        <tbody>
                          <tr>
                            <td className={cn("w-[72px] py-2 px-1 text-center", isCurrentHour && "bg-primary/15")}>
                              <div className="flex items-center justify-center gap-0.5">
                                <span className={cn(
                                  "text-[9px] font-mono font-semibold",
                                  isCurrentHour ? "font-bold text-primary" : "text-muted-foreground"
                                )}>
                                  {slot}
                                </span>
                                {hasFlights && <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />}
                              </div>
                            </td>
                            <td className={cn(
                              "py-2 px-1 text-center border-l border-border/30",
                              isHotT1 && "bg-amber-500/10"
                            )}>
                              <div className="flex items-center justify-center gap-0.5">
                                {isHotT1 && <Flame className="h-3 w-3 text-amber-500" />}
                                <span className={cn(
                                  "font-display font-bold text-sm tabular-nums",
                                  isHotT1 ? "text-amber-500" : "text-foreground",
                                  countT1 === 0 && "text-muted-foreground/30"
                                )}>
                                  {countT1.toString().padStart(2, "0")}
                                </span>
                              </div>
                            </td>
                            <td className={cn(
                              "py-2 px-1 text-center border-l border-border/30",
                              isHotT2 && "bg-blue-500/10"
                            )}>
                              <div className="flex items-center justify-center gap-0.5">
                                {isHotT2 && <Flame className="h-3 w-3 text-blue-500" />}
                                <span className={cn(
                                  "font-display font-bold text-sm tabular-nums",
                                  isHotT2 ? "text-blue-500" : "text-foreground",
                                  countT2 === 0 && "text-muted-foreground/30"
                                )}>
                                  {countT2.toString().padStart(2, "0")}
                                </span>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </AccordionTrigger>

                    <AccordionContent className="pb-0">
                      {hasFlights && (
                        <div className="bg-muted/20 border-t border-border/30 p-2">
                          <div className="grid grid-cols-2 gap-2">
                            {/* T1 Flights */}
                            {flightsT1.length > 0 && (
                              <div>
                                <span className="text-[8px] font-bold text-amber-500 uppercase mb-1 block">T1</span>
                                <div className="space-y-0.5">
                                  {flightsT1.slice(0, 3).map((f, i) => (
                                    <div key={i} className={cn(
                                      "flex items-center gap-1 text-[9px] py-0.5 px-1 rounded",
                                      isLongHaul(f.origen) && "bg-yellow-500/10"
                                    )}>
                                      <span className="font-mono font-semibold text-foreground">{f.hora}</span>
                                      {isLongHaul(f.origen) && <Globe className="h-2.5 w-2.5 text-yellow-500" />}
                                      <span className="text-muted-foreground/60 truncate">{f.origen?.split("(")[0]?.trim()?.slice(0, 6)}</span>
                                    </div>
                                  ))}
                                  {flightsT1.length > 3 && (
                                    <span className="text-[8px] text-muted-foreground">+{flightsT1.length - 3} más</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {/* T2 Flights */}
                            {flightsT2.length > 0 && (
                              <div>
                                <span className="text-[8px] font-bold text-blue-500 uppercase mb-1 block">T2</span>
                                <div className="space-y-0.5">
                                  {flightsT2.slice(0, 3).map((f, i) => (
                                    <div key={i} className={cn(
                                      "flex items-center gap-1 text-[9px] py-0.5 px-1 rounded",
                                      isLongHaul(f.origen) && "bg-yellow-500/10"
                                    )}>
                                      <span className="font-mono font-semibold text-foreground">{f.hora}</span>
                                      {isLongHaul(f.origen) && <Globe className="h-2.5 w-2.5 text-yellow-500" />}
                                      <span className="text-muted-foreground/60 truncate">{f.origen?.split("(")[0]?.trim()?.slice(0, 6)}</span>
                                    </div>
                                  ))}
                                  {flightsT2.length > 3 && (
                                    <span className="text-[8px] text-muted-foreground">+{flightsT2.length - 3} más</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          {/* Footer */}
          <table className="w-full table-fixed border-collapse">
            <tfoot>
              <tr className="bg-gradient-to-r from-muted to-muted/80">
                <td className="w-[72px] py-2.5 px-1 text-center border-t border-border">
                  <span className="text-[9px] font-display font-bold text-muted-foreground uppercase">Total</span>
                </td>
                <td className="py-2.5 px-1 text-center border-t border-l border-border">
                  <span className="font-display font-bold text-base text-amber-500 tabular-nums">{totalT1}</span>
                </td>
                <td className="py-2.5 px-1 text-center border-t border-l border-border">
                  <span className="font-display font-bold text-base text-blue-500 tabular-nums">{totalT2}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Right Table: Puente Aéreo & T2C */}
        <div className="rounded-xl border border-border bg-card shadow-lg shadow-black/10 overflow-hidden flex flex-col">
          {/* Header */}
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-muted to-muted/80">
                <th className="py-2.5 px-2 text-center border-b border-border">
                  <div className="flex flex-col items-center leading-tight">
                    <span className="text-[10px] font-display font-bold text-red-500 uppercase">Puente</span>
                    <span className="text-[8px] font-display text-red-500/70 uppercase">Aéreo</span>
                  </div>
                </th>
                <th className="py-2.5 px-2 text-center border-b border-l border-border">
                  <div className="flex flex-col items-center leading-tight">
                    <span className="text-[10px] font-display font-bold text-orange-500 uppercase">T2C</span>
                    <span className="text-[8px] font-display text-orange-500/70 uppercase">EasyJet</span>
                  </div>
                </th>
              </tr>
            </thead>
          </table>

          {/* Body */}
          <div className="flex-1 max-h-[50vh] overflow-y-auto scrollbar-dark">
            <table className="w-full table-fixed border-collapse">
              <tbody>
                {hourSlots.map((slot, idx) => {
                  const hour = (startHour + idx) % 24;
                  const isCurrentHour = hour === currentHour;

                  const puenteForHour = vuelosPorTerminal.puente.filter(v => {
                    const h = parseInt(v.hora?.split(":")[0] || "0", 10);
                    return h === hour;
                  }).sort((a, b) => a.hora.localeCompare(b.hora));

                  const t2cForHour = vuelosPorTerminal.t2c.filter(v => {
                    const h = parseInt(v.hora?.split(":")[0] || "0", 10);
                    return h === hour;
                  }).sort((a, b) => a.hora.localeCompare(b.hora));

                  return (
                    <tr key={slot} className={cn("border-b border-border/30", isCurrentHour && "bg-primary/10")}>
                      <td className="py-2 px-2 text-center align-middle h-[36px]">
                        {puenteForHour.length === 0 ? (
                          <span className="text-[9px] text-muted-foreground/25">—</span>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            {puenteForHour.slice(0, 2).map((vuelo, i) => (
                              <span key={i} className="font-mono font-bold text-[9px] text-red-500 leading-tight">
                                {vuelo.hora}
                              </span>
                            ))}
                            {puenteForHour.length > 2 && (
                              <span className="text-[7px] text-red-500/60">+{puenteForHour.length - 2}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center align-middle border-l border-border/30 h-[36px]">
                        {t2cForHour.length === 0 ? (
                          <span className="text-[9px] text-muted-foreground/25">—</span>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            {t2cForHour.slice(0, 2).map((vuelo, i) => (
                              <span key={i} className="font-mono font-bold text-[9px] text-orange-500 leading-tight">
                                {vuelo.hora}
                              </span>
                            ))}
                            {t2cForHour.length > 2 && (
                              <span className="text-[7px] text-orange-500/60">+{t2cForHour.length - 2}</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <table className="w-full table-fixed border-collapse">
            <tfoot>
              <tr className="bg-gradient-to-r from-muted to-muted/80">
                <td className="py-2.5 px-2 text-center border-t border-border">
                  <span className="font-display font-bold text-base text-red-500 tabular-nums">{totalPuente}</span>
                </td>
                <td className="py-2.5 px-2 text-center border-t border-l border-border">
                  <span className="font-display font-bold text-base text-orange-500 tabular-nums">{totalT2C}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 p-3 rounded-xl bg-card/50 border border-border/50">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Flame className="h-3.5 w-3.5 text-amber-500" />
          <span>Hora caliente</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Globe className="h-3.5 w-3.5 text-yellow-500" />
          <span>Larga Distancia</span>
        </div>
      </div>
    </div>
  );
}
