import { useEffect, useMemo, useState } from "react"
import { Download, Maximize2, Moon, MousePointerClick, Move, Pin, RefreshCw, Smartphone, Layers, CheckCircle2, ShieldCheck, Sparkles, X, ChevronRight, ChevronLeft, ArrowRight, Settings, Check, Lock, SmartphoneNfc } from "lucide-react"
import { clearInstallPrompt, getInstallPrompt, subscribeInstallPrompt, type InstallPromptEvent } from "../../lib/pwaInstall"
import { androidBridgeRequest, isAndroidBridgeFallback, openAndroidWidget, type AndroidWidgetSize } from "../../lib/androidBridge"
import "./widgets.css"

type Batter = { name: string; runs: number; balls: number; fours: number; sixes: number; out: boolean }
type Bowler = { name: string; balls: number; runs: number; wickets: number; maidens?: number }
type LiveScore = {
  matchId: string
  innings: number
  batting: string
  bowling: string
  runs: number
  wickets: number
  balls: number
  striker: string
  nonStriker: string
  bowler: string
  partnershipRuns: number
  partnershipBalls: number
  batters: Record<string, Batter>
  bowlers: Record<string, Bowler>
  overMarks: string[]
  fall: string[]
  target: number | null
  result: string
}

type WidgetTeam = { name: string; code: string; color: string; logo?: string }
const overs = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((word) => word[0]).join("").slice(0, 3).toUpperCase() || "DPL"

function TeamLogo({ team, small = false }: { team?: WidgetTeam; small?: boolean }) {
  return <span className={`tech-team-logo ${small ? "small" : ""}`} style={{ "--team-color": team?.color || "#91e521" } as React.CSSProperties}>{team?.logo ? <img src={team.logo} alt={`${team.name} logo`} /> : <b>{team?.code || initials(team?.name || "DPL")}</b>}</span>
}

function BallStrip({ balls }: { balls: string[] }) {
  return <div className="tech-ball-strip">{balls.length ? balls.map((mark, index) => <b key={`${mark}-${index}`} className={mark === "W" ? "wicket" : mark === "4" || mark === "6" ? "boundary" : mark === "WD" || mark === "NB" ? "extra" : ""}>{mark}</b>) : <span>Waiting for first ball</span>}</div>
}

