import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Smartphone,
  RefreshCw,
  LogIn,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AccountCreationDialogProps {
  open: boolean;
  onDone: () => void;
  onSkip: () => void;
}

const benefits = [
  {
    icon: Cloud,
    text: "Sincroniza ingresos y gastos en la nube",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: Smartphone,
    text: "Accede desde cualquier dispositivo",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: RefreshCw,
    text: "Recupera tus datos si cambias de movil",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
];

export function AccountCreationDialog({ open, onDone, onSkip }: AccountCreationDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"register" | "login">("register");

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Rellena email y contraseña");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
        });

        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            setError("Este email ya está registrado. Prueba a iniciar sesión.");
          } else {
            setError(signUpError.message);
          }
          return;
        }

        if (!data.session) {
          setError("No se pudo crear la sesión. Inténtalo de nuevo.");
          return;
        }

        setSuccess(true);
        toast.success("¡Cuenta creada!", {
          description: "Tu cuenta está lista. Tus datos se sincronizarán automáticamente.",
        });
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (signInError) {
          if (signInError.message.includes("Invalid login")) {
            setError("Email o contraseña incorrectos.");
          } else {
            setError(signInError.message);
          }
          return;
        }

        setSuccess(true);
        toast.success("¡Sesión iniciada!", {
          description: "Bienvenido de vuelta.",
        });
      }

      setTimeout(() => {
        onDone();
      }, 2000);
    } catch (e) {
      setError("Error inesperado. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  const switchMode = () => {
    setMode(mode === "register" ? "login" : "register");
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onSkip(); }}>
      <DialogContent
        className="max-w-[92%] md:max-w-sm rounded-3xl border-border/50 p-0 overflow-y-auto [&>button]:hidden"
        style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-bottom, 0px) - 2rem)' }}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {!success && (
          <button
            type="button"
            onClick={onSkip}
            aria-label="Cerrar"
            className="absolute right-2 top-2 z-10 w-11 h-11 rounded-full flex items-center justify-center bg-muted/40 hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        {success ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center justify-center p-10 text-center gap-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center"
            >
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </motion.div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {mode === "register" ? "¡Cuenta creada!" : "¡Sesión iniciada!"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Tus datos se sincronizarán automáticamente.
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-gradient-to-b from-primary/8 to-transparent px-6 pt-7 pb-4">
              <div className="flex flex-col items-center text-center mb-5">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3"
                >
                  <span className="text-2xl">{mode === "register" ? "🔐" : "👋"}</span>
                </motion.div>
                <DialogTitle className="text-lg font-bold leading-tight">
                  {mode === "register" ? "Crea tu cuenta" : "Iniciar sesión"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {mode === "register"
                    ? "Opcional — puedes hacerlo mas tarde"
                    : "Accede con tu cuenta existente"}
                </DialogDescription>
              </div>

              {/* Benefits - only on register */}
              {mode === "register" && (
                <div className="space-y-2">
                  {benefits.map((b, i) => (
                    <motion.div
                      key={b.text}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.08 }}
                      className="flex items-center gap-2.5"
                    >
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", b.bg)}>
                        <b.icon className={cn("h-3.5 w-3.5", b.color)} />
                      </div>
                      <span className="text-[11px] text-muted-foreground leading-tight">{b.text}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Form */}
            <div className="px-6 pb-6 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="ob-email" className="text-xs font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="ob-email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    className="pl-9 h-11 text-sm rounded-xl bg-muted/30 border-border/50"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ob-password" className="text-xs font-medium">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="ob-password"
                    type={showPassword ? "text" : "password"}
                    placeholder={mode === "register" ? "Minimo 6 caracteres" : "Tu contraseña"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    className="pl-9 pr-10 h-11 text-sm rounded-xl bg-muted/30 border-border/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-400 bg-red-500/10 px-3 py-2.5 rounded-xl"
                >
                  {error}
                </motion.p>
              )}

              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full h-12 rounded-xl font-semibold text-sm mt-1 shadow-lg shadow-primary/10"
                size="default"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {mode === "register" ? "Creando cuenta..." : "Iniciando sesión..."}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {mode === "register" ? (
                      <>
                        Crear cuenta
                        <ArrowRight className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4" />
                        Iniciar sesión
                      </>
                    )}
                  </span>
                )}
              </Button>

              {/* Toggle register/login */}
              <button
                onClick={switchMode}
                className="w-full text-xs text-primary/80 hover:text-primary transition-colors py-2 text-center rounded-xl hover:bg-primary/5"
              >
                {mode === "register"
                  ? "¿Ya tienes cuenta? Inicia sesión"
                  : "¿No tienes cuenta? Créala aquí"}
              </button>

              <button
                onClick={onSkip}
                className="w-full text-sm font-medium text-foreground/80 hover:text-foreground transition-colors py-3 text-center rounded-xl bg-muted/30 hover:bg-muted/50 border border-border/40"
              >
                Continuar sin cuenta
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
