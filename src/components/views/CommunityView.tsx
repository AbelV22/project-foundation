import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp, Plus, Loader2, MessageSquarePlus, Sparkles,
  CheckCircle2, Clock, Zap, X, Filter
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  useFeedback,
  CATEGORIES,
  STATUS_META,
  type FeatureRequest,
} from "@/hooks/useFeedback";

// ── Status icon ───────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border", meta.color)}>
      {meta.label}
    </span>
  );
}

// ── Single feature card ───────────────────────────────────────
function FeatureCard({ feature, onVote }: { feature: FeatureRequest; onVote: () => void }) {
  const cat = CATEGORIES.find((c) => c.value === feature.category);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-dashboard p-4 flex gap-3 items-start"
    >
      {/* Vote button */}
      <button
        onClick={onVote}
        className={cn(
          "flex flex-col items-center gap-0.5 min-w-[40px] pt-0.5 rounded-xl py-2 px-1.5 transition-all border",
          feature.has_voted
            ? "border-primary/50 bg-primary/10 text-primary"
            : "border-border/50 text-muted-foreground hover:border-primary/30 hover:text-primary"
        )}
      >
        <ChevronUp className={cn("h-4 w-4 transition-transform", feature.has_voted && "scale-110")} />
        <span className="text-xs font-bold tabular-nums leading-none">{feature.vote_count}</span>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-1">
          <p className="text-sm font-semibold text-foreground leading-tight flex-1">
            {feature.title}
          </p>
          <StatusBadge status={feature.status} />
        </div>

        {feature.description && (
          <p className="text-xs text-muted-foreground leading-relaxed mb-2">
            {feature.description}
          </p>
        )}

        <div className="flex items-center gap-2">
          {cat && (
            <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">
              {cat.emoji} {cat.label}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/60">
            {new Date(feature.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ── Submit form ───────────────────────────────────────────────
function SubmitForm({ onClose, onSubmit, submitting }: {
  onClose: () => void;
  onSubmit: (p: { title: string; description: string; category: string }) => Promise<void>;
  submitting: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");

  const handleSubmit = async () => {
    if (!title.trim()) return;
    await onSubmit({ title, description, category });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm bg-background border border-border/60 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Nueva sugerencia</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Category */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-all",
                  category === cat.value
                    ? "border-primary/50 bg-primary/10 text-primary font-semibold"
                    : "border-border/50 text-muted-foreground hover:border-primary/30"
                )}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">¿Qué mejorarías?</label>
            <Input
              placeholder="Ej: Mostrar cuántos taxis hay en cada zona"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground text-right">{title.length}/120</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Detalle (opcional)</label>
            <Textarea
              placeholder="Explica brevemente para qué te serviría..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || submitting}
            className="w-full"
            size="default"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Enviar sugerencia
              </span>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main view ─────────────────────────────────────────────────
const FILTER_OPTIONS = [
  { value: "all",         label: "Todas" },
  { value: "pending",     label: "Propuestas" },
  { value: "planned",     label: "Planificadas" },
  { value: "in_progress", label: "En marcha" },
  { value: "done",        label: "Listas" },
];

export function CommunityView() {
  const { requests, loading, submitting, vote, submit } = useFeedback();
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = requests.filter(
    (r) => filterStatus === "all" || r.status === filterStatus
  );

  const planned  = requests.filter((r) => r.status === "planned" || r.status === "in_progress").length;
  const done     = requests.filter((r) => r.status === "done").length;
  const total    = requests.length;

  return (
    <div className="pb-32">
      {/* Hero header */}
      <div className="px-4 pt-2 pb-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Comunidad iTaxiBcn</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vota las features que más necesitas
            </p>
          </div>
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 shrink-0">
            <Plus className="h-3.5 w-3.5" />
            Sugerir
          </Button>
        </div>

        {/* Stats row */}
        {!loading && total > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: MessageSquarePlus, value: total,   label: "propuestas", color: "text-blue-400" },
              { icon: Zap,              value: planned,  label: "en progreso",color: "text-amber-400" },
              { icon: CheckCircle2,     value: done,     label: "disponibles",color: "text-emerald-400" },
            ].map(({ icon: Icon, value, label, color }) => (
              <div key={label} className="card-dashboard p-3 text-center">
                <Icon className={cn("h-4 w-4 mx-auto mb-1", color)} />
                <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={cn(
                "shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all",
                filterStatus === opt.value
                  ? "border-primary/50 bg-primary/10 text-primary font-semibold"
                  : "border-border/50 text-muted-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <MessageSquarePlus className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <div>
              <p className="text-sm font-medium text-foreground">Sin sugerencias aún</p>
              <p className="text-xs text-muted-foreground mt-1">¡Sé el primero en proponer una mejora!</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Añadir sugerencia
            </Button>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((req) => (
              <FeatureCard
                key={req.id}
                feature={req}
                onVote={() => vote(req.id, !!req.has_voted)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Submit form modal */}
      <AnimatePresence>
        {showForm && (
          <SubmitForm
            onClose={() => setShowForm(false)}
            onSubmit={submit}
            submitting={submitting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
