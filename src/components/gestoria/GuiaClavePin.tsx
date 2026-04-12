/**
 * GuiaClavePin — Guía paso a paso para presentar modelos en AEAT con Cl@ve PIN
 *
 * Tutorial visual que elimina el miedo del taxista a presentar sus propios modelos.
 */

import { useState } from 'react';
import {
  ExternalLink, ChevronRight, ChevronLeft, CheckCircle2, Shield,
  Smartphone, Key, FileText, Send, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  title: string;
  description: string;
  icon: React.ReactNode;
  details: string[];
  tip?: string;
  link?: { url: string; label: string };
}

const STEPS_CLAVE: Step[] = [
  {
    title: 'Registrarse en Cl@ve',
    description: 'Solo la primera vez. Necesitas DNI/NIE y teléfono móvil.',
    icon: <Key className="h-6 w-6 text-amber-400" />,
    details: [
      'Ve a clave.gob.es y pulsa "Registro en Cl@ve"',
      'Puedes registrarte online con certificado o presencialmente en una oficina de la AEAT',
      'Si no tienes certificado, pide cita previa en la AEAT (es gratis)',
      'Necesitas: DNI/NIE + número de teléfono + correo electrónico',
      'Te darán una carta con un código de activación',
    ],
    tip: 'La opción más rápida es ir a una oficina de AEAT con cita previa. En 5 minutos estás registrado.',
    link: { url: 'https://clave.gob.es/clave_Home/registro.html', label: 'clave.gob.es/registro' },
  },
  {
    title: 'Instalar la app Cl@ve PIN',
    description: 'Instala la app oficial en tu móvil para obtener códigos PIN.',
    icon: <Smartphone className="h-6 w-6 text-blue-400" />,
    details: [
      'Busca "Cl@ve PIN" en Google Play o App Store',
      'Descarga la app oficial de la AEAT',
      'Abre la app e inicia sesión con tu DNI/NIE',
      'Activa la app con el código que te dieron al registrarte',
      'Cada vez que necesites identificarte, la app generará un PIN temporal',
    ],
    tip: 'El PIN caduca en unos minutos. Genera el PIN justo cuando lo vayas a usar en la web de AEAT.',
  },
  {
    title: 'Acceder a la Sede Electrónica',
    description: 'Entra en la web de la AEAT para presentar el modelo.',
    icon: <Shield className="h-6 w-6 text-emerald-400" />,
    details: [
      'Ve a sede.agenciatributaria.gob.es',
      'Busca el modelo que quieres presentar (130, 131, 303...)',
      'Pulsa "Presentación" del modelo que necesites',
      'Te pedirá identificarte: elige "Cl@ve PIN"',
      'Abre la app Cl@ve en tu móvil, obtén el PIN y escríbelo en la web',
    ],
    link: { url: 'https://sede.agenciatributaria.gob.es', label: 'Sede Electrónica AEAT' },
  },
  {
    title: 'Rellenar el formulario',
    description: 'Copia los datos del borrador que te generamos.',
    icon: <FileText className="h-6 w-6 text-purple-400" />,
    details: [
      'Selecciona el ejercicio (año) y periodo (trimestre)',
      'Rellena las casillas con los datos de tu borrador PDF de iTaxiBcn',
      'Cada casilla tiene un número ([01], [02]...) que coincide con nuestro PDF',
      'Revisa que los importes coinciden',
      'Si tienes dudas, pulsa el "?" junto a cada casilla en la web de AEAT',
    ],
    tip: 'Descarga el borrador PDF desde iTaxiBcn antes de empezar. Así tendrás todos los números a mano.',
  },
  {
    title: 'Firmar y presentar',
    description: 'Revisa, firma y envía. Guarda el justificante.',
    icon: <Send className="h-6 w-6 text-primary" />,
    details: [
      'La web de AEAT te mostrará un resumen del modelo',
      'Revisa que todo es correcto',
      'Pulsa "Firmar y Enviar" (o "Presentar")',
      'Te pedirá confirmar con tu PIN de Cl@ve',
      'Guarda el PDF del justificante de presentación',
      'La AEAT te enviará un email de confirmación',
    ],
    tip: 'El justificante es tu prueba de que presentaste a tiempo. Guárdalo al menos 4 años.',
  },
];

export default function GuiaClavePin({ onClose }: { onClose?: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = STEPS_CLAVE[currentStep];
  const isLast = currentStep === STEPS_CLAVE.length - 1;
  const isFirst = currentStep === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base">Guía: Presentar con Cl@ve PIN</h3>
            <p className="text-xs text-muted-foreground">5 pasos para ser autosuficiente</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Con Cl@ve PIN puedes presentar todos tus modelos tributarios desde el móvil o el ordenador,
          sin necesidad de gestoría. Es gratis y lo usarás cada trimestre.
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2">
        {STEPS_CLAVE.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentStep(i)}
            className={cn(
              "w-2.5 h-2.5 rounded-full transition-all",
              i === currentStep ? "bg-primary w-6" : i < currentStep ? "bg-primary/50" : "bg-muted"
            )}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-2xl border border-border/50 bg-card/30 overflow-hidden">
        {/* Step header */}
        <div className="p-4 bg-muted/30 border-b border-border/30 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-background flex items-center justify-center text-sm font-bold text-primary">
            {currentStep + 1}
          </div>
          {step.icon}
          <div>
            <h4 className="font-semibold text-sm">{step.title}</h4>
            <p className="text-xs text-muted-foreground">{step.description}</p>
          </div>
        </div>

        {/* Details */}
        <div className="p-4 space-y-2">
          {step.details.map((detail, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="text-sm text-muted-foreground leading-tight">{detail}</span>
            </div>
          ))}
        </div>

        {/* Tip */}
        {step.tip && (
          <div className="mx-4 mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-amber-400">Consejo:</strong> {step.tip}
            </p>
          </div>
        )}

        {/* Link */}
        {step.link && (
          <div className="mx-4 mb-4">
            <a
              href={step.link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {step.link.label}
            </a>
          </div>
        )}

        {/* Navigation */}
        <div className="p-4 border-t border-border/30 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(s => s - 1)}
            disabled={isFirst}
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg transition-colors",
              isFirst ? "opacity-30" : "hover:bg-muted text-muted-foreground"
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Anterior
          </button>

          <span className="text-xs text-muted-foreground">
            {currentStep + 1} / {STEPS_CLAVE.length}
          </span>

          {isLast ? (
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-2 rounded-lg bg-primary text-primary-foreground"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Entendido
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep(s => s + 1)}
              className="flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg hover:bg-muted text-primary"
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="rounded-xl border border-border/50 p-3 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Enlaces rápidos</p>
        {[
          { label: 'Registro Cl@ve', url: 'https://clave.gob.es/clave_Home/registro.html' },
          { label: 'Sede Electrónica AEAT', url: 'https://sede.agenciatributaria.gob.es' },
          { label: 'Cita previa AEAT', url: 'https://sede.agenciatributaria.gob.es/Sede/procedimientoini/GC07.shtml' },
          { label: 'App Cl@ve PIN (Google Play)', url: 'https://play.google.com/store/apps/details?id=es.aeat.pin24h' },
        ].map(link => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-primary hover:underline py-1"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
