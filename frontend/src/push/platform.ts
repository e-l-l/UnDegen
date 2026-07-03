// Web Push platform capability checks. iOS is the awkward one: Web Push only works
// there when the PWA is installed to the home screen (standalone display mode), and
// Notification.requestPermission() is unavailable until then — so the UI must gate
// the ask behind an "Add to Home Screen" step on iOS.

export function isIOS(): boolean {
  const ua = navigator.userAgent
  // iPadOS 13+ reports as MacIntel; disambiguate via touch points.
  return /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

// Does this browser have the Web Push primitives at all?
export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
}

// On iOS the user must install the PWA before we can even ask for permission.
export function needsInstallFirst(): boolean {
  return isIOS() && !isStandalone()
}
