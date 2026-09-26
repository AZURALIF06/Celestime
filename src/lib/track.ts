// Célestime — événements analytics (section 55).
// Envoi silencieux, jamais bloquant.

const EVENTS = new Set([
  "editor_opened",
  "occasion_selected",
  "date_completed",
  "location_completed",
  "design_selected",
  "preview_generated",
  "customization_completed",
  "add_to_cart",
  "checkout_started",
  "purchase_completed",
  "editor_abandoned",
]);

export function track(event: string, data: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  if (!EVENTS.has(event)) return;
  try {
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data, ts: Date.now() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* silencieux */
  }
}
