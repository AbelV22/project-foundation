import { useState } from "react";
import {
  RefreshCw,
  AlertCircle,
  Activity,
  Clock,
  Layers,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Car,
  Building2,
  Zap,
  TrendingUp,
  TrendingDown,
  Target
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
  Line
} from "recharts";
import { useLicenciasAnalisis } from "@/contexts/DataContext";

// Colors
const COLORS = {
  gold: "#FACC15",
  green: "#10B981",
  red: "#EF4444",
  blue: "#3B82F6",
  purple: "#8B5CF6",
  cyan: "#06B6D4",
  muted: "#6B7280"
};

// Format price
const formatPrice = (price: number, short = false): string => {
  if (!price || isNaN(price)) return "0";
  if (short) return `${(price / 1000).toFixed(0)}k`;
  return price.toLocaleString('es-ES');
};

// Get source color
const getSourceColor = (source: string): string => {
  switch (source.toUpperCase()) {
    case 'SOLANO': return COLORS.blue;
    case 'STAC': return COLORS.purple;
    case 'MILANUNCIOS': return COLORS.cyan;
    default: return COLORS.muted;
  }
};

export function LicensesView() {
  // Use the advanced licencias hook with full market analysis
  const {
    analisis,
    ticker,
    ofertas,
    ofertasBaratas,
    historial,
    porPortal,
    porDiaDescanso,
    mejorDia,
    precioMercado,
    spread,
    spreadPorcentaje,
    tendencia7D,
    tendencia14D,
    volatilidad7D,
    soporte,
    resistencia,
    loading,
    error,
    refresh
  } = useLicenciasAnalisis();

  const [selectedTimeframe, setSelectedTimeframe] = useState<'7D' | '14D' | 'ALL'>('ALL');
  const [showSMA, setShowSMA] = useState(true);
  const [showSMA14, setShowSMA14] = useState(false);

  // Prepare chart data from historial
  const chartData = historial.map(h => ({
    date: h.fecha,
    dateShort: h.fecha.slice(5).replace('-', '/'),
    price: h.precioMediano,
    sma7: h.sma7,
    sma14: h.sma14,
    min: h.precioMinimo,
    max: h.precioMaximo,
    volume: h.volumen,
    volatility: h.volatilidad
  }));

  const filteredChartData = selectedTimeframe === '7D'
    ? chartData.slice(-7)
    : selectedTimeframe === '14D'
      ? chartData.slice(-14)
      : chartData;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-mono">Cargando análisis de mercado...</p>
      </div>
    );
  }

  if (error || !analisis || !ticker) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Error al cargar datos</p>
        <button
          onClick={refresh}
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const isUp = ticker.tendencia === 'up' || ticker.deltaPorcentaje > 0;

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const priceData = payload.find((p: any) => p.dataKey === 'price');
      const sma7Data = payload.find((p: any) => p.dataKey === 'sma7');
      const sma14Data = payload.find((p: any) => p.dataKey === 'sma14');

      return (
        <div className="bg-card/95 backdrop-blur-md border border-border rounded-lg p-3 shadow-xl">
          <p className="text-[10px] text-muted-foreground font-mono mb-2">{label}</p>
          {priceData && (
            <div className="flex items-center justify-between gap-4 mb-1">
              <span className="text-xs text-muted-foreground">Precio</span>
              <span className="font-mono font-bold text-primary tabular-nums">
                {formatPrice(priceData.value)}€
              </span>
            </div>
          )}
          {sma7Data && sma7Data.value > 0 && (
            <div className="flex items-center justify-between gap-4 mb-1">
              <span className="text-xs text-muted-foreground">SMA-7</span>
              <span className="font-mono text-sm text-cyan-400 tabular-nums">
                {formatPrice(sma7Data.value)}€
              </span>
            </div>
          )}
          {sma14Data && sma14Data.value > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-muted-foreground">SMA-14</span>
              <span className="font-mono text-sm text-amber-400 tabular-nums">
                {formatPrice(sma14Data.value)}€
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3 animate-fade-in pb-20">
      {/* === TICKER HEADER - Bloomberg Style === */}
      <div className="card-glass p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-muted-foreground">LICENCIA TAXI BCN</span>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-black text-3xl text-primary tabular-nums tracking-tight">
                {formatPrice(ticker.precioActual)}
              </span>
              <span className="text-lg text-primary">€</span>
            </div>
          </div>

          {/* Delta Badge */}
          <div className={cn(
            "flex flex-col items-end gap-1 px-3 py-2 rounded-lg",
            isUp ? "bg-emerald-500/10" : "bg-red-500/10"
          )}>
            <div className={cn(
              "flex items-center gap-1 font-mono font-bold text-lg tabular-nums",
              isUp ? "text-emerald-400" : "text-red-400"
            )}>
              {isUp ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {isUp ? "+" : ""}{formatPrice(ticker.deltaValor)}€
            </div>
            <span className={cn(
              "text-xs font-mono tabular-nums",
              isUp ? "text-emerald-400/80" : "text-red-400/80"
            )}>
              {isUp ? "+" : ""}{ticker.deltaPorcentaje.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Mini Stats Row */}
        <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border/30">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">Vol</p>
            <p className="font-mono font-semibold text-sm text-foreground tabular-nums">{ticker.volumen}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">7D</p>
            <p className={cn(
              "font-mono font-semibold text-sm tabular-nums",
              tendencia7D >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {tendencia7D >= 0 ? "+" : ""}{tendencia7D.toFixed(1)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">Soporte</p>
            <p className="font-mono font-semibold text-sm text-emerald-400 tabular-nums">{formatPrice(soporte, true)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">Resist.</p>
            <p className="font-mono font-semibold text-sm text-red-400 tabular-nums">{formatPrice(resistencia, true)}</p>
          </div>
        </div>

        {/* Updated timestamp */}
        <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-border/20">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-mono">{ticker.fechaActualizacion}</span>
        </div>
      </div>

      {/* === ADVANCED METRICS === */}
      <div className="grid grid-cols-2 gap-2">
        <div className="card-glass p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-medium">Tendencia 14D</span>
          </div>
          <p className={cn(
            "font-mono font-bold text-xl tabular-nums",
            tendencia14D >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {tendencia14D >= 0 ? "+" : ""}{tendencia14D.toFixed(1)}%
          </p>
        </div>
        <div className="card-glass p-3">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-medium">Volatilidad</span>
          </div>
          <p className="font-mono font-bold text-xl tabular-nums text-amber-400">
            {formatPrice(volatilidad7D, true)}
          </p>
        </div>
      </div>

      {/* === MAIN CHART === */}
      <div className="card-glass p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Evolución</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Timeframe selector */}
            <div className="flex bg-muted/50 rounded-lg p-0.5">
              {(['7D', '14D', 'ALL'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={cn(
                    "px-2 py-1 text-[10px] font-mono rounded-md transition-all",
                    selectedTimeframe === tf
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
            {/* SMA toggles */}
            <button
              onClick={() => setShowSMA(!showSMA)}
              className={cn(
                "px-2 py-1 text-[10px] font-mono rounded-md border transition-all",
                showSMA
                  ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/10"
                  : "border-border text-muted-foreground"
              )}
            >
              SMA7
            </button>
            <button
              onClick={() => setShowSMA14(!showSMA14)}
              className={cn(
                "px-2 py-1 text-[10px] font-mono rounded-md border transition-all",
                showSMA14
                  ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                  : "border-border text-muted-foreground"
              )}
            >
              SMA14
            </button>
          </div>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="dateShort"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: COLORS.muted, fontFamily: 'monospace' }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fill: COLORS.muted, fontFamily: 'monospace' }}
                tickFormatter={v => formatPrice(v, true)}
                domain={['dataMin - 2000', 'dataMax + 2000']}
                width={35}
              />
              <Tooltip content={<CustomTooltip />} />
              {/* Support & Resistance lines */}
              <ReferenceLine y={soporte} stroke={COLORS.green} strokeDasharray="3 3" strokeOpacity={0.5} />
              <ReferenceLine y={resistencia} stroke={COLORS.red} strokeDasharray="3 3" strokeOpacity={0.5} />
              <Area
                type="monotone"
                dataKey="price"
                stroke={COLORS.gold}
                strokeWidth={2}
                fill="url(#priceGradient)"
                dot={false}
                activeDot={{ r: 4, stroke: COLORS.gold, strokeWidth: 2, fill: '#0d0d12' }}
              />
              {showSMA && (
                <Line
                  type="monotone"
                  dataKey="sma7"
                  stroke={COLORS.cyan}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                  connectNulls={false}
                />
              )}
              {showSMA14 && (
                <Line
                  type="monotone"
                  dataKey="sma14"
                  stroke="#F59E0B"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  dot={false}
                  connectNulls={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Chart legend */}
        <div className="flex items-center justify-center gap-4 mt-2 pt-2 border-t border-border/20 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-primary rounded" />
            <span className="text-[10px] text-muted-foreground">Precio</span>
          </div>
          {showSMA && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-cyan-400 rounded" />
              <span className="text-[10px] text-muted-foreground">SMA-7</span>
            </div>
          )}
          {showSMA14 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-amber-400 rounded" />
              <span className="text-[10px] text-muted-foreground">SMA-14</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-emerald-400/50 rounded" />
            <span className="text-[10px] text-muted-foreground">Soporte</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-red-400/50 rounded" />
            <span className="text-[10px] text-muted-foreground">Resist.</span>
          </div>
        </div>
      </div>

      {/* === MARKET DEPTH === */}
      <div className="card-glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Profundidad de Mercado</span>
        </div>

        {/* Spread indicator */}
        <div className="mb-4 p-3 rounded-lg bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Spread</span>
            <span className="font-mono font-bold text-sm text-foreground tabular-nums">
              {formatPrice(spread)}€ ({spreadPorcentaje.toFixed(1)}%)
            </span>
          </div>
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="absolute left-0 h-full bg-gradient-to-r from-emerald-500 via-primary to-red-500 rounded-full"
              style={{ width: '100%' }}
            />
            {spread > 0 && (
              <div
                className="absolute h-4 w-1 bg-white rounded-full -top-1 shadow-lg"
                style={{
                  left: `${Math.min(100, Math.max(0, ((ticker.precioActual - soporte) / spread) * 100))}%`,
                  transform: 'translateX(-50%)'
                }}
              />
            )}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-mono text-emerald-400">{formatPrice(soporte, true)}</span>
            <span className="text-[10px] font-mono text-red-400">{formatPrice(resistencia, true)}</span>
          </div>
        </div>

        {/* Price by day - Now using processed data */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-2">Precio por Día de Descanso</p>
          {porDiaDescanso.slice(0, 5).map((dia, idx) => (
            <div
              key={dia.dia}
              className="flex items-center gap-3 p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{dia.diaDisplay}</span>
                  {idx === 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-medium">
                      Mejor día
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">{dia.totalOfertas} ofertas</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-sm text-foreground tabular-nums">
                  {formatPrice(dia.precioMediano)}€
                </span>
                <span className={cn(
                  "block text-[10px] font-mono tabular-nums",
                  dia.diferenciaVsMedia < 0 ? "text-emerald-400" : dia.diferenciaVsMedia > 0 ? "text-red-400" : "text-muted-foreground"
                )}>
                  {dia.diferenciaVsMedia > 0 ? "+" : ""}{formatPrice(dia.diferenciaVsMedia)}€
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* === TOP OFFERS === */}
      <div className="card-glass p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-foreground">Mejores Ofertas</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            {ofertas.length} activas
          </span>
        </div>

        <div className="space-y-2">
          {ofertasBaratas.slice(0, 5).map((oferta, idx) => (
            <div
              key={oferta.id}
              className={cn(
                "p-3 rounded-xl border transition-all",
                idx === 0
                  ? "bg-emerald-500/5 border-emerald-500/30"
                  : "bg-muted/20 border-border/50 hover:border-border"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${getSourceColor(oferta.fuente)}20`,
                        color: getSourceColor(oferta.fuente)
                      }}
                    >
                      {oferta.fuente}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {oferta.diaDescanso}
                    </span>
                  </div>
                  {oferta.modelo && oferta.modelo !== "DESCONOCIDO" && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Car className="h-3 w-3" />
                      <span>{oferta.marca} {oferta.modelo !== oferta.marca && oferta.modelo}</span>
                      {oferta.incluyeCoche && (
                        <span className="text-[9px] text-muted-foreground/70">
                          (+{formatPrice(oferta.valorCoche, true)} coche)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className={cn(
                    "font-mono font-bold text-lg tabular-nums",
                    idx === 0 ? "text-emerald-400" : "text-foreground"
                  )}>
                    {formatPrice(oferta.precioNeto)}€
                  </span>
                  {idx === 0 && (
                    <p className="text-[10px] text-emerald-400/70">mejor precio</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View all button */}
        <button className="w-full mt-3 py-2 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors">
          Ver todas las ofertas
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* === SOURCE COMPARISON === */}
      <div className="card-glass p-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Por Portal</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {porPortal.map(portal => (
            <div
              key={portal.fuente}
              className="p-3 rounded-xl bg-muted/30 border border-border/50"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getSourceColor(portal.fuente) }}
                />
                <span className="text-[10px] font-mono text-muted-foreground uppercase">{portal.fuente}</span>
              </div>
              <p className="font-mono font-bold text-sm text-foreground tabular-nums">
                {formatPrice(portal.precioMediano, true)}€
              </p>
              <p className="text-[10px] text-muted-foreground">
                {portal.totalOfertas} ofertas
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* === BEST DAY RECOMMENDATION === */}
      {mejorDia && (
        <div className="card-glass p-4 border-2 border-emerald-500/30">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-foreground">Recomendación</span>
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            El mejor momento para comprar es un día de descanso <span className="font-semibold text-emerald-400">{mejorDia.diaDisplay}</span>.
          </p>
          <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10">
            <span className="text-xs text-muted-foreground">Precio medio</span>
            <span className="font-mono font-bold text-emerald-400">
              {formatPrice(mejorDia.precioMediano)}€
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Ahorro potencial: <span className="text-emerald-400 font-medium">{formatPrice(Math.abs(mejorDia.diferenciaVsMedia))}€</span> vs. media del mercado
          </p>
        </div>
      )}

      {/* === METHODOLOGY === */}
      <div className="card-glass p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-foreground mb-1">Metodología</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Escaneamos {analisis?.fuentesDatos?.join(', ') || 'múltiples portales'} diariamente.
              Si incluye vehículo, estimamos su valor de mercado y lo restamos para obtener el precio neto de la licencia.
              Datos basados en {ofertas.length} ofertas activas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
