import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plane,
  Train,
  Calendar,
  MapPin,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Ship,
  Clock,
  Users,
  Wifi,
  BarChart3,
  Zap,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setItem } from "@/lib/storage";
import { AccountCreationDialog } from "@/components/AccountCreationDialog";

/* ─── Slide data ─── */

interface SlideData {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  gradient: string;
  accentColor: string;
  dotColor: string;
  illustration: React.ReactNode;
}

/* Mini-components for rich visual previews */

function FlightsMockup() {
  const flights = [
    { code: "VY 6234", origin: "Roma FCO", time: "10:25", pax: 186, status: "Aterrizando" },
    { code: "FR 5991", origin: "Londres STN", time: "10:40", pax: 189, status: "En ruta" },
    { code: "LH 1127", origin: "Frankfurt", time: "10:55", pax: 142, status: "En ruta" },
  ];
  return (
    <div className="w-full max-w-[280px] mx-auto">
      <div className="rounded-2xl bg-card/80 backdrop-blur border border-border/50 overflow-hidden shadow-2xl shadow-blue-500/5">
        <div className="px-4 py-2.5 bg-blue-500/10 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-semibold text-blue-400">Llegadas T1</span>
          </div>
          <span className="text-[10px] text-muted-foreground">10:00 - 11:00</span>
        </div>
        <div className="divide-y divide-border/30">
          {flights.map((f, i) => (
            <motion.div
              key={f.code}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.15, duration: 0.4 }}
              className="px-4 py-2.5 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">{f.code}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{f.origin}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{f.time}</span>
                  <Users className="h-2.5 w-2.5 text-muted-foreground ml-1" />
                  <span className="text-[10px] text-muted-foreground">{f.pax}</span>
                </div>
              </div>
              <span className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-full",
                i === 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"
              )}>
                {f.status}
              </span>
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="px-4 py-2 bg-blue-500/5 border-t border-border/30 flex items-center justify-between"
        >
          <span className="text-[10px] text-blue-400 font-medium">+9 vuelos esta hora</span>
          <ChevronRight className="h-3 w-3 text-blue-400" />
        </motion.div>
      </div>
    </div>
  );
}

