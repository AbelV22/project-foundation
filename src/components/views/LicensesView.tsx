import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, ExternalLink, RefreshCw, Info, AlertCircle, Car, Tag, BarChart3, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

interface OfertaDetalle {
  fuente: string;
  dia_descanso: string;
  coche_modelo: string;
  precio_total: number;
  valor_coche_estimado: number;
  precio_neto_licencia: number;
  texto_original: string;
}

interface LicenciasData {
  metadata: {
    total_ofertas_validas: number;
    precio_mercado_referencia: number;
  };
  estadisticas: {
    valor_mediano_por_fuente: Record<string, number>;
    valor_mediano_por_dia: Record<string, number>;
  };
  detalle_ofertas: OfertaDetalle[];
}

// Colores para días de descanso
const dayColors: Record<string, string> = {
  "LUNES": "hsl(var(--destructive))",
  "MARTES": "hsl(var(--primary))",
  "MIERCOLES": "hsl(142, 76%, 36%)",
  "JUEVES": "hsl(217, 91%, 60%)",
  "VIERNES": "hsl(38, 92%, 50%)",
};

const getDayColor = (dia: string): string => {
  const dayKey = Object.keys(dayColors).find(key => dia.toUpperCase().includes(key));
  return dayKey ? dayColors[dayKey] : "hsl(var(--muted-foreground))";
};

