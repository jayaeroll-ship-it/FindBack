import { api, json } from "./api";
import { readConsent } from "./consent";
const events = new Set([
  "report_submission",
  "search",
  "match_view",
  "claim_initiation",
]);
export async function track(event: string) {
  if (!readConsent()?.analytics || !events.has(event)) return;
  const config = await api<{ analytics_provider: string }>("/config").catch(
    () => null,
  );
  if (config?.analytics_provider === "internal")
    await api("/analytics/events", json("POST", { event })).catch(() => {});
}
