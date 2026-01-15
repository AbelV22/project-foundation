import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Info, AlertCircle, Tag, BarChart3, Calendar, Activity, Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LabelList } from "recharts";

interface OfertaDetalle {
  fuente: string;
  dia: string;
  modelo: string;
  precio_neto: number;
  raw?: string;
}

interface WebFeedData {
  ticker: {
    current_price: number;
    delta_value: number;
    delta_percent: number;
    direction: string;
    volume: number;
    volatility: number;
  };
  charts: {
    history_dates: string[];
    history_prices: number[];
    price_by_day_descanso: Record<string, number>;
  };
  market_depth: {
    cheapest_offers: OfertaDetalle[];
    all_offers: OfertaDetalle[];
  };
  updated_at: string;
}

interface HistoryEntry {
  date: string;
  avg_price: number;
  median_price: number;
  min_price: number;
  max_price: number;
  volume: number;
  volatility_std: number;
}

// Premium gold color
const GOLD = "#FACC15";

// Parse CSV to array of objects
const parseCSV = (text: string): HistoryEntry[] => {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  
  return lines.slice(1).map(line => {
    const [date, avg_price, median_price, min_price, max_price, volume, volatility_std] = line.split(',');
    return {
      date,
      avg_price: parseInt(avg_price, 10),
      median_price: parseInt(median_price, 10),
      min_price: parseInt(min_price, 10),
      max_price: parseInt(max_price, 10),
      volume: parseInt(volume, 10),
      volatility_std: parseInt(volatility_std, 10)
    };
  });
};

