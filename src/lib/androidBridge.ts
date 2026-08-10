export type AndroidWidgetSize = "compact" | "standard" | "expanded"
export type AndroidWidgetAction = "floating" | "pin"

const PRODUCTION_ORIGIN = "https://nptcricketofficial.vercel.app"
const LIVE_SCORE_PATH = /^\/open\/live-score\/([A-Za-z0-9_-]{1,80})\/?$/

export const isAndroidDevice = () => /Android/i.test(navigator.userAgent)

export const isAndroidBridgeFallback = () => LIVE_SCORE_PATH.test(window.location.pathname)

export const androidBridgeRequest = () => {
  const match = window.location.pathname.match(LIVE_SCORE_PATH)
  if (!match) return null
  const params = new URLSearchParams(window.location.search)
  const size = params.get("size")
  const mode = params.get("mode")
  if (!size || !["compact", "standard", "expanded"].includes(size)) return null
  if (mode !== "floating" && mode !== "pin") return null
  return { matchId: match[1], size: size as AndroidWidgetSize, mode }
}

export const openAndroidWidget = (
  matchId: string,
  size: AndroidWidgetSize,
  action: AndroidWidgetAction,
) => {
  if (!isAndroidDevice()) {
    return { opened: false, message: "Floating and launcher widgets require the CricVault Android companion app." }
  }
  const safeMatchId = /^[A-Za-z0-9_-]{1,80}$/.test(matchId) ? matchId : "live"
  const url = new URL(`/open/live-score/${safeMatchId}`, PRODUCTION_ORIGIN)
  url.searchParams.set("mode", action)
  url.searchParams.set("size", size)
  window.location.assign(url.toString())
  return { opened: true, message: "Opening CricVault for Android…" }
}