function TrainsMockup() {
  const trains = [
    { type: "AVE", dest: "Madrid", time: "10:15", operator: "Renfe", platform: "8" },
    { type: "AVLO", dest: "Zaragoza", time: "10:35", operator: "Renfe", platform: "5" },
    { type: "Ouigo", dest: "Madrid", time: "11:00", operator: "Ouigo", platform: "3" },
  ];
  return (
    <div className="w-full max-w-[280px] mx-auto">
      <div className="rounded-2xl bg-card/80 backdrop-blur border border-border/50 overflow-hidden shadow-2xl shadow-emerald-500/5">
        <div className="px-4 py-2.5 bg-emerald-500/10 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Train className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">Sants - Salidas</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Hoy</span>
        </div>
        <div className="divide-y divide-border/30">
          {trains.map((t, i) => (
            <motion.div
              key={t.time}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.15, duration: 0.4 }}
              className="px-4 py-2.5 flex items-center gap-3"
            >
              <div className={cn(
                "w-10 h-6 rounded-md flex items-center justify-center text-[9px] font-bold",
                i === 2 ? "bg-pink-500/20 text-pink-400" : "bg-emerald-500/15 text-emerald-400"
              )}>
                {t.type}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-foreground">{t.dest}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{t.time}</span>
                  <span className="text-[10px] text-muted-foreground">Via {t.platform}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EventsMockup() {
  const events = [
    { name: "FC Barcelona vs Real Madrid", type: "Futbol", icon: "⚽", color: "text-blue-400", bg: "bg-blue-500/15" },
    { name: "Primavera Sound", type: "Festival", icon: "🎵", color: "text-purple-400", bg: "bg-purple-500/15" },
    { name: "MSC Grandiosa", type: "Crucero", icon: "🚢", color: "text-cyan-400", bg: "bg-cyan-500/15" },
  ];
  return (
    <div className="w-full max-w-[280px] mx-auto">
      <div className="rounded-2xl bg-card/80 backdrop-blur border border-border/50 overflow-hidden shadow-2xl shadow-purple-500/5">
        <div className="px-4 py-2.5 bg-purple-500/10 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-xs font-semibold text-purple-400">Hoy en Barcelona</span>
          </div>
          <span className="text-[10px] text-muted-foreground">3 eventos</span>
        </div>
        <div className="divide-y divide-border/30">
          {events.map((e, i) => (
            <motion.div
              key={e.name}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.15, duration: 0.4 }}
              className="px-4 py-3 flex items-center gap-3"
            >
              <span className="text-lg">{e.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-foreground block truncate">{e.name}</span>
                <span className={cn("text-[10px] font-medium", e.color)}>{e.type}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EarningsMockup() {
  const bars = [65, 45, 80, 55, 90, 70, 85];
  const days = ["L", "M", "X", "J", "V", "S", "D"];
  return (
    <div className="w-full max-w-[280px] mx-auto">
      <div className="rounded-2xl bg-card/80 backdrop-blur border border-border/50 overflow-hidden shadow-2xl shadow-orange-500/5">
        <div className="px-4 py-3 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-muted-foreground">Esta semana</span>
              <div className="flex items-baseline gap-1">
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-xl font-bold text-foreground"
                >
                  1.247
                </motion.span>
                <span className="text-xs text-muted-foreground">&euro;</span>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-1 bg-emerald-500/15 px-2 py-1 rounded-full"
            >
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-400">+12%</span>
            </motion.div>
          </div>
        </div>
        <div className="px-4 py-4">
          <div className="flex items-end justify-between gap-1.5 h-20">
            {bars.map((h, i) => (
              <div key={i} className="flex flex-col items-center gap-1 flex-1">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: 0.4 + i * 0.08, duration: 0.5, ease: "easeOut" }}
                  className={cn(
                    "w-full rounded-md min-h-[4px]",
                    i === 4 ? "bg-orange-400" : "bg-orange-400/30"
                  )}
                />
                <span className="text-[9px] text-muted-foreground">{days[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RadarMockup() {
  const zones = [
    { name: "T1", taxis: 24, wait: "45 min", active: true },
    { name: "T2", taxis: 12, wait: "20 min", active: false },
    { name: "Sants", taxis: 8, wait: "15 min", active: false },
  ];
  return (
    <div className="w-full max-w-[280px] mx-auto">
      <div className="rounded-2xl bg-card/80 backdrop-blur border border-border/50 overflow-hidden shadow-2xl shadow-rose-500/5">
        <div className="px-4 py-2.5 bg-rose-500/10 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <MapPin className="h-3.5 w-3.5 text-rose-400" />
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-rose-400/30"
              />
            </div>
            <span className="text-xs font-semibold text-rose-400">Radar Activo</span>
          </div>
          <div className="flex items-center gap-1">
            <Wifi className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] text-emerald-400">En vivo</span>
          </div>
        </div>
        <div className="p-3 space-y-2">
          {zones.map((z, i) => (
            <motion.div
              key={z.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.15 }}
              className={cn(
                "rounded-xl p-3 border flex items-center justify-between",
                z.active
                  ? "border-rose-500/40 bg-rose-500/10"
                  : "border-border/30 bg-muted/20"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm",
                  z.active ? "bg-rose-500/20 text-rose-400" : "bg-muted/40 text-foreground"
                )}>
                  {z.name}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">{z.wait}</span>
                    {z.active && (
                      <span className="text-[9px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full font-medium">
                        Aqui
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{z.taxis} taxis</span>
                </div>
              </div>
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* Hero illustration for welcome slide */
function WelcomeIllustration() {
  const features = [
    { icon: Plane, label: "Vuelos", color: "text-blue-400", bg: "bg-blue-500/15" },
    { icon: Train, label: "Trenes", color: "text-emerald-400", bg: "bg-emerald-500/15" },
    { icon: BarChart3, label: "Ingresos", color: "text-orange-400", bg: "bg-orange-500/15" },
    { icon: MapPin, label: "Radar", color: "text-rose-400", bg: "bg-rose-500/15" },
  ];

  return (
    <div className="w-full max-w-[280px] mx-auto">
      {/* App icon + brand */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
        className="flex flex-col items-center mb-6"
      >
        <div className="w-20 h-20 rounded-[22px] bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/20 mb-3">
          <span className="text-4xl">🚕</span>
        </div>
      </motion.div>

      {/* Feature grid */}
      <div className="grid grid-cols-4 gap-2">
        {features.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="flex flex-col items-center gap-1.5"
          >
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", f.bg)}>
              <f.icon className={cn("h-5 w-5", f.color)} />
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">{f.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ─── Slides ─── */

const slides: SlideData[] = [
  {
    id: "welcome",
    title: "iTaxiBcn",
    subtitle: "La app inteligente para\ntaxistas de Barcelona",
    description:
      "Vuelos, trenes, eventos, ingresos y radar de zonas.\nTodo lo que necesitas en un solo lugar.",
    gradient: "from-yellow-500/20 via-yellow-600/5 to-transparent",
    accentColor: "text-yellow-400",
    dotColor: "bg-yellow-400",
    illustration: <WelcomeIllustration />,
  },
  {
    id: "vuelos",
    title: "Vuelos en Tiempo Real",
    subtitle: "Llegadas T1 y T2 al momento",
    description:
      "Consulta pasajeros, hora de aterrizaje y terminal. Anticípate a los picos de demanda.",
    gradient: "from-blue-500/15 via-blue-600/5 to-transparent",
    accentColor: "text-blue-400",
    dotColor: "bg-blue-400",
    illustration: <FlightsMockup />,
  },
  {
    id: "trenes",
    title: "Trenes de Sants",
    subtitle: "AVE, AVLO, Ouigo y mas",
    description:
      "Horarios completos filtrados por ciudad o compañia. Sabe cuando llega la demanda a Sants.",
    gradient: "from-emerald-500/15 via-emerald-600/5 to-transparent",
    accentColor: "text-emerald-400",
    dotColor: "bg-emerald-400",
    illustration: <TrainsMockup />,
  },
  {
    id: "eventos",
    title: "Eventos y Cruceros",
    subtitle: "El pulso de Barcelona",
    description:
      "Conciertos, partidos, ferias y cruceros en el puerto. Estate donde esta la demanda.",
    gradient: "from-purple-500/15 via-purple-600/5 to-transparent",
    accentColor: "text-purple-400",
    dotColor: "bg-purple-400",
    illustration: <EventsMockup />,
  },
  {
    id: "ingresos",
    title: "Controla tu Dinero",
    subtitle: "Ingresos, gastos y tendencias",
    description:
      "Registra carreras con un toque. Ve tu evolucion diaria, semanal y mensual al instante.",
    gradient: "from-orange-500/15 via-orange-600/5 to-transparent",
    accentColor: "text-orange-400",
    dotColor: "bg-orange-400",
    illustration: <EarningsMockup />,
  },
  {
    id: "radar",
    title: "Radar de Zonas",
    subtitle: "Tiempos de espera en vivo",
    description:
      "Detecta automaticamente tu zona y registra el tiempo. Ve cuantos taxis hay en cada punto.",
    gradient: "from-rose-500/15 via-rose-600/5 to-transparent",
    accentColor: "text-rose-400",
    dotColor: "bg-rose-400",
    illustration: <RadarMockup />,
  },
];

/* ─── Swipe threshold ─── */
const SWIPE_THRESHOLD = 50;

/* ─── Main Component ─── */

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const [showAccount, setShowAccount] = useState(false);
  const isLast = current === slides.length - 1;
  const slide = slides[current];
  const progress = ((current + 1) / slides.length) * 100;

  const goTo = useCallback(
    (index: number) => {
      if (index === current) return;
      setDirection(index > current ? 1 : -1);
      setCurrent(index);
    },
    [current]
  );

  const handleNext = useCallback(() => {
    if (isLast) {
      setShowAccount(true);
    } else {
      setDirection(1);
      setCurrent((c) => c + 1);
    }
  }, [isLast]);

  const handlePrev = useCallback(() => {
    if (current > 0) {
      setDirection(-1);
      setCurrent((c) => c - 1);
    }
  }, [current]);

  const handleSkip = async () => {
    await setItem("onboarding_completed", "true");
    onComplete();
  };

  const handleAccountDone = async () => {
    await setItem("onboarding_completed", "true");
    onComplete();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden select-none">
        {/* Background gradient */}
        <motion.div
          key={slide.id + "-bg"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className={cn(
            "absolute inset-0 bg-gradient-to-b pointer-events-none",
            slide.gradient
          )}
        />

        {/* Top bar: progress + skip */}
        <div className="relative z-10 px-6 pt-safe">
          <div className="flex items-center justify-between pt-4 mb-3">
            {/* Step counter */}
            <span className="text-xs text-muted-foreground font-medium tabular-nums">
              {current + 1} / {slides.length}
            </span>

            {/* Skip */}
            <button
              onClick={handleSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 px-3 rounded-lg hover:bg-muted/50 -mr-2"
            >
              Saltar
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full", slide.dotColor)}
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            />
          </div>
        </div>

        {/* Slide content - swipeable area */}
        <div
          className="flex-1 flex flex-col relative z-10 overflow-hidden"
          onTouchStart={(e) => {
            const touch = e.touches[0];
            (e.currentTarget as any)._touchStartX = touch.clientX;
          }}
          onTouchEnd={(e) => {
            const startX = (e.currentTarget as any)._touchStartX;
            if (startX == null) return;
            const endX = e.changedTouches[0].clientX;
            const diff = endX - startX;
            if (diff < -SWIPE_THRESHOLD && !isLast) handleNext();
            else if (diff > SWIPE_THRESHOLD && current > 0) handlePrev();
          }}
        >
          {/* Use key to force remount on slide change + motion for enter animation */}
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex-1 flex flex-col items-center px-6 pt-6"
          >
            {/* Illustration area */}
            <div className="flex-1 flex items-center justify-center w-full min-h-0 pb-2">
              {slide.illustration}
            </div>

            {/* Text content - fixed height area at bottom */}
            <div className="w-full max-w-sm text-center pb-2 space-y-2">
              <h1 className="text-2xl font-bold text-foreground leading-tight">
                {slide.title}
              </h1>

              <p className={cn("text-sm font-semibold whitespace-pre-line leading-snug", slide.accentColor)}>
                {slide.subtitle}
              </p>

              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {slide.description}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Bottom controls */}
        <div className="relative z-10 px-6 pb-safe">
          <div className="pb-6 space-y-4">
            {/* Dots */}
            <div className="flex items-center justify-center gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => goTo(i)}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    i === current
                      ? cn("w-7 h-2", slide.dotColor)
                      : "w-2 h-2 bg-muted-foreground/25 hover:bg-muted-foreground/40"
                  )}
                />
              ))}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              {current > 0 && (
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  size="lg"
                  className="px-4 border-border/50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <Button
                onClick={handleNext}
                size="lg"
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 text-sm font-semibold h-12 rounded-xl",
                  isLast && "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black shadow-lg shadow-yellow-500/20"
                )}
              >
                {isLast ? (
                  <>
                    <Zap className="h-4 w-4" />
                    Empezar
                  </>
                ) : (
                  <>
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            {current === 0 && (
              <p className="text-center text-[11px] text-muted-foreground/70">
                Hecha por y para taxistas con licencia VT en Barcelona
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Account creation */}
      <AccountCreationDialog
        open={showAccount}
        onDone={handleAccountDone}
        onSkip={handleAccountDone}
      />
    </>
  );
}
