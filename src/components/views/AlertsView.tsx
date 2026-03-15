import { Bell, Rocket } from "lucide-react";

export function AlertsView() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center gap-6">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
        <Bell className="h-10 w-10 text-primary" />
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full border border-primary/20 mb-2">
          <Rocket className="h-3 w-3" />
          Próximamente
        </div>
        <h2 className="text-2xl font-bold text-foreground">Alertas Inteligentes</h2>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
          Recibirás notificaciones personalizadas sobre picos de vuelos, eventos de alto impacto, lluvia y cambios en el precio de licencias.
        </p>
      </div>

      <div className="w-full max-w-xs space-y-2">
        {[
          { emoji: "✈️", text: "Picos de llegadas al aeropuerto" },
          { emoji: "🌧️", text: "Alertas de lluvia con alta demanda" },
          { emoji: "🎉", text: "Eventos masivos en la ciudad" },
          { emoji: "📋", text: "Cambios en el precio de licencias" },
        ].map((item) => (
          <div
            key={item.text}
            className="flex items-center gap-3 bg-muted/30 rounded-xl px-4 py-3 border border-border/50 text-left"
          >
            <span className="text-lg">{item.emoji}</span>
            <p className="text-sm text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
