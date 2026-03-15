import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plane, Train, Calendar, MapPin, TrendingUp, ChevronRight, X, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setItem } from "@/lib/storage";
import { AccountCreationDialog } from "@/components/AccountCreationDialog";

const slides = [
  {
    id: "welcome",
    icon: null,
    emoji: "🚕",
    title: "Bienvenido a iTaxiBcn",
    subtitle: "La app inteligente\npara taxistas de Barcelona",
    description: "Todo lo que necesitas para trabajar mejor, en un solo lugar.",
    color: "from-yellow-500/20 to-yellow-600/5",
    accent: "text-yellow-400",
    dot: "bg-yellow-400",
  },
  {
    id: "vuelos",
    icon: Plane,
    emoji: null,
    title: "Vuelos en Tiempo Real",
    subtitle: "Llegadas al aeropuerto T1 y T2",
    description: "Consulta los vuelos que llegan ahora mismo, hora a hora. Anticípate a los picos de demanda antes que nadie.",
    color: "from-blue-500/20 to-blue-600/5",
    accent: "text-blue-400",
    dot: "bg-blue-400",
    visual: [
      { time: "10:30", flights: 12, label: "T1 cargado" },
      { time: "11:00", flights: 18, label: "Pico" },
      { time: "11:30", flights: 7, label: "Moderado" },
    ],
  },
  {
    id: "trenes",
    icon: Train,
    emoji: null,
    title: "Trenes y Transport",
    subtitle: "Estación de Sants 24h",
    description: "Horarios completos de trenes, filtrados por ciudad o compañía. Nunca más te pierdas una salida.",
    color: "from-emerald-500/20 to-emerald-600/5",
    accent: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  {
    id: "eventos",
    icon: Calendar,
    emoji: null,
    title: "Eventos y Cruceros",
    subtitle: "El pulso de la ciudad",
    description: "Conciertos, ferias, partidos, cruceros en el puerto... conoce qué pasa hoy en Barcelona para estar donde hay demanda.",
    color: "from-purple-500/20 to-purple-600/5",
    accent: "text-purple-400",
    dot: "bg-purple-400",
    extraIcon: Ship,
  },
  {
    id: "ingresos",
    icon: TrendingUp,
    emoji: null,
    title: "Controla tu Actividad",
    subtitle: "Ingresos, gastos y rentabilidad",
    description: "Registra carreras y gastos con un toque. Consulta tu evolución diaria, semanal y mensual. Todo listo para la gestión fiscal.",
    color: "from-orange-500/20 to-orange-600/5",
    accent: "text-orange-400",
    dot: "bg-orange-400",
  },
  {
    id: "radar",
    icon: MapPin,
    emoji: null,
    title: "Radar de Zonas",
    subtitle: "Tiempos de espera en tiempo real",
    description: "La app detecta automáticamente cuando estás en T1, T2 o Sants y registra tu tiempo de espera. Consulta cuántos taxis hay en cada zona ahora mismo.",
    color: "from-rose-500/20 to-rose-600/5",
    accent: "text-rose-400",
    dot: "bg-rose-400",
  },
];

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [showAccount, setShowAccount] = useState(false);
  const isLast = current === slides.length - 1;

  const handleNext = () => {
    if (isLast) {
      setShowAccount(true);
    } else {
      setDirection(1);
      setCurrent((c) => c + 1);
    }
  };

  const handlePrev = () => {
    if (current > 0) {
      setDirection(-1);
      setCurrent((c) => c - 1);
    }
  };

  const handleSkip = async () => {
    await setItem("onboarding_completed", "true");
    onComplete();
  };

  const handleAccountDone = async () => {
    await setItem("onboarding_completed", "true");
    onComplete();
  };

  const slide = slides[current];

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
        {/* Skip button */}
        <div className="flex justify-end p-5 pt-safe">
          <button
            onClick={handleSkip}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-3 rounded-xl hover:bg-muted/50"
          >
            Saltar
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Slide content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 relative overflow-hidden">
          {/* Background glow */}
          <motion.div
            key={slide.id + "-glow"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className={cn(
              "absolute inset-0 bg-gradient-radial pointer-events-none",
              `bg-gradient-to-b ${slide.color}`
            )}
          />

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={slide.id}
              custom={direction}
              variants={{
                enter: (d: number) => ({ x: d * 60, opacity: 0 }),
                center: { x: 0, opacity: 1 },
                exit: (d: number) => ({ x: d * -60, opacity: 0 }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex flex-col items-center text-center relative z-10 max-w-sm w-full"
            >
              {/* Icon/Emoji */}
              <div className="mb-8">
                {slide.emoji ? (
                  <motion.span
                    initial={{ scale: 0.5, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 12 }}
                    className="text-7xl block"
                  >
                    {slide.emoji}
                  </motion.span>
                ) : slide.icon ? (
                  <motion.div
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 12 }}
                    className={cn(
                      "w-20 h-20 rounded-3xl flex items-center justify-center",
                      "bg-gradient-to-br",
                      slide.color.replace("from-", "from-").replace("/20", "/30").replace("/5", "/10")
                    )}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {slide.extraIcon ? (
                      <div className="flex gap-1">
                        <slide.icon className={cn("h-7 w-7", slide.accent)} />
                        <slide.extraIcon className={cn("h-7 w-7", slide.accent)} />
                      </div>
                    ) : (
                      <slide.icon className={cn("h-10 w-10", slide.accent)} />
                    )}
                  </motion.div>
                ) : null}
              </div>

              {/* Title */}
              <motion.h1
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-3xl font-bold text-foreground mb-2 leading-tight"
              >
                {slide.title}
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className={cn("text-base font-semibold mb-4", slide.accent)}
              >
                {slide.subtitle}
              </motion.p>

              {/* Description */}
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-muted-foreground text-sm leading-relaxed"
              >
                {slide.description}
              </motion.p>

              {/* Visual preview for flights slide */}
              {slide.visual && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 w-full bg-muted/30 rounded-2xl p-4 border border-border/50"
                >
                  {slide.visual.map((item, i) => (
                    <div key={item.time} className="flex items-center gap-3 py-1.5">
                      <span className="text-xs text-muted-foreground w-10 font-mono">{item.time}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(item.flights / 20) * 100}%` }}
                          transition={{ delay: 0.4 + i * 0.1, duration: 0.6, ease: "easeOut" }}
                          className="h-full rounded-full bg-blue-400"
                        />
                      </div>
                      <span className="text-xs text-blue-400 font-medium w-12 text-right">{item.label}</span>
                    </div>
                  ))}
                </motion.div>
              )}

              {/* Radar zone preview for last slide */}
              {slide.id === "radar" && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 w-full grid grid-cols-3 gap-2"
                >
                  {["T1", "T2", "Sants"].map((zone, i) => (
                    <div
                      key={zone}
                      className={cn(
                        "rounded-xl p-3 border text-center",
                        i === 0
                          ? "border-rose-500/40 bg-rose-500/10"
                          : "border-border/50 bg-muted/20"
                      )}
                    >
                      <p className={cn("text-sm font-bold", i === 0 ? "text-rose-400" : "text-foreground")}>{zone}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {i === 0 ? "Estás aquí" : i === 1 ? "12 min" : "24 min"}
                      </p>
                    </div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom controls */}
        <div className="px-8 pb-10 pb-safe space-y-4">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => {
                  setDirection(i > current ? 1 : -1);
                  setCurrent(i);
                }}
                className={cn(
                  "rounded-full transition-all duration-300",
                  i === current
                    ? cn("w-6 h-2", slide.dot)
                    : "w-2 h-2 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3">
            {current > 0 && (
              <Button
                variant="outline"
                onClick={handlePrev}
                className="flex-1"
                size="lg"
              >
                Atrás
              </Button>
            )}
            <Button
              onClick={handleNext}
              className={cn("flex items-center gap-2", current === 0 ? "w-full" : "flex-[2]")}
              size="lg"
            >
              {isLast ? "¡Empezar!" : "Siguiente"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {current === 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Para taxistas con licencia VT en Barcelona
            </p>
          )}
        </div>
      </div>

      {/* Account creation dialog shown after last slide */}
      <AccountCreationDialog
        open={showAccount}
        onDone={handleAccountDone}
        onSkip={handleAccountDone}
      />
    </>
  );
}
