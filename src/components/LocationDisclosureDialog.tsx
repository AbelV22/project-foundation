import { motion } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
} from "@/components/ui/alert-dialog";
import { MapPin, Shield, Wifi, BatteryCharging } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationDisclosureDialogProps {
  open: boolean;
  onAccept: () => void;
}

const features = [
  {
    icon: MapPin,
    title: "Detecta tu zona",
    desc: "T1, T2 o Sants automaticamente",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    icon: Wifi,
    title: "Tiempo real",
    desc: "Espera calculada con datos reales",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: BatteryCharging,
    title: "Bajo consumo",
    desc: "Optimizado para minimo uso de bateria",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
];

export function LocationDisclosureDialog({ open, onAccept }: LocationDisclosureDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-[92%] md:max-w-sm rounded-3xl border-border/50 p-0 overflow-hidden gap-0">
        {/* Header with animated radar */}
        <div className="relative bg-gradient-to-b from-rose-500/10 to-transparent px-6 pt-8 pb-5 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative mb-5"
          >
            {/* Radar rings */}
            {[1, 2, 3].map((ring) => (
              <motion.div
                key={ring}
                animate={{
                  scale: [1, 1.4 + ring * 0.3],
                  opacity: [0.3, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: ring * 0.4,
                  ease: "easeOut",
                }}
                className="absolute inset-0 rounded-full border border-rose-400/30"
              />
            ))}
            <div className="w-16 h-16 bg-rose-500/15 rounded-full flex items-center justify-center relative z-10">
              <MapPin className="h-7 w-7 text-rose-400" />
            </div>
          </motion.div>

          <h2 className="text-lg font-bold text-foreground mb-1">
            Modo Radar
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Para detectar cuando entras o sales del aeropuerto o Sants,
            necesitamos acceder a tu ubicacion en segundo plano.
          </p>
        </div>

        {/* Features */}
        <div className="px-5 py-4 space-y-2.5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", f.bg)}>
                <f.icon className={cn("h-4 w-4", f.color)} />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-foreground block">{f.title}</span>
                <span className="text-[11px] text-muted-foreground">{f.desc}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Privacy note */}
        <div className="mx-5 mb-4 px-3 py-2.5 bg-muted/30 rounded-xl flex items-start gap-2.5">
          <Shield className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Tus datos de ubicacion se usan exclusivamente para calcular tiempos de espera.
            No se comparten con terceros.
          </p>
        </div>

        {/* Action */}
        <div className="px-5 pb-6">
          <AlertDialogAction
            onClick={onAccept}
            className="w-full h-12 rounded-xl font-semibold text-sm bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white shadow-lg shadow-rose-500/20"
          >
            Activar Radar
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