export function LicensesView() {
  const [data, setData] = useState<WebFeedData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/web_feed.json?t=" + Date.now()).then(res => res.json()),
      fetch("/history_stats.csv?t=" + Date.now()).then(res => res.text())
    ])
      .then(([jsonData, csvText]) => {
        setData(jsonData);
        setHistory(parseCSV(csvText));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-mono">Cargando análisis de licencias...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Error al cargar datos</p>
      </div>
    );
  }

  const { ticker, charts, market_depth } = data;

  // Calculate stats from web_feed
  const preciosNetos = market_depth.all_offers.map(o => o.precio_neto);
  const minPrice = Math.min(...preciosNetos);
  const maxPrice = Math.max(...preciosNetos);
  const avgPrice = preciosNetos.reduce((a, b) => a + b, 0) / preciosNetos.length;

  // Use trend from web_feed ticker
  const trendPercent = ticker.delta_percent.toFixed(1);
  const trendIsUp = ticker.direction === "up" || ticker.delta_percent > 0;

  // Temporal evolution data from CSV
  const evolucionTemporal = history.length > 0 
    ? history.map(h => ({
        fecha: h.date.slice(5).replace('-', '/'), // "2026-01-11" -> "01/11"
        precio: h.median_price
      }))
    : [{ fecha: "hoy", precio: ticker.current_price }];

  // Prepare bar chart data from web_feed - sorted by value
  const chartDataPorDia = Object.entries(charts.price_by_day_descanso)
    .map(([dia, valor]) => ({
      dia: dia.replace(" IMPAR", " I").replace(" PAR", " P"),
      diaFull: dia,
      valor,
      label: `${(valor / 1000).toFixed(0)}k €`
    }))
    .sort((a, b) => a.valor - b.valor);

  // Sorted offers from web_feed
  const ofertasOrdenadas = [...market_depth.all_offers].sort((a, b) => a.precio_neto - b.precio_neto);

  // Custom tooltip for area chart
  const CustomAreaTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover/95 backdrop-blur-md border border-border rounded-lg px-4 py-3 shadow-2xl">
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="font-mono text-lg font-bold text-primary tabular-nums">
            {payload[0].value.toLocaleString('es-ES')} €
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for bar chart
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover/95 backdrop-blur-md border border-border rounded-lg px-4 py-3 shadow-2xl">
          <p className="text-xs text-muted-foreground mb-1">{data.diaFull}</p>
          <p className="font-mono text-lg font-bold text-primary tabular-nums">
            {data.valor.toLocaleString('es-ES')} €
          </p>
        </div>
      );
    }
    return null;
  };

  const getDayColor = (dia: string): string => {
    return GOLD;
  };

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Reference Price Card */}
        <div className="relative overflow-hidden rounded-xl bg-card border border-border p-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <Tag className="h-4 w-4 text-primary" />
              </div>
              {/* Trend Badge */}
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium font-mono tabular-nums",
                trendIsUp 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              )}>
                {trendIsUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {trendIsUp ? "+" : ""}{trendPercent}%
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Ref. Mercado</p>
            <p className="font-mono font-bold text-2xl md:text-3xl text-primary tabular-nums tracking-tight">
              {ticker.current_price.toLocaleString('es-ES')}
              <span className="text-lg ml-1">€</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">precio mediano neto</p>
          </div>
        </div>

        {/* Minimum Price Card */}
        <div className="relative overflow-hidden rounded-xl bg-card border border-border p-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <TrendingDown className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium font-mono tabular-nums bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Activity className="h-3 w-3" />
                MIN
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Precio Mínimo</p>
            <p className="font-mono font-bold text-2xl md:text-3xl text-emerald-400 tabular-nums tracking-tight">
              {minPrice.toLocaleString('es-ES')}
              <span className="text-lg ml-1">€</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">precio neto</p>
          </div>
        </div>

        {/* Maximum Price Card */}
        <div className="relative overflow-hidden rounded-xl bg-card border border-border p-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20">
                <TrendingUp className="h-4 w-4 text-red-400" />
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium font-mono tabular-nums bg-red-500/10 text-red-400 border border-red-500/20">
                <Activity className="h-3 w-3" />
                MAX
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Precio Máximo</p>
            <p className="font-mono font-bold text-2xl md:text-3xl text-red-400 tabular-nums tracking-tight">
              {maxPrice.toLocaleString('es-ES')}
              <span className="text-lg ml-1">€</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">precio neto</p>
          </div>
        </div>

        {/* Total Offers Card */}
        <div className="relative overflow-hidden rounded-xl bg-card border border-border p-4 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/20">
                <BarChart3 className="h-4 w-4 text-sky-400" />
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                LIVE
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Anuncios Activos</p>
            <p className="font-mono font-bold text-2xl md:text-3xl text-sky-400 tabular-nums tracking-tight">
              {ticker.volume}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">ofertas válidas</p>
          </div>
        </div>
      </div>

      {/* Temporal Evolution Chart */}
      <div className="rounded-xl bg-card border border-border p-5 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-3">
          <div>
            <h3 className="font-display font-semibold text-foreground text-base">Evolución Temporal</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Histórico del precio mediano de referencia</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-primary font-medium font-mono">ACTUALIZADO</span>
          </div>
        </div>

        <div className="h-52 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={evolucionTemporal} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.4} />
                  <stop offset="50%" stopColor={GOLD} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="fecha" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#6b7280', fontFamily: 'monospace' }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#6b7280', fontFamily: 'monospace' }} 
                tickFormatter={value => `${(value / 1000).toFixed(0)}k`} 
                domain={['dataMin - 1000', 'dataMax + 1000']} 
                width={40} 
              />
              <Tooltip content={<CustomAreaTooltip />} />
              <Area 
                type="monotone" 
                dataKey="precio" 
                stroke={GOLD}
                strokeWidth={2.5}
                fill="url(#goldGradient)"
                dot={false}
                activeDot={{ 
                  r: 6, 
                  stroke: GOLD, 
                  strokeWidth: 2, 
                  fill: '#0d0d12' 
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-sky-500/5 border border-sky-500/10">
          <Info className="h-4 w-4 text-sky-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-sky-400">Sistema nuevo:</span> El histórico crece automáticamente cada día con nuevos datos.
          </p>
        </div>
      </div>

      {/* Bar Chart - Price by Rest Day */}
      <div className="rounded-xl bg-card border border-border p-5 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-3">
          <div>
            <h3 className="font-display font-semibold text-foreground text-base">Precio por Día de Descanso</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Valor mediano neto según festivo</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-primary font-medium font-mono">HOY</span>
          </div>
        </div>

        <div className="h-56 md:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartDataPorDia} 
              layout="vertical" 
              margin={{ left: 5, right: 60, top: 5, bottom: 5 }}
              onMouseLeave={() => setHoveredBarIndex(null)}
            >
              <XAxis 
                type="number"
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#6b7280', fontFamily: 'monospace' }}
                tickFormatter={value => `${(value / 1000).toFixed(0)}k`}
                domain={['dataMin - 5000', 'dataMax + 10000']}
              />
              <YAxis 
                type="category"
                dataKey="dia" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#9ca3af', fontFamily: 'monospace' }}
                width={75}
              />
              <Tooltip content={<CustomBarTooltip />} cursor={false} />
              <Bar 
                dataKey="valor" 
                radius={[0, 6, 6, 0]}
                onMouseEnter={(_, index) => setHoveredBarIndex(index)}
              >
                {chartDataPorDia.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={GOLD}
                    fillOpacity={hoveredBarIndex === null ? 0.85 : hoveredBarIndex === index ? 1 : 0.3}
                    style={{ transition: 'fill-opacity 0.2s ease' }}
                  />
                ))}
                <LabelList 
                  dataKey="label" 
                  position="right" 
                  fill="#9ca3af"
                  fontSize={11}
                  fontFamily="monospace"
                  offset={8}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
          <Info className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-emerald-400">Días más baratos:</span> Jueves Par suele tener los precios más bajos.
          </p>
        </div>
      </div>

      {/* Portal Comparison - Calculate from all_offers */}
      {(() => {
        const portalStats: Record<string, number[]> = {};
        market_depth.all_offers.forEach(o => {
          if (!portalStats[o.fuente]) portalStats[o.fuente] = [];
          portalStats[o.fuente].push(o.precio_neto);
        });
        const portalMedians = Object.entries(portalStats).map(([fuente, precios]) => {
          const sorted = [...precios].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          return { fuente, median };
        });
        return (
          <div className="rounded-xl bg-card border border-border p-5 backdrop-blur-sm">
            <h3 className="font-display font-semibold text-foreground text-base mb-4">Mediana por Portal</h3>
            <div className="grid grid-cols-2 gap-3">
              {portalMedians.map(({ fuente, median }) => (
                <div key={fuente} className="p-4 rounded-xl bg-muted/30 border border-border hover:border-primary/30 transition-colors">
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-mono">{fuente}</p>
                  <p className="font-mono font-bold text-xl text-foreground tabular-nums">
                    {median.toLocaleString('es-ES')}
                    <span className="text-sm ml-1 text-muted-foreground">€</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Listings */}
      <div className="rounded-xl bg-card border border-border p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-foreground text-base">Ofertas Detectadas</h3>
          <Badge variant="outline" className="font-mono text-xs px-3 py-1 border-border bg-muted/50">
            {market_depth.all_offers.length} anuncios
          </Badge>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {ofertasOrdenadas.map((oferta, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-muted/30 border border-border hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-display font-medium text-foreground text-sm">{oferta.fuente}</span>
                  <Badge 
                    variant="outline" 
                    className="text-[10px] px-2 py-0.5 font-mono border-primary/30 text-primary bg-primary/10"
                  >
                    {oferta.dia}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  {oferta.modelo !== "DESCONOCIDO" && oferta.modelo !== "SIN COCHE" && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Car className="h-3.5 w-3.5" />
                      <span className="font-mono tabular-nums">{oferta.modelo}</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-primary text-xl tabular-nums">
                    {oferta.precio_neto.toLocaleString('es-ES')}
                    <span className="text-sm ml-0.5">€</span>
                  </span>
                  <p className="text-[10px] text-muted-foreground font-mono">neto</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto scrollbar-dark">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="pb-3 font-medium font-mono uppercase tracking-wider">Fuente</th>
                <th className="pb-3 font-medium font-mono uppercase tracking-wider">Día Descanso</th>
                <th className="pb-3 font-medium font-mono uppercase tracking-wider">Coche</th>
                <th className="pb-3 font-medium font-mono uppercase tracking-wider text-right">Precio Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {ofertasOrdenadas.map((oferta, idx) => (
                <tr key={idx} className="hover:bg-muted/30 transition-colors group">
                  <td className="py-3">
                    <span className="font-display font-medium text-foreground text-sm">{oferta.fuente}</span>
                  </td>
                  <td className="py-3">
                    <Badge 
                      variant="outline" 
                      className="text-[10px] px-2.5 py-1 font-mono border-primary/30 text-primary bg-primary/10"
                    >
                      {oferta.dia}
                    </Badge>
                  </td>
                  <td className="py-3">
                    {oferta.modelo !== "DESCONOCIDO" && oferta.modelo !== "SIN COCHE" ? (
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <p className="text-xs text-foreground">{oferta.modelo}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin coche</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <span className="font-mono font-bold text-primary text-base tabular-nums group-hover:text-primary">
                      {oferta.precio_neto.toLocaleString('es-ES')} €
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology note */}
      <div className="rounded-xl bg-card border border-border p-4 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
            <AlertCircle className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h4 className="font-display font-semibold text-foreground text-sm mb-1">Metodología</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Escaneamos Milanuncios y Solano Taxi diariamente. Si incluye vehículo, 
              estimamos su valor de mercado y lo restamos para obtener el precio neto de la licencia.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
