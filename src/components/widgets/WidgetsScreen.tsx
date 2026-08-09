import { useEffect, useMemo, useState } from "react"
import { Bell, Download, Maximize2, Moon, MousePointerClick, RefreshCw, Smartphone } from "lucide-react"
import "./widgets.css"

type Batter = { name: string; runs: number; balls: number; fours: number; sixes: number; out: boolean }
type Bowler = { name: string; balls: number; runs: number; wickets: number; maidens?: number }
type LiveScore = {
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
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

const overs = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((word) => word[0]).join("").slice(0, 3).toUpperCase() || "DPL"

function TeamLogo({ team, small = false }: { team?: WidgetTeam; small?: boolean }) {
  return <span className={`tech-team-logo ${small ? "small" : ""}`} style={{ "--team-color": team?.color || "#91e521" } as React.CSSProperties}>{team?.logo ? <img src={team.logo} alt={`${team.name} logo`} /> : <b>{team?.code || initials(team?.name || "DPL")}</b>}</span>
}

function BallStrip({ balls }: { balls: string[] }) {
  return <div className="tech-ball-strip">{balls.length ? balls.map((mark, index) => <b key={`${mark}-${index}`} className={mark === "W" ? "wicket" : mark === "4" || mark === "6" ? "boundary" : mark === "WD" || mark === "NB" ? "extra" : ""}>{mark}</b>) : <span>Waiting for first ball</span>}</div>
}

function BatterCell({ label, player, active }: { label: string; player?: Batter; active?: boolean }) {
  return <div className="tech-player-cell"><small>{label}</small><strong>{player?.name || "Not selected"}{active && <i />}</strong><p>{player ? <><b>{player.runs}{active ? "*" : ""}</b> ({player.balls})</> : "—"}</p><span>{player ? `4s: ${player.fours}  |  6s: ${player.sixes}  |  SR: ${player.balls ? (player.runs * 100 / player.balls).toFixed(2) : "0.00"}` : "Waiting for match setup"}</span></div>
}

export default function WidgetsScreen({ score, teams }: { score: LiveScore; teams: WidgetTeam[] }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [installNote, setInstallNote] = useState("")
  const battingTeam = teams.find((team) => team.name === score.batting)
  const bowlingTeam = teams.find((team) => team.name === score.bowling)
  const striker = score.batters?.[score.striker]
  const nonStriker = score.batters?.[score.nonStriker]
  const bowler = score.bowlers?.[score.bowler]
  const isLive = Boolean(score.batting && score.bowling && !score.result)
  const recentBalls = useMemo(() => score.overMarks?.slice(-6) || [], [score.overMarks])
  const currentOverRuns = useMemo(() => recentBalls.reduce((sum, mark) => sum + (/^[1-6]$/.test(mark) ? Number(mark) : 0), 0), [recentBalls])
  const need = score.target ? Math.max(0, score.target - score.runs) : null
  const runRate = score.balls ? (score.runs * 6 / score.balls).toFixed(2) : "0.00"
  const lastWicket = score.fall?.at(-1) || "No wicket recorded"
  const statusLabel = score.result ? "FINAL" : isLive ? "LIVE" : "READY"

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", capturePrompt)
    return () => window.removeEventListener("beforeinstallprompt", capturePrompt)
  }, [])

  const install = async () => {
    if (!installPrompt) {
      setInstallNote("On Android, open the browser menu and choose Add to Home screen.")
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallNote(choice.outcome === "accepted" ? "CricVault was added to your home screen." : "You can install it later from your browser menu.")
    setInstallPrompt(null)
  }

  const scoreText = score.batting ? `${score.runs}/${score.wickets}` : "--/--"
  const battingName = score.batting || "Batting team"
  const bowlingName = score.bowling || "Bowling team"

  return (
    <main className="widgets-page tech-widgets-page">
      <section className="tech-widget-hero">
        <div className="tech-brand-lockup"><span>CV</span><div><strong>CRIC<span>VAULT</span></strong><small>LIVE CRICKET WIDGETS</small></div></div>
        <div className="tech-hero-copy"><span>ADVANCED ANDROID LIVE CRICKET SCORE WIDGET SYSTEM</span><h1>Match intelligence,<br />built for your home screen.</h1><p>Two precise widget sizes. One real-time DPL 6 scoring source. No clutter, no duplicate match entry.</p></div>
        <div className="android-mark"><Smartphone /><span>ANDROID<br />READY</span></div>
      </section>

      <section className="tech-widget-stage">
        <div className="widget-size-heading"><span>STANDARD LIVE MATCH WIDGET</span><b>4 × 2</b></div>
        <article className="technology-widget standard-technology-widget">
          <div className="widget-scanline" />
          <header className="tech-score-head">
            <div className="tech-team left"><TeamLogo team={battingTeam} /><strong>{battingName}</strong></div>
            <div className="tech-main-score"><strong>{scoreText}</strong><span>{overs(score.balls)} OVERS</span><small className={isLive ? "live" : ""}><i /> {statusLabel}</small></div>
            <div className="tech-versus">VS</div>
            <div className="tech-team right"><strong>{bowlingName}</strong><TeamLogo team={bowlingTeam} /></div>
          </header>
          <section className="standard-data-rail">
            <div><small>{score.target ? `TARGET ${score.target}` : `INNINGS ${score.innings || 1}`}</small><strong>{need !== null ? `Need ${need} runs` : "Match data synchronized"}</strong><span>CRR {runRate}</span></div>
            <div className="bowler-cell"><small>CURRENT BOWLER</small><strong>{score.bowler || "Not selected"}</strong><span>{bowler ? `${bowler.wickets}/${bowler.runs}  (${overs(bowler.balls)})` : "0/0 (0.0)"}</span></div>
          </section>
          <section className="standard-players"><BatterCell label="STRIKER" player={striker} active /><BatterCell label="NON-STRIKER" player={nonStriker} /></section>
          <footer className="tech-widget-footer"><span>LAST 6 BALLS</span><BallStrip balls={recentBalls} /><div><small>THIS OVER</small><strong>{currentOverRuns} RUNS</strong></div></footer>
        </article>
      </section>

      <section className="tech-widget-stage expanded-stage">
        <div className="widget-size-heading"><span>EXPANDED LIVE MATCH WIDGET</span><b>5 × 3</b></div>
        <article className="technology-widget expanded-technology-widget">
          <div className="widget-scanline" />
          <div className="expanded-topbar"><div><span className="mini-shield">CV</span><strong>CRICVAULT</strong><i /> <b>{statusLabel} MATCH</b></div><div><Bell /><RefreshCw /></div></div>
          <header className="tech-score-head expanded-score-head">
            <div className="tech-team left"><TeamLogo team={battingTeam} /><strong>{battingName}</strong></div>
            <div className="tech-main-score"><strong>{scoreText}</strong><span>{overs(score.balls)} OVERS</span><small className={isLive ? "live" : ""}><i /> {statusLabel}</small></div>
            <div className="tech-versus">VS</div>
            <div className="tech-team right"><strong>{bowlingName}</strong><TeamLogo team={bowlingTeam} /></div>
          </header>
          <section className="expanded-data-grid">
            <div className="match-equation"><small>{score.target ? `TARGET ${score.target}` : `INNINGS ${score.innings || 1}`}</small><strong>{score.result || (need !== null ? `Need ${need} runs` : "Live scoring ready")}</strong><span>CRR {runRate}</span></div>
            <BatterCell label="STRIKER" player={striker} active />
            <BatterCell label="NON-STRIKER" player={nonStriker} />
            <div className="bowler-cell"><small>CURRENT BOWLER</small><strong>{score.bowler || "Not selected"}</strong><p>{bowler ? `${bowler.wickets}/${bowler.runs} (${overs(bowler.balls)})` : "0/0 (0.0)"}</p><span>{bowler ? `${bowler.maidens || 0} maidens` : "Waiting for setup"}</span></div>
          </section>
          <footer className="expanded-footer">
            <div><small>PARTNERSHIP</small><strong>{score.partnershipRuns || 0} <span>({score.partnershipBalls || 0})</span></strong></div>
            <div><small>LAST WICKET</small><strong>{lastWicket}</strong></div>
            <div className="expanded-balls"><small>LAST 6 BALLS</small><BallStrip balls={recentBalls} /></div>
            <div><small>THIS OVER</small><strong className="lime">{currentOverRuns} RUNS</strong></div>
          </footer>
        </article>
      </section>

      <section className="widget-feature-rail">
        <div><MousePointerClick /><span><b>TAP ACTIONS</b><small>Scores · Players · Team</small></span></div>
        <div><RefreshCw /><span><b>LIVE SYNC</b><small>Updates every ball</small></span></div>
        <div><Maximize2 /><span><b>TWO SIZES</b><small>4×2 · 5×3 responsive</small></span></div>
        <div><Moon /><span><b>DARK MODE</b><small>Optimized for Android</small></span></div>
        <button onClick={() => void install()}><Download /> Add to Android</button>
      </section>
      {installNote && <p className="widget-install-note">{installNote}</p>}
    </main>
  )
}