// ─── PROGRAMMATIC NATIVE APK DOWNLOAD HANDLER ───────────────────────────────
export function downloadNativeApk() {
  const link = document.createElement("a")
  link.href = "/base.apk"
  link.download = "CricVault_Native_v1.0.apk"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// ─── MOBILE-FIRST ANDROID NATIVE MODAL BOTTOM SHEET WALKTHROUGH ──────────────
function AndroidWalkthroughBottomSheet({
  isOpen,
  onClose,
  score,
  selectedSize,
  onActionTrigger,
}: {
  isOpen: boolean
  onClose: () => void
  score: LiveScore
  selectedSize: AndroidWidgetSize
  onActionTrigger: (message: string) => void
}) {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1)

  // Body Scroll Locking while Bottom Sheet is active
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("lock-body-scroll")
    } else {
      document.body.classList.remove("lock-body-scroll")
    }
    return () => {
      document.body.classList.remove("lock-body-scroll")
    }
  }, [isOpen])

  if (!isOpen) return null

  const scoreText = score.batting ? `${score.runs}/${score.wickets}` : "184/5"
  const battingCode = score.batting ? initials(score.batting) : "IND"
  const oversText = overs(score.balls || 104)

  const handleFinish = () => {
    localStorage.setItem("cricvault_onboarding_completed", "true")
    const result = openAndroidWidget(score.matchId || "live", selectedSize, "floating")
    onActionTrigger(result.message)
    onClose()
  }

  const handleNext = () => {
    if (activeStep < 4) {
      setActiveStep((prev) => (prev + 1) as any)
    } else {
      handleFinish()
    }
  }

  const handlePrev = () => {
    if (activeStep > 1) {
      setActiveStep((prev) => (prev - 1) as any)
    }
  }

  const progressPercent = activeStep * 25

  return (
    <div className="android-bottom-sheet-overlay" onClick={onClose}>
      <div className="android-bottom-sheet-container" onClick={(e) => e.stopPropagation()}>
        {/* Drag Handle Capsule */}
        <div className="bottom-sheet-drag-handle-bar">
          <div className="bottom-sheet-drag-handle" />
        </div>

        {/* Sheet Top Header */}
        <div className="sheet-header-bar">
          <div className="sheet-header-title">
            <small>STEP {activeStep} OF 4 • ANDROID FEATURE WALKTHROUGH</small>
            <h2>CricVault Native App & Widgets</h2>
          </div>
          <button className="guide-close-btn" onClick={onClose} aria-label="Close walkthrough">
            <X />
          </button>
        </div>

        {/* Linear Progress Bar */}
        <div className="sheet-progress-track">
          <div className="sheet-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        {/* SCROLLABLE INTERNAL CONTENT AREA ONLY */}
        <div className="sheet-internal-content">
          {/* STEP ILLUSTRATION SHOWCASE BOX */}
          <div className="native-illustration-box">
            {/* STEP 1 ILLUSTRATION */}
            {activeStep === 1 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ background: "rgba(148,237,40,0.15)", border: "1.5px solid #94ed28", borderRadius: "14px", padding: "12px 20px", display: "inline-flex", alignItems: "center", gap: "10px", color: "#94ed28", fontFamily: "Rajdhani", fontWeight: 800 }}>
                  <Download style={{ width: "22px", height: "22px" }} />
                  <span>CricVault_Native_v1.0.apk</span>
                </div>
                <div style={{ fontSize: "11px", color: "#aeb8bd", marginTop: "10px", fontFamily: "monospace" }}>
                  1.08 MB • Official Native APK • Verified Malware Free
                </div>
              </div>
            )}

            {/* STEP 2 ILLUSTRATION */}
            {activeStep === 2 && (
              <div style={{ width: "80%", maxWidth: "320px" }}>
                <div style={{ fontSize: "9px", color: "#7a8c94", marginBottom: "6px", fontFamily: "monospace" }}>ANDROID SYSTEM SETTINGS</div>
                <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", color: "#f4f7f8", fontFamily: "Rajdhani", fontWeight: 700 }}>Display over other apps</span>
                  <div style={{ width: "42px", height: "22px", borderRadius: "11px", background: "rgba(148,237,40,0.25)", border: "1.5px solid #94ed28", display: "flex", alignItems: "center", padding: "2px" }}>
                    <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#94ed28", marginLeft: "auto", boxShadow: "0 0 8px #94ed28" }} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 ILLUSTRATION */}
            {activeStep === 3 && (
              <div style={{ display: "flex", gap: "10px", width: "90%" }}>
                <div style={{ flex: 1, background: "rgba(16,23,32,0.9)", border: "1px dashed #94ed28", borderRadius: "10px", padding: "10px", textAlign: "center", font: "800 11px Rajdhani", color: "#94ed28" }}>
                  2×1 Widget
                </div>
                <div style={{ flex: 1, background: "rgba(16,23,32,0.9)", border: "1px dashed #94ed28", borderRadius: "10px", padding: "10px", textAlign: "center", font: "800 11px Rajdhani", color: "#94ed28" }}>
                  4×2 Widget
                </div>
                <div style={{ flex: 1, background: "rgba(16,23,32,0.9)", border: "1px dashed #94ed28", borderRadius: "10px", padding: "10px", textAlign: "center", font: "800 11px Rajdhani", color: "#94ed28" }}>
                  5×3 Widget
                </div>
              </div>
            )}

            {/* STEP 4 ILLUSTRATION */}
            {activeStep === 4 && (
              <div style={{ background: "linear-gradient(135deg, #0c1720, #050b10)", border: "1.5px solid #94ed28", borderRadius: "16px", padding: "12px 20px", boxShadow: "0 8px 24px rgba(148,237,40,0.4)" }}>
                <div style={{ fontSize: "8px", color: "#94ed28", fontWeight: 800, fontFamily: "monospace", marginBottom: "4px" }}>
                  ● REAL-TIME FLOATING SCORE HEAD
                </div>
                <div style={{ fontSize: "20px", fontWeight: 900, fontFamily: "Rajdhani", color: "#FFF" }}>
                  {battingCode} {scoreText}
                </div>
                <div style={{ fontSize: "10px", color: "#87979e", fontFamily: "monospace", marginTop: "2px" }}>
                  Over {oversText} • Real-time Sync Over All Apps
                </div>
              </div>
            )}
          </div>

          {/* STEP DETAILS TEXT */}
          {activeStep === 1 && (
            <div>
              <h3 style={{ margin: "0 0 6px", font: "900 22px Rajdhani", color: "#f4f7f8" }}>01. Download Native APK</h3>
              <p style={{ margin: "0 0 16px", color: "#92a2a9", fontSize: "13px", lineHeight: "1.5" }}>
                Download <strong>CricVault_Native_v1.0.apk</strong> (1.08 MB) directly to your Android device to activate real-time floating live score bubbles over other apps.
              </p>

              <div className="step-bullet-list">
                <div className="step-bullet-item">
                  <b>1</b>
                  <span>Click <strong>Download Native APK</strong> below to save file cleanly.</span>
                </div>
                <div className="step-bullet-item">
                  <b>2</b>
                  <span>Open Downloads on Android and select <i>Install</i>.</span>
                </div>
              </div>

              <div style={{ marginTop: "16px" }}>
                <button className="action-btn-apk" onClick={downloadNativeApk}>
                  <Download /> Download CricVault_Native_v1.0.apk (1.08 MB)
                </button>
              </div>
            </div>
          )}

          {activeStep === 2 && (
            <div>
              <h3 style={{ margin: "0 0 6px", font: "900 22px Rajdhani", color: "#f4f7f8" }}>02. Enable Overlay Permission</h3>
              <p style={{ margin: "0 0 16px", color: "#92a2a9", fontSize: "13px", lineHeight: "1.5" }}>
                Grant system overlay permission so the live score bubble head can hover continuously above YouTube, WhatsApp, games, and other apps.
              </p>

              <div className="step-bullet-list">
                <div className="step-bullet-item">
                  <b>1</b>
                  <span>Go to <strong>Android Settings → Apps → CricVault</strong>.</span>
                </div>
                <div className="step-bullet-item">
                  <b>2</b>
                  <span>Tap <strong>Display over other apps</strong>.</span>
                </div>
                <div className="step-bullet-item">
                  <b>3</b>
                  <span>Switch toggle to <strong>ALLOW</strong>.</span>
                </div>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div>
              <h3 style={{ margin: "0 0 6px", font: "900 22px Rajdhani", color: "#f4f7f8" }}>03. Pin Widget to Android Home</h3>
              <p style={{ margin: "0 0 16px", color: "#92a2a9", fontSize: "13px", lineHeight: "1.5" }}>
                Pin live match widgets directly onto your main Android desktop home screen in 3 custom responsive sizes (2×1, 4×2, or 5×3).
              </p>

              <div className="step-bullet-list">
                <div className="step-bullet-item">
                  <b>1</b>
                  <span>Touch and hold an empty space on your Android desktop screen.</span>
                </div>
                <div className="step-bullet-item">
                  <b>2</b>
                  <span>Select <strong>Widgets</strong> → scroll to <strong>CricVault</strong>.</span>
                </div>
                <div className="step-bullet-item">
                  <b>3</b>
                  <span>Drag 2x1, 4x2, or 5x3 widget onto your home screen.</span>
                </div>
              </div>
            </div>
          )}

          {activeStep === 4 && (
            <div>
              <h3 style={{ margin: "0 0 6px", font: "900 22px Rajdhani", color: "#f4f7f8" }}>04. Launch Floating Live Score</h3>
              <p style={{ margin: "0 0 16px", color: "#92a2a9", fontSize: "13px", lineHeight: "1.5" }}>
                Enjoy uninterrupted live score tracking hovering on top of your screen while playing games or using any other app!
              </p>

              <div className="step-bullet-list">
                <div className="step-bullet-item">
                  <b>⚡</b>
                  <span>Tap <strong>Launch Floating Score Head</strong> to launch instantly.</span>
                </div>
                <div className="step-bullet-item">
                  <b>🔄</b>
                  <span>Updates automatically every single ball in real-time!</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FIXED BOTTOM NAVIGATION BAR */}
        <div className="fixed-sheet-footer">
          <button className="btn-nav-prev" onClick={handlePrev} disabled={activeStep === 1}>
            <ChevronLeft style={{ width: "14px" }} /> Back
          </button>

          {/* Progress Dots */}
          <div className="step-dots-container">
            <div className={`step-dot-pill ${activeStep === 1 ? "active" : ""}`} />
            <div className={`step-dot-pill ${activeStep === 2 ? "active" : ""}`} />
            <div className={`step-dot-pill ${activeStep === 3 ? "active" : ""}`} />
            <div className={`step-dot-pill ${activeStep === 4 ? "active" : ""}`} />
          </div>

          <button className="btn-nav-next" onClick={handleNext}>
            {activeStep === 4 ? "Finish / Got It 🚀" : "Next Step →"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ANDROID WIDGET ACTIONS COMPONENT ───────────────────────────────────────
function AndroidWidgetActions({
  matchId,
  size,
  onMessage,
  onOpenGuide,
}: {
  matchId: string
  size: AndroidWidgetSize
  onMessage: (message: string) => void
  onOpenGuide: (size: AndroidWidgetSize) => void
}) {
  const open = (action: "floating" | "pin") => {
    const result = openAndroidWidget(matchId || "live", size, action)
    onMessage(result.message)
    onOpenGuide(size)
  }

  return (
    <div className="android-widget-actions" aria-label={`${size} Android widget actions`}>
      <button onClick={() => open("floating")}><Move /> Float Live Score</button>
      <button onClick={() => open("pin")}><Pin /> Add to Home Screen</button>
    </div>
  )
}

// ─── MAIN WIDGETS SCREEN ───────────────────────────────────────────────────
export default function WidgetsScreen({ score, teams, matchOvers }: { score: LiveScore; teams: WidgetTeam[]; matchOvers: number }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(() => getInstallPrompt())
  const [installNote, setInstallNote] = useState("")

  // Floating Visual Walkthrough Bottom Sheet State
  const [guideOpen, setGuideOpen] = useState(false)
  const [selectedGuideSize, setSelectedGuideSize] = useState<AndroidWidgetSize>("standard")

  // First time visitor detection using localStorage
  useEffect(() => {
    const seen = localStorage.getItem("cricvault_onboarding_completed")
    if (seen !== "true") {
      setGuideOpen(true)
    }
  }, [])

  const battingTeam = teams.find((team) => team.name === score.batting)
  const bowlingTeam = teams.find((team) => team.name === score.bowling)
  const striker = score.batters?.[score.striker]
  const nonStriker = score.batters?.[score.nonStriker]
  const bowler = score.bowlers?.[score.bowler]
  const isLive = Boolean(score.batting && score.bowling && !score.result)
  const recentBalls = useMemo(() => score.overMarks?.slice(-6) || [], [score.overMarks])
  const currentOverRuns = useMemo(() => recentBalls.reduce((sum, mark) => sum + (/^[1-6]$/.test(mark) ? Number(mark) : 0), 0), [recentBalls])
  const need = score.target ? Math.max(0, score.target - score.runs) : null
  const ballsRemaining = Math.max(0, matchOvers * 6 - score.balls)
  const runRate = score.balls ? (score.runs * 6 / score.balls).toFixed(2) : "0.00"
  const requiredRate = need !== null && ballsRemaining ? (need * 6 / ballsRemaining).toFixed(2) : "—"
  const lastWicket = score.fall?.at(-1) || "No wicket recorded"
  const statusLabel = score.result ? "FINAL" : isLive ? "LIVE" : "READY"
  const bridgeRequest = androidBridgeRequest()

  useEffect(() => subscribeInstallPrompt(setInstallPrompt), [])

  const install = async () => {
    if (!installPrompt) {
      downloadNativeApk()
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallNote(choice.outcome === "accepted" ? "CricVault was added to your home screen." : "Downloading native APK...")
    clearInstallPrompt()
  }

  const handleTriggerGuide = (size: AndroidWidgetSize = "standard") => {
    setSelectedGuideSize(size)
    setGuideOpen(true)
  }

  const scoreText = score.batting ? `${score.runs}/${score.wickets}` : "--/--"
  const battingName = score.batting || "Batting team"
  const bowlingName = score.bowling || "Bowling team"

  return (
    <main className="widgets-page tech-widgets-page">
      {/* FLOATING QUICK TRIGGER HUD PILL */}
      <button className="floating-quick-trigger" onClick={() => handleTriggerGuide("standard")} title="Open Floating Score Visual Guide">
        <Sparkles />
        <span>⚡ Float Live Score & APK Guide</span>
      </button>

      {isAndroidBridgeFallback() && (
        <section className="android-companion-fallback" role="status">
          <Smartphone />
          <div>
            <strong>CricVault Android companion required</strong>
            <p>
              {bridgeRequest ? `Your ${bridgeRequest.size} ${bridgeRequest.mode === "pin" ? "home-screen" : "floating"} score request for match ${bridgeRequest.matchId} is ready.` : "This Android request is ready."}{" "}
              Download and install <strong>CricVault_Native_v1.0.apk</strong> to launch floating heads over other apps.
            </p>
            <div style={{ marginTop: "10px" }}>
              <button className="action-btn-apk" onClick={downloadNativeApk} style={{ display: "inline-flex", padding: "8px 14px", fontSize: "11px" }}>
                <Download style={{ width: "14px", height: "14px" }} /> Download CricVault_Native_v1.0.apk (1.08 MB)
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Hero Header */}
      <section className="tech-widget-hero">
        <div className="tech-brand-lockup">
          <span>CV</span>
          <div>
            <strong>CRIC<span>VAULT</span></strong>
            <small>LIVE CRICKET WIDGETS</small>
          </div>
        </div>

        <div className="tech-hero-copy">
          <span>ADVANCED ANDROID LIVE CRICKET SCORE WIDGET SYSTEM</span>
          <h1>Match intelligence,<br />wherever you are.</h1>
          <p>Three precise widget sizes. One real-time DPL scoring source. Float above other apps or pin to the Android home screen with <strong>base.apk</strong>.</p>

          {/* FUTURISTIC HERO APK COMMAND HUB (FIXING THE DULL UI IN IMAGE 1) */}
          <div className="hero-apk-command-hub">
            <div className="apk-hub-meta-bar">
              <span className="apk-badge-tag">
                <ShieldCheck style={{ width: "13px" }} /> ANDROID NATIVE APP • v1.0.0 PRO
              </span>
              <div className="apk-stats-pill-group">
                <span>📦 1.08 MB</span>
                <span>⚡ Floating Score</span>
                <span>📌 2×1, 4×2, 5×3 Widgets</span>
              </div>
            </div>

            <div className="apk-hub-buttons-row">
              <button className="btn-apk-hero-primary" onClick={downloadNativeApk}>
                <Download style={{ width: "18px", height: "18px" }} /> Download Native APK (CricVault_Native_v1.0.apk · 1.08 MB)
              </button>

              <button className="btn-walkthrough-hero-secondary" onClick={() => handleTriggerGuide("standard")}>
                <Sparkles style={{ width: "16px", color: "#91e521" }} /> ✨ Open Android Walkthrough
              </button>
            </div>
          </div>
        </div>

        <div className="android-mark">
          <Smartphone />
          <span>ANDROID<br />READY</span>
        </div>
      </section>

      {/* Compact Widget Stage (2x1) */}
      <section className="tech-widget-stage">
        <div className="widget-size-heading"><span>COMPACT LIVE MATCH WIDGET</span><b>2 × 1</b></div>
        <article className="compact-live-widget" aria-label={`${battingName} ${scoreText} after ${overs(score.balls)} overs against ${bowlingName}`}>
          <div className="compact-widget-topline">
            <div className="compact-widget-brand"><span>CV</span><b>CRICVAULT</b></div>
            <small>T20 · {Math.floor(score.balls / 6) + 1}TH OV</small>
          </div>
          <div className="compact-widget-scoreline">
            <TeamLogo team={battingTeam} small />
            <div><strong>{scoreText}</strong><span>{overs(score.balls)} OVERS <i /> <b className={isLive ? "live" : ""}>{statusLabel}</b></span></div>
            <TeamLogo team={bowlingTeam} small />
          </div>
          <div className="compact-widget-requirement"><span>{score.target ? "CHASE" : `INNINGS ${score.innings || 1}`}</span>{need !== null ? <>Need <strong>{need}</strong> runs from <strong>{ballsRemaining}</strong> balls</> : <>Live score updates automatically</>}</div>
        </article>
        <AndroidWidgetActions matchId={score.matchId} size="compact" onMessage={setInstallNote} onOpenGuide={handleTriggerGuide} />
      </section>

      {/* Standard Widget Stage (4x2) */}
      <section className="tech-widget-stage standard-stage">
        <div className="widget-size-heading"><span>STANDARD LIVE MATCH WIDGET</span><b>4 × 2</b></div>
        <article className="standard-live-widget" aria-label={`${battingName} versus ${bowlingName}, ${scoreText} after ${overs(score.balls)} overs`}>
          <div className="stdw-sheen" />
          <header className="stdw-header"><div className="stdw-brand"><i /> CRICVAULT</div><div>T20 · {score.matchId ? `MATCH ${score.matchId.slice(-4).toUpperCase()}` : `INNINGS ${score.innings || 1}`}</div></header>
          <section className="stdw-score-zone">
            <div className="stdw-team"><TeamLogo team={battingTeam} small /><div><strong>{battingName}</strong><span>BATTING</span></div></div>
            <div className="stdw-score"><strong>{scoreText}</strong><span>{overs(score.balls)} <small>OVERS</small></span><b className={isLive ? "live" : ""}><i /> {statusLabel}</b></div>
            <div className="stdw-team away"><div><strong>{bowlingName}</strong><span>BOWLING</span></div><TeamLogo team={bowlingTeam} small /></div>
          </section>
          <section className="stdw-context">
            <div><span>{score.target ? "TARGET" : "INNINGS"}</span><strong>{score.target || score.innings || 1}</strong></div>
            <div className="stdw-required"><span>{score.target ? "NEED" : "SYNC"}</span><strong>{need !== null ? `${need} runs from ${ballsRemaining} balls` : "Live match data ready"}</strong></div>
            <div className="right"><span>RRR</span><strong>{requiredRate}</strong></div>
          </section>
          <section className="stdw-players">
            <div className="active"><i /><span>{score.striker || "STRIKER"}</span><strong>{striker ? `${striker.runs}*` : "—"} <small>({striker?.balls || 0})</small></strong></div>
            <div><span>{score.nonStriker || "NON-STRIKER"}</span><strong>{nonStriker?.runs ?? "—"} <small>({nonStriker?.balls || 0})</small></strong></div>
            <div><span>{score.bowler || "BOWLER"}</span><strong>{bowler ? `${bowler.wickets}/${bowler.runs}` : "—"} <small>({bowler ? overs(bowler.balls) : "0.0"})</small></strong></div>
          </section>
          <footer className="stdw-balls"><div><span>LAST 6</span><small>THIS OVER</small></div><BallStrip balls={recentBalls} /><strong>{currentOverRuns} <span>RUNS</span></strong></footer>
        </article>
        <AndroidWidgetActions matchId={score.matchId} size="standard" onMessage={setInstallNote} onOpenGuide={handleTriggerGuide} />
      </section>

      {/* Expanded Widget Stage (5x3) */}
      <section className="tech-widget-stage expanded-stage">
        <div className="widget-size-heading"><span>EXPANDED LIVE MATCH WIDGET</span><b>5 × 3</b></div>
        <article className="expanded-live-widget" aria-label={`Expanded live score for ${battingName} versus ${bowlingName}`}>
          <header className="expw-header"><div className="expw-brand"><i><b /><b /><b /></i><strong>CRIC<span>VAULT</span></strong></div><div className={isLive ? "live" : ""}><i /> {statusLabel} MATCH <RefreshCw /></div></header>
          <section className="expw-score-area">
            <div className="expw-team"><TeamLogo team={battingTeam} small /><strong>{battingName}</strong></div>
            <div className="expw-score"><strong>{scoreText}</strong><span><i /> {overs(score.balls)} <small>OVERS</small></span></div>
            <div className="expw-team right"><TeamLogo team={bowlingTeam} small /><strong>{bowlingName}</strong></div>
          </section>
          <section className="expw-context">
            <div><span>{score.target ? "TARGET" : "INNINGS"}</span><strong>{score.target || score.innings || 1}</strong></div>
            <div className="needed"><span>{score.target ? "NEED" : "STATUS"}</span><strong>{need !== null ? need : score.result || "LIVE"} <small>{need !== null ? "RUNS" : ""}</small></strong><em>{need !== null ? `FROM ${ballsRemaining} BALLS` : "REAL-TIME SYNC"}</em></div>
            <div><span>RRR</span><strong>{requiredRate}</strong></div>
            <div><span>CRR</span><strong>{runRate}</strong></div>
          </section>
          <section className="expw-players">
            <article className="active"><header><span>{score.striker || "STRIKER"} <i>★</i></span><strong>{striker?.runs ?? "—"}<small>*</small></strong></header><p>{striker?.balls || 0} balls <b>•</b> {striker?.fours || 0} × 4 <b>•</b> {striker?.sixes || 0} × 6 <b>•</b> SR {striker?.balls ? (striker.runs * 100 / striker.balls).toFixed(1) : "0.0"}</p></article>
            <article><header><span>{score.nonStriker || "NON-STRIKER"}</span><strong>{nonStriker?.runs ?? "—"}</strong></header><p>{nonStriker?.balls || 0} balls <b>•</b> {nonStriker?.fours || 0} × 4 <b>•</b> {nonStriker?.sixes || 0} × 6 <b>•</b> SR {nonStriker?.balls ? (nonStriker.runs * 100 / nonStriker.balls).toFixed(1) : "0.0"}</p></article>
            <article className="bowler"><header><span>{score.bowler || "BOWLER"} <em>BOWLING</em></span><strong>{bowler ? `${bowler.wickets}/${bowler.runs}` : "—"}</strong></header><p>{bowler ? overs(bowler.balls) : "0.0"} overs <b>•</b> Econ {bowler?.balls ? (bowler.runs * 6 / bowler.balls).toFixed(2) : "0.00"} <b>•</b> {bowler?.maidens || 0} maidens</p></article>
          </section>
          <footer className="expw-detail-strip">
            <div className="partnership"><span>PARTNERSHIP</span><strong>{score.partnershipRuns || 0} <small>({score.partnershipBalls || 0})</small></strong></div>
            <div className="last-wicket"><span>LAST WICKET</span><strong>{lastWicket}</strong></div>
            <div className="last-balls"><span>LAST 6</span><BallStrip balls={recentBalls} /></div>
            <div className="this-over"><span>THIS OVER</span><strong>{currentOverRuns} <small>RUNS</small></strong></div>
          </footer>
        </article>
        <AndroidWidgetActions matchId={score.matchId} size="expanded" onMessage={setInstallNote} onOpenGuide={handleTriggerGuide} />
      </section>

      {/* Feature Rail */}
      <section className="widget-feature-rail">
        <div><MousePointerClick /><span><b>TAP ACTIONS</b><small>Scores · Players · Team</small></span></div>
        <div><RefreshCw /><span><b>LIVE SYNC</b><small>Updates every ball</small></span></div>
        <div><Maximize2 /><span><b>THREE SIZES</b><small>2×1 · 4×2 · 5×3</small></span></div>
        <div><Moon /><span><b>DARK MODE</b><small>Optimized for Android</small></span></div>
        <button onClick={downloadNativeApk}><Download /> Download base.apk</button>
      </section>

      {installNote && <p className="widget-install-note">{installNote}</p>}

      {/* Android Installation Guide Banner */}
      <section className="android-install-guide">
        <div>
          <small>ANDROID INSTALLATION & BASE.APK</small>
          <h2>Keep live cricket floating over every app.</h2>
          <p>Download CricVault_Native_v1.0.apk to unlock full floating live score bubble head mode and native Android home screen widgets for CricVault.</p>
          <div style={{ marginTop: "14px" }}>
            <button className="action-btn-apk" onClick={downloadNativeApk} style={{ display: "inline-flex" }}>
              <Download /> Download CricVault_Native_v1.0.apk (1.08 MB)
            </button>
          </div>
        </div>
        <ol>
          <li><b>01</b><span>Download and install <strong>CricVault_Native_v1.0.apk</strong> on your Android phone.</span></li>
          <li><b>02</b><span>Allow <i>"Display over other apps"</i> overlay permission.</span></li>
          <li><b>03</b><span>Tap <strong>Float Live Score</strong> to launch floating score bubble!</span></li>
        </ol>
      </section>

      {/* MOBILE-FIRST ANDROID NATIVE MODAL BOTTOM SHEET WALKTHROUGH */}
      <AndroidWalkthroughBottomSheet
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        score={score}
        selectedSize={selectedGuideSize}
        onActionTrigger={setInstallNote}
      />
    </main>
  )
}
