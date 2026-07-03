import { needsInstallFirst, pushSupported } from "./platform"
import { currentPermission } from "./subscribe"

// Should we surface the contextual "enable notifications" ask right now? It's
// offered at the one high-intent moment — just after creating a reminder — so we
// never nag: show it when iOS still needs installing, or when we can still prompt
// (permission is 'default'). Once granted or blocked, we stop offering.
export function shouldOfferAsk(): boolean {
  if (needsInstallFirst()) return true
  return pushSupported() && currentPermission() === "default"
}
