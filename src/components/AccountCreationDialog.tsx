import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, UserPlus, ArrowRight, CheckCircle2, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
  "Sincroniza tus ingresos y gastos en la nube",
  "Accede desde cualquier dispositivo",
  "Recupera tus datos si cambias de móvil",
];

export function AccountCreationDialog({ open, onDone, onSkip }: AccountCreationDialogProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Rellena email y contraseña");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
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

      setSuccess(true);
      toast.success("¡Cuenta creada!", {
        description: "Revisa tu email para confirmar tu cuenta.",
      });

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
    if (e.key === "Enter") handleRegister();
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-[92%] md:max-w-sm rounded-3xl border-border/50 p-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {success ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center justify-center p-8 text-center gap-4"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">¡Cuenta creada!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Revisa tu email para confirmar tu cuenta.
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Header gradient */}
            <div className="bg-gradient-to-b from-primary/10 to-transparent p-6 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold leading-tight">
                    Crea tu cuenta
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Opcional — puedes hacerlo después
                  </DialogDescription>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-1.5 mt-3">
                {benefits.map((b) => (
                  <div key={b} className="flex items-start gap-2">
                    <Star className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                    <span className="text-xs text-muted-foreground leading-tight">{b}</span>
                  </div>
                ))}
              </div>
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
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    onKeyDown={handleKeyDown}
                    className="pl-9 h-10 text-sm"
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
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    onKeyDown={handleKeyDown}
                    className="pl-9 pr-10 h-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg"
                >
                  {error}
                </motion.p>
              )}

              <Button
                onClick={handleRegister}
                disabled={loading}
                className="w-full h-10 mt-1"
                size="default"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Creando cuenta...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Crear cuenta
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>

              <button
                onClick={onSkip}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2 text-center"
              >
                Continuar sin cuenta por ahora
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
