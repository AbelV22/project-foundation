import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getItemSync } from "@/lib/storage";

function getDeviceId(): string {
  return getItemSync("device_id") || getItemSync("geofence_device_id") || "unknown";
}

// Fire-and-forget: never blocks the UI, never throws
async function sendEvent(
  type: "view" | "action",
  name: string,
  properties?: Record<string, unknown>
) {
  try {
    await supabase.from("app_events").insert({
      device_id: getDeviceId(),
      event_type: type,
      event_name: name,
      properties: properties ?? null,
    });
  } catch {
    // Silently swallow — analytics must never break the app
  }
}

export function useAnalytics() {
  const trackView = useCallback((tabName: string) => {
    sendEvent("view", `tab_${tabName}`);
  }, []);

  const trackAction = useCallback(
    (actionName: string, properties?: Record<string, unknown>) => {
      sendEvent("action", actionName, properties);
    },
    []
  );

  return { trackView, trackAction };
}

// Standalone helper for use outside React components
export const analytics = {
  view: (tabName: string) => sendEvent("view", `tab_${tabName}`),
  action: (name: string, props?: Record<string, unknown>) =>
    sendEvent("action", name, props),
};