export function LicensesView() {
  const [data, setData] = useState<LicenciasData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/analisis_licencias_taxi.json?t=" + Date.now())
      .then(res => res.json())
      .then((json: LicenciasData) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Cargando análisis de licencias...</p>
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

  const { metadata, estadisticas, detalle_ofertas } = data;

  // Calcular stats
  const preciosNetos = detalle_ofertas.map(o => o.precio_neto_licencia);
  const minPrice = Math.min(...preciosNetos);
  const maxPrice = Math.max(...preciosNetos);

  // Preparar datos para gráfica de barras por día
  const chartDataPorDia = Object.entries(estadisticas.valor_mediano_por_dia)
    .map(([dia, valor]) => ({
      dia: dia.replace(" IMPAR", " I").replace(" PAR", " P"),
      diaFull: dia,
      valor,
      color: getDayColor(dia)
    }))
    .sort((a, b) => a.valor - b.valor);

  // Ofertas ordenadas por precio neto (más baratas primero)
  const ofertasOrdenadas = [...detalle_ofertas].sort((a, b) => a.precio_neto_licencia - b.precio_neto_licencia);

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <div className="card-dashboard p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Tag className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Ref. Mercado</span>
          </div>
          <p className="font-display font-bold text-xl md:text-2xl text-primary">
            {metadata.precio_mercado_referencia.toLocaleString('es-ES')}€
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">precio mediano neto</p>
        </div>

        <div className="card-dashboard p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
              <TrendingDown className="h-4 w-4 text-success" />
            </div>
            <span className="text-xs text-muted-foreground">Mínimo</span>
          </div>
          <p className="font-display font-bold text-xl md:text-2xl text-success">
            {minPrice.toLocaleString('es-ES')}€
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">precio neto</p>
        </div>

        <div className="card-dashboard p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingUp className="h-4 w-4 text-destructive" />
            </div>
            <span className="text-xs text-muted-foreground">Máximo</span>
          </div>
          <p className="font-display font-bold text-xl md:text-2xl text-destructive">
            {maxPrice.toLocaleString('es-ES')}€
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">precio neto</p>
        </div>

        <div className="card-dashboard p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10">
              <BarChart3 className="h-4 w-4 text-info" />
            </div>
            <span className="text-xs text-muted-foreground">Anuncios</span>
          </div>
          <p className="font-display font-bold text-xl md:text-2xl text-info">
            {metadata.total_ofertas_validas}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">ofertas válidas</p>
        </div>
      </div>

      {/* Chart por día de descanso */}
      <div className="card-dashboard p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm">Precio por Día de Descanso</h3>
            <p className="text-[10px] text-muted-foreground">Valor mediano neto según festivo</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 w-fit">
            <Calendar className="h-3 w-3 text-primary" />
            <span className="text-[10px] text-primary font-medium">Actualizado hoy</span>
          </div>
        </div>

        <div className="h-48 md:h-56 mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartDataPorDia} layout="vertical" margin={{ left: 5, right: 15 }}>
              <XAxis 
                type="number"
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={value => `${(value / 1000).toFixed(0)}k`}
                domain={['dataMin - 5000', 'dataMax + 5000']}
              />
              <YAxis 
                type="category"
                dataKey="dia" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                width={70}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                  fontSize: '12px'
                }}
                formatter={(value: number) => [`${value.toLocaleString('es-ES')}€`, 'Mediana']}
                labelFormatter={(label: string, payload) => {
                  const item = payload?.[0]?.payload;
                  return item?.diaFull || label;
                }}
              />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                {chartDataPorDia.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-start gap-2 p-2 rounded-lg bg-info/10 text-[10px]">
          <Info className="h-3 w-3 text-info mt-0.5 flex-shrink-0" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Días más baratos:</span> Jueves Par suele tener los precios más bajos.
          </p>
        </div>
      </div>

      {/* Comparativa por fuente */}
      <div className="card-dashboard p-4">
        <h3 className="font-display font-semibold text-foreground text-sm mb-3">Mediana por Portal</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(estadisticas.valor_mediano_por_fuente).map(([fuente, valor]) => (
            <div key={fuente} className="p-3 rounded-lg bg-accent/30 border border-border">
              <p className="text-xs text-muted-foreground mb-1">{fuente}</p>
              <p className="font-display font-bold text-lg text-foreground">
                {valor.toLocaleString('es-ES')}€
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Listings */}
      <div className="card-dashboard p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-semibold text-foreground text-sm">Ofertas Detectadas</h3>
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{detalle_ofertas.length} anuncios</Badge>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {ofertasOrdenadas.map((oferta, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-accent/30 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-display font-medium text-foreground text-sm">{oferta.fuente}</span>
                  <Badge 
                    variant="outline" 
                    className="text-[9px] px-1.5 py-0"
                    style={{ borderColor: getDayColor(oferta.dia_descanso), color: getDayColor(oferta.dia_descanso) }}
                  >
                    {oferta.dia_descanso}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground">
                    Total: {oferta.precio_total.toLocaleString('es-ES')}€
                  </p>
                  {oferta.coche_modelo !== "SIN COCHE" && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Car className="h-3 w-3" />
                      <span>{oferta.coche_modelo} (-{oferta.valor_coche_estimado.toLocaleString('es-ES')}€)</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-display font-bold text-primary text-lg">
                    {oferta.precio_neto_licencia.toLocaleString('es-ES')}€
                  </span>
                  <p className="text-[10px] text-muted-foreground">neto</p>
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
                <th className="pb-2 font-medium">Fuente</th>
                <th className="pb-2 font-medium">Día Descanso</th>
                <th className="pb-2 font-medium">Precio Total</th>
                <th className="pb-2 font-medium">Coche</th>
                <th className="pb-2 font-medium">Precio Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ofertasOrdenadas.map((oferta, idx) => (
                <tr key={idx} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5">
                    <span className="font-display font-medium text-foreground text-sm">{oferta.fuente}</span>
                  </td>
                  <td className="py-2.5">
                    <Badge 
                      variant="outline" 
                      className="text-[10px] px-2 py-0.5"
                      style={{ borderColor: getDayColor(oferta.dia_descanso), color: getDayColor(oferta.dia_descanso) }}
                    >
                      {oferta.dia_descanso}
                    </Badge>
                  </td>
                  <td className="py-2.5 font-display font-medium text-foreground text-sm">
                    {oferta.precio_total.toLocaleString('es-ES')}€
                  </td>
                  <td className="py-2.5">
                    {oferta.coche_modelo !== "SIN COCHE" ? (
                      <div className="flex items-center gap-1.5">
                        <Car className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-foreground">{oferta.coche_modelo}</p>
                          <p className="text-[10px] text-muted-foreground">
                            -{oferta.valor_coche_estimado.toLocaleString('es-ES')}€
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin coche</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <span className="font-display font-bold text-primary text-sm">
                      {oferta.precio_neto_licencia.toLocaleString('es-ES')}€
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology note */}
      <div className="card-dashboard p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-display font-semibold text-foreground text-xs mb-0.5">Metodología</h4>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Escaneamos Milanuncios y Solano Taxi diariamente. Si incluye vehículo, 
              estimamos su valor de mercado y lo restamos para obtener el precio neto de la licencia.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
