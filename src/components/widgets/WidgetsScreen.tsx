import { useEffect, useMemo, useState } from "react"
import { Download, Maximize2, Moon, MousePointerClick, Move, Pin, RefreshCw, Smartphone, Layers, CheckCircle2, ShieldCheck, Sparkles, X, ChevronRight } from "lucide-react"
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

// ─── CREATIVE PRO FLOATING VISUAL GUIDE POPUP MODAL ─────────────────────────
function FloatingWidgetGuideModal({
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

  if (!isOpen) return null

  const scoreText = score.batting ? `${score.runs}/${score.wickets}` : "184/5"
  const battingCode = score.batting ? initials(score.batting) : "IND"
  const oversText = overs(score.balls || 104)

  const handleFloatLaunch = () => {
    const result = openAndroidWidget(score.matchId || "live", selectedSize, "floating")
    onActionTrigger(result.message)
  }

  const handlePinLaunch = () => {
    const result = openAndroidWidget(score.matchId || "live", selectedSize, "pin")
    onActionTrigger(result.message)
  }

  return (
    <div className="floating-guide-overlay" onClick={onClose}>
      <div className="floating-guide-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="guide-modal-header">
          <div>
            <small>CRICVAULT ANDROID COMPANION • NATIVE APK & FLOATING WIDGET GUIDE</small>
            <h2>Floating Score & Home Screen Widget Guide</h2>
          </div>
          <button className="guide-close-btn" onClick={onClose} aria-label="Close guide">
            <X />
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="guide-modal-body">
          {/* Animated Smartphone Phone Screen Mockup */}
          <div className="phone-mockup-frame">
            <div className="phone-notch" />

            <div className="phone-screen-wallpaper">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#87979e', fontFamily: 'monospace' }}>
                <span>16:20</span>
                <span>5G ⚡ 98%</span>
              </div>

              {/* Grid of Dummy Apps */}
              <div className="app-icons-grid">
                <div className="dummy-app-icon cricvault-app-icon">
                  CV
                  <span>CricVault</span>
                </div>
                <div className="dummy-app-icon">💬<span>Chat</span></div>
                <div className="dummy-app-icon">▶️<span>Video</span></div>
                <div className="dummy-app-icon">🌐<span>Browser</span></div>
                <div className="dummy-app-icon">📷<span>Camera</span></div>
                <div className="dummy-app-icon">🎵<span>Music</span></div>
                <div className="dummy-app-icon">🎮<span>Games</span></div>
                <div className="dummy-app-icon">📁<span>Files</span></div>
              </div>

              {/* FLOATING LIVE SCORE BUBBLE HEAD OVER APPS */}
              <div className="floating-bubble-head">
                <div className="bubble-head-top">
                  <span>● LIVE SCORE HEAD</span>
                  <span>T20 · {oversText} OV</span>
                </div>
                <div className="bubble-head-score">
                  <div>
                    <strong>{battingCode} {scoreText}</strong>
                    <small style={{ display: 'block', marginTop: '2px' }}>Live Updates Above Apps</small>
                  </div>
                  <span style={{ fontSize: '18px' }}>🏏</span>
                </div>
              </div>

              <div style={{ textAlign: 'center', fontSize: '9px', color: '#87979e', fontFamily: 'monospace' }}>
                Swipe up to go Home
              </div>
            </div>
          </div>

          {/* Interactive Steps Right Pane */}
          <div>
            {/* Step Navigation Tabs */}
            <div className="guide-tabs-nav">
              <button className={`guide-tab-btn ${activeStep === 1 ? "active" : ""}`} onClick={() => setActiveStep(1)}>
                01. Install APK
              </button>
              <button className={`guide-tab-btn ${activeStep === 2 ? "active" : ""}`} onClick={() => setActiveStep(2)}>
                02. Permission
              </button>
              <button className={`guide-tab-btn ${activeStep === 3 ? "active" : ""}`} onClick={() => setActiveStep(3)}>
                03. Pin Widget
              </button>
              <button className={`guide-tab-btn ${activeStep === 4 ? "active" : ""}`} onClick={() => setActiveStep(4)}>
                04. Float Head
              </button>
            </div>

            {/* Step Cards */}
            {activeStep === 1 && (
              <div className="step-content-card">
                <h3>Step 1: Download & Install base.apk</h3>
                <p>Download the official CricVault Android native package (base.apk - 1.08 MB) to enable floating score bubbles above YouTube, games, and other apps.</p>
                <div className="step-bullet-list">
                  <div className="step-bullet-item">
                    <b>✓</b>
                    <span>Click the <strong>Download base.apk</strong> button below to save the APK to your device.</span>
                  </div>
                  <div className="step-bullet-item">
                    <b>✓</b>
                    <span>Open Downloads on Android and allow <i>"Install from Unknown Sources"</i> when prompted.</span>
                  </div>
                  <div className="step-bullet-item">
                    <b>✓</b>
                    <span>Launch CricVault Native to activate real-time widget synchronization.</span>
                  </div>
                </div>
              </div>
            )}

            {activeStep === 2 && (
              <div className="step-content-card">
                <h3>Step 2: Enable "Draw Over Other Apps"</h3>
                <p>To let the live score head float smoothly over other apps, grant the Overlay Permission in Android system settings.</p>
                <div className="step-bullet-list">
                  <div className="step-bullet-item">
                    <b>1</b>
                    <span>Go to <strong>Android Settings → Apps → CricVault</strong>.</span>
                  </div>
                  <div className="step-bullet-item">
                    <b>2</b>
                    <span>Select <strong>Display over other apps</strong> (or <i>Draw over other apps</i>).</span>
                  </div>
                  <div className="step-bullet-item">
                    <b>3</b>
                    <span>Toggle switch to <strong>ALLOW</strong>.</span>
                  </div>
                </div>
              </div>
            )}

            {activeStep === 3 && (
              <div className="step-content-card">
                <h3>Step 3: Add Widget to Android Home Screen</h3>
                <p>Pin the 2x1 Compact, 4x2 Standard, or 5x3 Expanded widget to your main screen for instant score viewing.</p>
                <div className="step-bullet-list">
                  <div className="step-bullet-item">
                    <b>1</b>
                    <span>Touch and hold any empty area on your Android home screen.</span>
                  </div>
                  <div className="step-bullet-item">
                    <b>2</b>
                    <span>Tap <strong>Widgets</strong> and scroll to <strong>CricVault</strong>.</span>
                  </div>
                  <div className="step-bullet-item">
                    <b>3</b>
                    <span>Drag your preferred size (2x1, 4x2, or 5x3) onto your home screen!</span>
                  </div>
                </div>
              </div>
            )}

            {activeStep === 4 && (
              <div className="step-content-card">
                <h3>Step 4: Launch Floating Score Mode</h3>
                <p>Enjoy continuous live ball-by-ball score tracking floating on top of your screen while using any app or playing games.</p>
                <div className="step-bullet-list">
                  <div className="step-bullet-item">
                    <b>⚡</b>
                    <span>Tap <strong>Float Live Score</strong> below to trigger the floating head immediately.</span>
                  </div>
                  <div className="step-bullet-item">
                    <b>🔄</b>
                    <span>The score updates automatically in real-time on every ball.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions Footer Bar */}
        <div className="guide-modal-actions">
          <a href="/base.apk" download="base.apk" className="action-btn-apk">
            <Download /> Download Native APK (base.apk · 1.08 MB)
          </a>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="action-btn-secondary" onClick={handleFloatLaunch}>
              <Move style={{ width: '14px' }} /> Float Live Score
            </button>
            <button className="action-btn-secondary" onClick={handlePinLaunch}>
              <Pin style={{ width: '14px' }} /> Pin to Home Screen
            </button>
          </div>
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

  // Floating Visual Guide State
  const [guideOpen, setGuideOpen] = useState(false)
  const [selectedGuideSize, setSelectedGuideSize] = useState<AndroidWidgetSize>("standard")

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
      setInstallNote("On Android, open the browser menu and choose Add to Home screen, or download base.apk below.")
      setGuideOpen(true)
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallNote(choice.outcome === "accepted" ? "CricVault was added to your home screen." : "You can install base.apk directly below.")
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
              Download and install <strong>base.apk</strong> to launch floating heads over other apps.
            </p>
            <div style={{ marginTop: '10px' }}>
              <a href="/base.apk" download="base.apk" className="action-btn-apk" style={{ display: 'inline-flex', padding: '8px 14px', fontSize: '11px' }}>
                <Download style={{ width: '14px', height: '14px' }} /> Download base.apk (1.08 MB)
              </a>
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

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <a href="/base.apk" download="base.apk" className="action-btn-apk" style={{ textDecoration: 'none' }}>
              <Download /> Download Native APK (base.apk)
            </a>
            <button className="action-btn-secondary" onClick={() => handleTriggerGuide("standard")}>
              <Sparkles style={{ width: '14px', color: '#91e521' }} /> Visual Guide & Instructions
            </button>
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
        <button onClick={() => void install()}><Download /> Download base.apk</button>
      </section>

      {installNote && <p className="widget-install-note">{installNote}</p>}

      {/* Android Installation Guide Banner */}
      <section className="android-install-guide">
        <div>
          <small>ANDROID INSTALLATION & BASE.APK</small>
          <h2>Keep live cricket floating over every app.</h2>
          <p>Download base.apk to unlock full floating live score bubble head mode and native Android home screen widgets for CricVault.</p>
          <div style={{ marginTop: '14px' }}>
            <a href="/base.apk" download="base.apk" className="action-btn-apk" style={{ display: 'inline-flex' }}>
              <Download /> Download base.apk (1.08 MB)
            </a>
          </div>
        </div>
        <ol>
          <li><b>01</b><span>Download and install <strong>base.apk</strong> on your Android phone.</span></li>
          <li><b>02</b><span>Allow <i>"Display over other apps"</i> overlay permission.</span></li>
          <li><b>03</b><span>Tap <strong>Float Live Score</strong> to launch floating score bubble!</span></li>
        </ol>
      </section>

      {/* FLOATING VISUAL GUIDE POPUP MODAL */}
      <FloatingWidgetGuideModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        score={score}
        selectedSize={selectedGuideSize}
        onActionTrigger={setInstallNote}
      />
    </main>
  )
}
