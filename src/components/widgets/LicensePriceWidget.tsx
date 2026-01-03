import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

// Mock data - we'll start collecting from today
const priceHistory = [
  { date: "01/01", price: 150000 },
  { date: "02/01", price: 151000 },
  { date: "03/01", price: 152000 },
];

const currentPrice = 152000;
const previousPrice = 151000;
const priceChange = ((currentPrice - previousPrice) / previousPrice) * 100;
const isUp = priceChange > 0;

export function LicensePriceWidget({ expanded = false }: { expanded?: boolean }) {
  return (
    <div className="card-dashboard p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-lg bg-primary/10">
            <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm md:text-base">Precio Licencia</h3>
            <p className="text-xs md:text-sm text-muted-foreground">Mediana del mercado</p>
          </div>
        </div>
      </div>

      {/* Current price */}
      <div className="flex items-baseline gap-2 md:gap-3 mb-4">
        <p className="text-2xl md:text-4xl font-bold text-primary" style={{ fontFamily: 'Space Grotesk' }}>
          {(currentPrice / 1000).toFixed(0)}k€
        </p>
        <div className={cn(
          "flex items-center gap-1 px-2 py-0.5 md:py-1 rounded-full text-xs md:text-sm font-medium",
          isUp ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        )}>
          {isUp ? <TrendingUp className="h-3 w-3 md:h-4 md:w-4" /> : <TrendingDown className="h-3 w-3 md:h-4 md:w-4" />}
          <span>{Math.abs(priceChange).toFixed(1)}%</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-24 md:h-32 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={priceHistory}>
            <defs>
              <linearGradient id="priceGradientWidget" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(42, 100%, 50%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(42, 100%, 50%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(220, 10%, 55%)' }}
            />
            <YAxis 
              hide 
              domain={['dataMin - 2000', 'dataMax + 2000']}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(220, 25%, 10%)',
                border: '1px solid hsl(220, 15%, 18%)',
                borderRadius: '8px',
                color: 'hsl(220, 10%, 95%)',
              }}
              formatter={(value: number) => [`${value.toLocaleString('es-ES')}€`, 'Mediana']}
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke="hsl(42, 100%, 50%)" 
              strokeWidth={2}
              fill="url(#priceGradientWidget)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Info notice */}
      <div className="flex items-start gap-2 p-2 md:p-3 rounded-lg bg-muted text-xs md:text-sm">
        <Info className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-muted-foreground">
          Empezamos a recopilar datos. El histórico crece automáticamente.
        </p>
      </div>
    </div>
  );
}
