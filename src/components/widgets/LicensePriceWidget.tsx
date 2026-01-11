import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface LicenciasData {
  metadata: {
    total_ofertas_validas: number;
    precio_mercado_referencia: number;
  };
  estadisticas: {
    valor_mediano_por_fuente: Record<string, number>;
    valor_mediano_por_dia: Record<string, number>;
  };
  detalle_ofertas: Array<{
    precio_neto_licencia: number;
  }>;
}

interface HistoryEntry {
  date: string;
  median_price: number;
}

interface LicensePriceWidgetProps {
  onClick?: () => void;
}

// Parse CSV to array of objects
const parseCSV = (text: string): HistoryEntry[] => {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  
  return lines.slice(1).map(line => {
    const [date, , median_price] = line.split(',');
    return {
      date,
      median_price: parseInt(median_price, 10)
    };
  });
};

export function LicensePriceWidget({ onClick }: LicensePriceWidgetProps) {
  const [data, setData] = useState<LicenciasData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/analisis_licencias_taxi.json?t=" + Date.now()).then(res => res.json()),
      fetch("/history_stats.csv?t=" + Date.now()).then(res => res.text())
    ])
      .then(([jsonData, csvText]) => {
        setData(jsonData);
        setHistory(parseCSV(csvText));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Valores por defecto mientras carga
  const precioRef = data?.metadata?.precio_mercado_referencia || 168000;
  const totalOfertas = data?.metadata?.total_ofertas_validas || 0;
  
  // Calcular min/max de las ofertas
  const preciosNetos = data?.detalle_ofertas?.map(o => o.precio_neto_licencia) || [];
  const minPrice = preciosNetos.length > 0 ? Math.min(...preciosNetos) : 160000;
  const maxPrice = preciosNetos.length > 0 ? Math.max(...preciosNetos) : 190000;

  // Usar datos históricos reales del CSV o fallback
  const priceHistory = history.length > 0 
    ? history.slice(-6).map(h => ({
        date: h.date.slice(5).replace('-', '/'), // "2026-01-11" -> "01/11"
        price: h.median_price
      }))
    : [{ date: "hoy", price: precioRef }];

  // Calcular tendencia real
  const currentPrice = history.length > 0 ? history[history.length - 1].median_price : precioRef;
  const previousPrice = history.length > 1 ? history[history.length - 2].median_price : currentPrice;
  const priceChange = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
  const isUp = priceChange > 0;

  return (
    <button 
      onClick={onClick}
      className="card-dashboard p-3 md:p-4 text-left hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group w-full"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-xs md:text-sm">Licencia</h3>
            <p className="text-[10px] text-muted-foreground">{totalOfertas} ofertas</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>

      {/* Current price */}
      <div className="flex items-baseline gap-2 mb-2">
        <p className="text-xl md:text-2xl font-display font-bold text-primary">
          {(precioRef / 1000).toFixed(0)}k€
        </p>
        <div className={cn(
          "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
          isUp ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
        )}>
          {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          <span>{Math.abs(priceChange).toFixed(1)}%</span>
        </div>
      </div>

      {/* Mini Chart */}
      <div className="h-16 md:h-20 mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={priceHistory}>
            <defs>
              <linearGradient id="priceGradientWidget" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false}
              tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              hide 
              domain={['dataMin - 2000', 'dataMax + 2000']}
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke="hsl(var(--primary))" 
              strokeWidth={1.5}
              fill="url(#priceGradientWidget)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Range info */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
        <span className="text-success">{(minPrice / 1000).toFixed(0)}k€ min</span>
        <span className="text-destructive">{(maxPrice / 1000).toFixed(0)}k€ max</span>
      </div>
    </button>
  );
}
