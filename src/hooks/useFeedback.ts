import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getItemSync } from "@/lib/storage";
import { toast } from "sonner";

export interface FeatureRequest {
  id: string;
  device_id: string;
  user_email: string | null;
  title: string;
  description: string | null;
  category: string;
  vote_count: number;
  status: "pending" | "planned" | "in_progress" | "done" | "rejected";
  created_at: string;
  has_voted?: boolean; // populated client-side
}

export const CATEGORIES = [
  { value: "datos",      label: "Datos & Info",    emoji: "📊" },
  { value: "radar",      label: "Radar / Zonas",   emoji: "📍" },
  { value: "ingresos",   label: "Ingresos",         emoji: "💶" },
  { value: "ui",         label: "Diseño / App",     emoji: "✨" },
  { value: "alertas",    label: "Alertas",          emoji: "🔔" },
  { value: "general",    label: "General",          emoji: "💡" },
] as const;

export const STATUS_META: Record<string, { label: string; color: string }> = {
  pending:     { label: "Propuesto",    color: "text-slate-400  border-slate-500/30 bg-slate-500/10" },
  planned:     { label: "Planificado", color: "text-blue-400   border-blue-500/30  bg-blue-500/10"  },
  in_progress: { label: "En marcha",   color: "text-amber-400  border-amber-500/30 bg-amber-500/10" },
  done:        { label: "Disponible",  color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  rejected:    { label: "Descartado",  color: "text-red-400    border-red-500/30   bg-red-500/10"   },
};

function getDeviceId(): string {
  return getItemSync("device_id") || getItemSync("geofence_device_id") || "unknown";
}

export function useFeedback() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const deviceId = getDeviceId();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all feature requests
      const { data: features, error } = await supabase
        .from("feature_requests")
        .select("*")
        .order("vote_count", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch which ones this device has voted on
      const { data: votes } = await supabase
        .from("feature_votes")
        .select("feature_id")
        .eq("device_id", deviceId);

      const votedSet = new Set((votes || []).map((v: any) => v.feature_id));

      setRequests(
        (features || []).map((f: any) => ({
          ...f,
          has_voted: votedSet.has(f.id),
        }))
      );
    } catch (e) {
      console.error("[useFeedback] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const vote = useCallback(async (featureId: string, currentlyVoted: boolean) => {
    // Optimistic update
    setRequests((prev) =>
      prev.map((r) =>
        r.id === featureId
          ? { ...r, has_voted: !currentlyVoted, vote_count: r.vote_count + (currentlyVoted ? -1 : 1) }
          : r
      )
    );

    if (currentlyVoted) {
      await supabase
        .from("feature_votes")
        .delete()
        .eq("feature_id", featureId)
        .eq("device_id", deviceId);
    } else {
      const { error } = await supabase
        .from("feature_votes")
        .insert({ feature_id: featureId, device_id: deviceId });
      if (error?.code === "23505") {
        // Already voted (race condition) — revert
        setRequests((prev) =>
          prev.map((r) =>
            r.id === featureId ? { ...r, has_voted: true } : r
          )
        );
      }
    }
  }, [deviceId]);

  const submit = useCallback(async (params: {
    title: string;
    description: string;
    category: string;
  }) => {
    if (!params.title.trim()) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("feature_requests").insert({
        device_id: deviceId,
        user_email: user?.email ?? null,
        title: params.title.trim(),
        description: params.description.trim() || null,
        category: params.category,
      });
      if (error) throw error;
      toast.success("¡Sugerencia enviada!", {
        description: "Gracias. La revisaremos pronto.",
      });
      await fetchRequests();
    } catch (e) {
      toast.error("Error al enviar la sugerencia");
    } finally {
      setSubmitting(false);
    }
  }, [deviceId, fetchRequests]);

  return { requests, loading, submitting, vote, submit, refetch: fetchRequests };
}
