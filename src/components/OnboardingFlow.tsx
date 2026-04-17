import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plane,
  Train,
  Calendar,
  MapPin,
  TrendingUp,
  ChevronRight,
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
import logoItaxiBcn from "@/assets/logo-itaxibcn.png";

/* ═══════════════════════════════════════════════════════════════
   Phone Frame — wraps mockups in a realistic device bezel
   ═══════════════════════════════════════════════════════════════ */

function PhoneFrame({
  children,
  glowColor,
}: {
  children: React.ReactNode;
  glowColor: string;
}) {
  return (
    <div className="relative w-full flex items-center justify-center">
      {/* Ambient glow behind device */}
      <div
        className={cn(
          "absolute w-[260px] h-[260px] rounded-full blur-[90px] opacity-15",
          glowColor
        )}
      />
      {/* Device frame */}
      <div className="relative w-[300px] rounded-[2.5rem] bg-gradient-to-b from-card/95 to-card/80 border border-white/[0.08] shadow-[0_25px_60px_-12px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-sm">
        {/* Top highlight edge */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        {/* Dynamic Island */}
        <div className="flex justify-center pt-2.5 pb-1.5">
          <div className="w-24 h-[18px] rounded-full bg-black/80 border border-white/[0.04]" />
        </div>
        {/* Screen content */}
        <div className="px-0 pb-3">{children}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Welcome Illustration — floating constellation
   ═══════════════════════════════════════════════════════════════ */

function WelcomeIllustration() {
  const orbitIcons = [
    { icon: Plane, color: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/20", label: "Vuelos", x: -95, y: -55, delay: 0 },
    { icon: Train, color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/20", label: "Trenes", x: 95, y: -55, delay: 0.6 },
    { icon: Ship, color: "text-cyan-400", bg: "bg-cyan-500/20", border: "border-cyan-500/20", label: "Cruceros", x: -105, y: 50, delay: 1.2 },
    { icon: TrendingUp, color: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/20", label: "Ingresos", x: 105, y: 50, delay: 1.8 },
    { icon: MapPin, color: "text-rose-400", bg: "bg-rose-500/20", border: "border-rose-500/20", label: "Radar", x: 0, y: 108, delay: 2.4 },
  ];

  return (
    <div className="relative w-[320px] h-[360px] flex flex-col items-center justify-center mx-auto">
      {/* Central logo */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 16, delay: 0.1 }}
        className="relative z-10 flex flex-col items-center"
      >
        {/* Outer glow ring */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.05, 0.15] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -inset-4 rounded-[36px] bg-yellow-400/20 blur-2xl"
        />
        {/* Inner glow */}
        <motion.div
          animate={{ opacity: [0.4, 0.2, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          className="absolute -inset-1 rounded-[32px] bg-yellow-500/15 blur-lg"
        />
        {/* Logo image */}
        <div className="relative z-10 w-28 h-28 rounded-[30px] overflow-hidden shadow-2xl shadow-yellow-500/20 ring-1 ring-white/10">
          <img
            src={logoItaxiBcn}
            alt="iTaxi BCN"
            className="w-full h-full object-cover"
          />
        </div>
        {/* Brand name */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="mt-4 flex flex-col items-center"
        >
          <span className="font-display text-xl font-bold text-foreground tracking-tight">
            iTaxi BCN
          </span>
          <span className="text-[11px] text-muted-foreground/60 mt-0.5">
            Barcelona
          </span>
        </motion.div>
      </motion.div>

      {/* Orbiting feature icons */}
      {orbitIcons.map((item) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 15, delay: 0.3 + item.delay * 0.15 }}
          className="absolute z-20"
          style={{ left: `calc(50% + ${item.x}px - 22px)`, top: `calc(45% + ${item.y}px - 22px)` }}
        >
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3.5 + item.delay * 0.2, repeat: Infinity, ease: "easeInOut", delay: item.delay * 0.3 }}
          >
            <div
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center backdrop-blur-md border shadow-lg shadow-black/20",
                item.bg,
                item.border
              )}
            >
              <item.icon className={cn("h-4.5 w-4.5", item.color)} />
            </div>
            <span className={cn("block text-center text-[8px] font-medium mt-1 opacity-60", item.color)}>
              {item.label}
            </span>
          </motion.div>
        </motion.div>
      ))}

      {/* Decorative orbital rings */}
      <div className="absolute inset-0 z-0 flex items-center justify-center" style={{ top: "-10px" }}>
        <svg className="w-[300px] h-[300px] opacity-[0.04]" viewBox="0 0 300 300">
          <circle cx="150" cy="150" r="75" fill="none" stroke="white" strokeWidth="1" strokeDasharray="3 5" />
          <circle cx="150" cy="150" r="125" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="2 8" />
        </svg>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Feature Mockups — render inside PhoneFrame
   ═══════════════════════════════════════════════════════════════ */

function FlightsMockup() {
  const flights = [
    { code: "VY 6234", origin: "Roma FCO", time: "10:25", pax: 186, status: "Aterrizando", statusColor: "bg-emerald-500/15 text-emerald-400" },
    { code: "FR 5991", origin: "Londres STN", time: "10:40", pax: 189, status: "En ruta", statusColor: "bg-blue-500/15 text-blue-400" },
    { code: "LH 1127", origin: "Frankfurt", time: "10:55", pax: 142, status: "En ruta", statusColor: "bg-blue-500/15 text-blue-400" },
  ];
  return (
    <PhoneFrame glowColor="bg-blue-500">
      <div className="rounded-xl bg-card/60 overflow-hidden mx-3">
        <div className="px-4 py-2.5 bg-blue-500/10 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plane className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs font-semibold text-blue-400">Llegadas T1</span>
          </div>
          <span className="text-[10px] text-muted-foreground">10:00 - 11:00</span>
        </div>
        <div className="divide-y divide-border/20">
          {flights.map((f, i) => (
            <motion.div
              key={f.code}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.12, duration: 0.35 }}
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
              <span className={cn("text-[9px] font-medium px-2 py-0.5 rounded-full", f.statusColor)}>
                {f.status}
              </span>
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.95 }}
          className="px-4 py-2 bg-blue-500/5 border-t border-border/20 flex items-center justify-between"
        >
          <span className="text-[10px] text-blue-400 font-medium">+9 vuelos esta hora</span>
          <ChevronRight className="h-3 w-3 text-blue-400" />
        </motion.div>
      </div>
    </PhoneFrame>
  );
}

function TrainsMockup() {
  const trains = [
    { type: "AVE", dest: "Madrid", time: "10:15", color: "bg-red-500/20 text-red-400" },
    { type: "IRYO", dest: "Zaragoza", time: "10:35", color: "bg-purple-500/20 text-purple-400" },
    { type: "Ouigo", dest: "Madrid", time: "11:00", color: "bg-pink-500/20 text-pink-400" },
  ];
  return (
    <PhoneFrame glowColor="bg-emerald-500">
      <div className="rounded-xl bg-card/60 overflow-hidden mx-3">
        <div className="px-4 py-2.5 bg-emerald-500/10 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Train className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">Sants - Llegadas</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Hoy</span>
        </div>
        <div className="divide-y divide-border/20">
          {trains.map((t, i) => (
            <motion.div
              key={t.time}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.12, duration: 0.35 }}
              className="px-4 py-2.5 flex items-center gap-3"
            >
              <div className={cn("w-11 h-6 rounded-md flex items-center justify-center text-[9px] font-bold", t.color)}>
                {t.type}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-foreground">{t.dest}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{t.time}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

function EventsMockup() {
  const events = [
    { name: "FC Barcelona vs Real Madrid", type: "Fútbol", icon: "⚽", color: "text-blue-400" },
    { name: "Primavera Sound", type: "Festival", icon: "🎵", color: "text-purple-400" },
    { name: "MSC Grandiosa", type: "Crucero", icon: "🚢", color: "text-cyan-400" },
  ];
  return (
    <PhoneFrame glowColor="bg-purple-500">
      <div className="rounded-xl bg-card/60 overflow-hidden mx-3">
        <div className="px-4 py-2.5 bg-purple-500/10 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-xs font-semibold text-purple-400">Hoy en Barcelona</span>
          </div>
          <span className="text-[10px] text-muted-foreground">3 eventos</span>
        </div>
        <div className="divide-y divide-border/20">
          {events.map((e, i) => (
            <motion.div
              key={e.name}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.12, duration: 0.35 }}
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
    </PhoneFrame>
  );
}

function EarningsMockup() {
  const bars = [65, 45, 80, 55, 90, 70, 85];
  const days = ["L", "M", "X", "J", "V", "S", "D"];
  return (
    <PhoneFrame glowColor="bg-orange-500">
      <div className="rounded-xl bg-card/60 overflow-hidden mx-3">
        <div className="px-4 py-3 border-b border-border/20">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-muted-foreground">Esta semana</span>
              <div className="flex items-baseline gap-1">
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
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
              transition={{ delay: 0.6 }}
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
                  transition={{ delay: 0.5 + i * 0.07, duration: 0.5, ease: "easeOut" }}
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
    </PhoneFrame>
  );
}

function RadarMockup() {
  const zones = [
    { name: "T1", taxis: 24, wait: "45 min", active: true },
    { name: "T2", taxis: 12, wait: "20 min", active: false },
    { name: "Sants", taxis: 8, wait: "15 min", active: false },
  ];
  return (
    <PhoneFrame glowColor="bg-rose-500">
      <div className="rounded-xl bg-card/60 overflow-hidden mx-3">
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
        <div className="p-2.5 space-y-1.5">
          {zones.map((z, i) => (
            <motion.div
              key={z.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.12 }}
              className={cn(
                "rounded-xl p-2.5 border flex items-center justify-between",
                z.active
                  ? "border-rose-500/40 bg-rose-500/10"
                  : "border-border/20 bg-muted/20"
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs",
                  z.active ? "bg-rose-500/20 text-rose-400" : "bg-muted/40 text-foreground"
                )}>
                  {z.name}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-foreground">{z.wait}</span>
                    {z.active && (
                      <span className="text-[8px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full font-medium">
                        Aqui
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{z.taxis} taxis</span>
                </div>
              </div>
              <Clock className="h-3 w-3 text-muted-foreground" />
            </motion.div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Slide data
   ═══════════════════════════════════════════════════════════════ */

interface SlideData {
  id: string;
  tagline: string;
  body: string;
  accentColor: string;
  accentBar: string;
  illustration: React.ReactNode;
}

const slides: SlideData[] = [
  {
    id: "welcome",
    tagline: "Tu copiloto en Barcelona",
    body: "Vuelos, trenes, eventos y radar.\nTodo en un toque.",
    accentColor: "text-amber-400",
    accentBar: "bg-amber-400",
    illustration: <WelcomeIllustration />,
  },
  {
    id: "vuelos",
    tagline: "Pasajeros aterrizando",
    body: "Llegadas en tiempo real de T1 y T2.\nAnticipa los picos de demanda.",
    accentColor: "text-blue-400",
    accentBar: "bg-blue-400",
    illustration: <FlightsMockup />,
  },
  {
    id: "trenes",
    tagline: "Sants al momento",
    body: "AVE, IRYO y Ouigo.\nSabes cuándo llega la demanda.",
    accentColor: "text-emerald-400",
    accentBar: "bg-emerald-400",
    illustration: <TrainsMockup />,
  },
  {
    id: "eventos",
    tagline: "El pulso de la ciudad",
    body: "Partidos, conciertos y cruceros.\nEstate donde hay demanda.",
    accentColor: "text-purple-400",
    accentBar: "bg-purple-400",
    illustration: <EventsMockup />,
  },
  {
    id: "ingresos",
    tagline: "Tu dinero, controlado",
    body: "Registra carreras con un toque.\nVe tu evolución al instante.",
    accentColor: "text-orange-400",
    accentBar: "bg-orange-400",
    illustration: <EarningsMockup />,
  },
  {
    id: "radar",
    tagline: "Tu zona, en vivo",
    body: "Taxis y tiempos de espera.\nDetección automática.",
    accentColor: "text-rose-400",
    accentBar: "bg-rose-400",
    illustration: <RadarMockup />,
  },
];

/* ═══════════════════════════════════════════════════════════════
   Segmented Progress Bar
   ═══════════════════════════════════════════════════════════════ */

function SegmentedProgress({
  total,
  current,
  accentBar,
}: {
  total: number;
  current: number;
  accentBar: string;
}) {
  return (
    <div className="flex gap-1.5 w-full">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="flex-1 h-1 rounded-full overflow-hidden bg-white/10"
        >
          <motion.div
            className={cn("h-full rounded-full", accentBar)}
            initial={false}
            animate={{
              width: i < current ? "100%" : i === current ? "100%" : "0%",
              opacity: i <= current ? 1 : 0,
            }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
          />
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Swipe config
   ═══════════════════════════════════════════════════════════════ */

const SWIPE_THRESHOLD = 50;

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

interface OnboardingFlowProps {
  onComplete: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [current, setCurrent] = useState(0);
  const [showAccount, setShowAccount] = useState(false);
  const isLast = current === slides.length - 1;
  const slide = slides[current];

  const handleNext = useCallback(() => {
    if (isLast) {
      setShowAccount(true);
    } else {
      setCurrent((c) => c + 1);
    }
  }, [isLast]);

  const handlePrev = useCallback(() => {
    if (current > 0) {
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
        {/* Background ambient glow */}
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id + "-bg"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 pointer-events-none"
          >
            <div className={cn(
              "absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] rounded-full blur-[120px] opacity-[0.07]",
              slide.accentBar
            )} />
          </motion.div>
        </AnimatePresence>

        {/* ── Illustration zone (top 58%) ── */}
        <div
          className="relative z-10 flex-[1.3] flex items-center justify-center overflow-hidden"
          onTouchStart={(e) => {
            (e.currentTarget as any)._touchStartX = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const startX = (e.currentTarget as any)._touchStartX;
            if (startX == null) return;
            const diff = e.changedTouches[0].clientX - startX;
            if (diff < -SWIPE_THRESHOLD && !isLast) handleNext();
            else if (diff > SWIPE_THRESHOLD && current > 0) handlePrev();
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.97 }}
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="w-full flex items-center justify-center px-6"
            >
              {slide.illustration}
            </motion.div>
          </AnimatePresence>

          {/* Gradient fade into text zone */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </div>

        {/* ── Text + Controls zone (bottom 42%) ── */}
        <div className="relative z-10 flex-1 flex flex-col px-8 pt-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)' }}>
          {/* Text content */}
          <div className="flex-1 flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={slide.id + "-text"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-2"
              >
                {/* Tagline */}
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.3 }}
                  className="font-display text-[28px] font-bold text-foreground leading-tight"
                >
                  {slide.tagline}
                </motion.h1>

                {/* Body */}
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.3 }}
                  className="text-[15px] text-muted-foreground leading-relaxed whitespace-pre-line"
                >
                  {slide.body}
                </motion.p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom controls */}
          <div className="space-y-4 pb-20">
            {/* Segmented progress */}
            <SegmentedProgress
              total={slides.length}
              current={current}
              accentBar={slide.accentBar}
            />

            {/* CTA Button */}
            {isLast ? (
              <Button
                onClick={handleNext}
                size="lg"
                className="w-full h-14 rounded-2xl text-[15px] font-bold bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:via-amber-300 hover:to-yellow-400 text-black shadow-lg shadow-yellow-500/30 relative overflow-hidden ring-1 ring-yellow-300/30"
              >
                {/* Shimmer overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer bg-[length:200%_100%]" />
                <span className="relative flex items-center gap-2">
                  <Zap className="h-4.5 w-4.5" />
                  Empezar ahora
                </span>
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                size="lg"
                className={cn(
                  "w-full h-14 rounded-2xl text-[15px] font-semibold",
                  "bg-white/[0.08] hover:bg-white/[0.12] text-foreground border border-white/[0.12] backdrop-blur-md shadow-lg shadow-black/10"
                )}
              >
                <span className="flex items-center gap-2">
                  Continuar
                  <ChevronRight className="h-4 w-4" />
                </span>
              </Button>
            )}

            {/* Skip link */}
            {!isLast && (
              <button
                onClick={handleSkip}
                className="w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2.5 rounded-xl hover:bg-white/[0.04]"
              >
                Saltar introducción
              </button>
            )}

            {/* Welcome tagline */}
            {current === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex justify-center"
              >
                <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/50 bg-white/[0.03] border border-white/[0.06] rounded-full px-3 py-1">
                  <Shield className="h-2.5 w-2.5" />
                  Hecha por y para taxistas de Barcelona
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Account creation dialog */}
      <AccountCreationDialog
        open={showAccount}
        onDone={handleAccountDone}
        onSkip={handleAccountDone}
      />
    </>
  );
}
