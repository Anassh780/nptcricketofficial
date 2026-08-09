export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let deferredPrompt: InstallPromptEvent | null = null
let captureEnabled = false
const subscribers = new Set<(prompt: InstallPromptEvent | null) => void>()

const publish = () => subscribers.forEach((subscriber) => subscriber(deferredPrompt))

export const enablePwaInstallCapture = () => {
  if (captureEnabled || typeof window === "undefined") return
  captureEnabled = true
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault()
    deferredPrompt = event as InstallPromptEvent
    publish()
  })
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    publish()
  })
}

export const getInstallPrompt = () => deferredPrompt

export const subscribeInstallPrompt = (subscriber: (prompt: InstallPromptEvent | null) => void) => {
  subscribers.add(subscriber)
  subscriber(deferredPrompt)
  return () => {
    subscribers.delete(subscriber)
  }
}

export const clearInstallPrompt = () => {
  deferredPrompt = null
  publish()
}
