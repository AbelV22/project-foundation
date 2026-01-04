import { Plane, Clock, Users, ArrowRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DashboardData, Vuelo } from "../views/DashboardView";

// --- 1. DEFINIMOS QUÉ DATOS ESPERA RECIBIR ESTE WIDGET ---
interface FlightsWidgetProps {
  expanded?: boolean;
  onTerminalClick?: (terminalId: string) => void;
  onViewAllClick?: () => void;
  // Nuevas props con datos reales
  kpis?: DashboardData['resumen_cards'];
  grafica?: { name: string; pax: number }[];
  vuelos?: Vuelo[];
  esperaMinutos?: number;
}

export function FlightsWidget({ 
    expanded = false, 
    onTerminalClick, 
    onViewAllClick,
    kpis,
    grafica,
    vuelos,
    esperaMinutos = 25
}: FlightsWidgetProps) {

  // Si aún no han llegado los datos, mostramos un esqueleto o null
  if (!kpis || !grafica) return <div className="card-dashboard p-10 animate-pulse bg-slate-900/50">Cargando Radar...</div>;
  // Preparamos los datos para el loop de tarjetas (igual que tu diseño original pero con datos reales)
  const terminals = [
    { id: "t1", name: "T1 General", arrivals: kpis.t1.vuelos, passengers: kpis.t1.pax, color: "#3B82F6" },
    { id: "t2", name: "T2 General", arrivals: kpis.t2.vuelos, passengers: kpis.t2.pax, color: "#10B981" },
    { id: "puente", name: "P. Aéreo", arrivals: kpis.puente.vuelos, passengers: kpis.puente.pax, color: "#8B5CF6" },
    { id: "t2c", name: "T2C EasyJet", arrivals: kpis.t2c.vuelos, passengers: kpis.t2c.pax, color: "#F97316" },
  ];

  return (
    <div className="card-dashboard p-4 md:p-5 space-y-6">
      
      {/* HEADER DEL WIDGET */}
      <div className="flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={onViewAllClick}
        >
          <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <Plane className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm md:text-base">Llegadas Aeropuerto BCN</h3>
            <p className="text-xs md:text-sm text-muted-foreground flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Radar Activo
            </p>
          </div>
        </div>
      </div>

      {/* 1. TARJETAS DE TERMINALES (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {terminals.map((terminal) => (
          <div 
            key={terminal.id}
            onClick={() => onTerminalClick?.(terminal.id)}
            className="text-center p-3 md:p-4 rounded-xl border border-border hover:border-blue-500/30 transition-all cursor-pointer hover:bg-slate-800/50 group"
          >
            <div className="flex items-center justify-center gap-1 md:gap-2 mb-2 md:mb-3 text-slate-400 group-hover:text-white">
              <span className="font-medium text-xs md:text-sm uppercase tracking-wide">{terminal.name}</span>
            </div>
            
            <p className="text-2xl md:text-3xl font-display font-bold mb-1 text-white group-hover:scale-110 transition-transform">
                {terminal.arrivals}
            </p>
            <p className="text-xs md:text-sm text-muted-foreground mb-2">vuelos</p>
            
            <div className="flex items-center justify-center gap-1 font-bold" style={{ color: terminal.color }}>
              <Users className="h-3 w-3 md:h-4 md:w-4" />
              <span className="text-xs md:text-sm">{terminal.passengers.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Espera en Reten Aeropuerto */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-400" />
          <span className="text-xs text-muted-foreground">Espera media en retén aeropuerto</span>
        </div>
        <span className="font-display font-bold text-blue-400">~{esperaMinutos} min</span>
      </div>

      {/* 2. GRÁFICA DE EVOLUCIÓN (NUEVO) */}
      <div className="h-48 w-full bg-slate-950/30 rounded-xl p-2 border border-slate-800/50">
        <div className="flex justify-between items-center px-2 mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase">Curva de Demanda (Pax/Hora)</span>
        </div>
        <ResponsiveContainer width="100%" height="85%">
            <AreaChart data={grafica}>
                <defs>
                    <linearGradient id="colorPax" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tickLine={false} axisLine={false} fontSize={10} interval={3} />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', fontSize: '12px' }} 
                    itemStyle={{ color: '#f59e0b' }}
                    labelStyle={{ display: 'none' }}
                    formatter={(value: number) => [`${value} pax`, 'Demanda']}
                />
                <Area type="monotone" dataKey="pax" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorPax)" />
            </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 3. LISTA DE VUELOS RESUMIDA (NUEVO) */}
      {!expanded && vuelos && (
        <div className="mt-4 pt-4 border-t border-border">
            <div className="flex justify-between items-center mb-3 px-1">
                <span className="text-xs font-semibold text-slate-400 uppercase">Próximos Aterrizajes</span>
                <button onClick={onViewAllClick} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    Ver tabla completa <ArrowRight size={12} />
                </button>
            </div>
            <div className="space-y-2">
                {vuelos.slice(0, 3).map((vuelo, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm p-2 hover:bg-slate-800/30 rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-yellow-500 font-bold">{vuelo.hora}</span>
                            <div>
                                <div className="text-white font-medium">{vuelo.aerolinea}</div>
                                <div className="text-xs text-slate-500 flex gap-1">
                                    {vuelo.avion && <span>{vuelo.avion} •</span>} {vuelo.id}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                vuelo.terminal.includes('1') ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' : 'bg-green-500/10 text-green-300 border-green-500/20'
                            }`}>
                                {vuelo.terminal}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
}
