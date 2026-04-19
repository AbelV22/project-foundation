import { useState, useEffect } from "react";
import { Smartphone, Send, X, Sparkles } from "lucide-react";

const STORAGE_KEY = "itaxibcn_app_promo_dismissed_v1";
const TELEGRAM_URL = "https://t.me/+_TP8RhBeEsZhZDE0";

export function AppPromoBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(STORAGE_KEY) !== "1");
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl animate-fade-in"
      style={{
        background:
          "linear-gradient(135deg, hsl(220 25% 10% / 0.85) 0%, hsl(220 25% 8% / 0.85) 100%)",
        boxShadow:
          "0 8px 32px -8px rgba(250, 204, 21, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.06)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Gradient border */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl p-px"
        style={{
          background:
            "linear-gradient(135deg, hsl(42 100% 50% / 0.5) 0%, hsl(42 100% 50% / 0.05) 40%, transparent 70%, hsl(200 80% 50% / 0.25) 100%)",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {/* Glow orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -left-12 h-40 w-40 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(42 100% 50% / 0.6), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-10 h-44 w-44 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(200 80% 50% / 0.5), transparent 70%)" }}
      />

      {/* Shimmer sweep on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1400ms] ease-out"
        style={{
          background:
            "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)",
        }}
      />

      {/* Close */}
      <button
        onClick={dismiss}
        aria-label="Cerrar aviso"
        className="absolute top-2.5 right-2.5 z-10 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-white/5 transition-all"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="relative p-4 sm:p-5">
        {/* "Novedad" pill */}
        <div className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.12em] border border-primary/30 bg-primary/10 text-primary">
          <Sparkles className="h-3 w-3" />
          Novedad
        </div>

        <div className="flex items-start gap-3.5 sm:gap-4">
          {/* Icon badge */}
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-2xl blur-md opacity-70"
              style={{ background: "linear-gradient(135deg, hsl(42 100% 50%), hsl(38 92% 50%))" }}
            />
            <div
              className="relative h-11 w-11 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, hsl(45 93% 58%) 0%, hsl(38 92% 50%) 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 14px rgba(250,204,21,0.35)",
              }}
            >
              <Smartphone className="h-5 w-5 text-[hsl(220_25%_6%)]" strokeWidth={2.5} />
            </div>
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <h3 className="font-display text-base sm:text-lg font-bold leading-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-amber-300 to-primary">
                Ya disponible la app de iTaxiBcn
              </span>
            </h3>
            <p className="text-xs sm:text-[13px] text-muted-foreground mt-1 leading-relaxed">
              Llévala en el móvil y no te pierdas nada. ¿Dudas o sugerencias?
              Habla directamente con el desarrollador en el grupo de Telegram.
            </p>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <a
                href={TELEGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(200 90% 55%) 0%, hsl(205 85% 45%) 100%)",
                  boxShadow:
                    "0 6px 20px -4px rgba(56,189,248,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
                }}
              >
                <Send className="h-3.5 w-3.5" />
                Unirme al grupo de Telegram
              </a>
              <span className="text-[11px] text-muted-foreground/70">
                Respuesta directa del desarrollador
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
