import { useEffect, useMemo, useState } from "react"
import { Bell, Download, Maximize2, Moon, MousePointerClick, RefreshCw, Smartphone } from "lucide-react"
import { clearInstallPrompt, getInstallPrompt, subscribeInstallPrompt, type InstallPromptEvent } from "../../lib/pwaInstall"
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

function BatterCell({ label, player, active }: { label: string; player?: Batter; active?: boolean }) {
  return <div className="tech-player-cell"><small>{label}</small><strong>{player?.name || "Not selected"}{active && <i />}</strong><p>{player ? <><b>{player.runs}{active ? "*" : ""}</b> ({player.balls})</> : "—"}</p><span>{player ? `4s: ${player.fours}  |  6s: ${player.sixes}  |  SR: ${player.balls ? (player.runs * 100 / player.balls).toFixed(2) : "0.00"}` : "Waiting for match setup"}</span></div>
}

export default function WidgetsScreen({ score, teams, matchOvers }: { score: LiveScore; teams: WidgetTeam[]; matchOvers: number }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(() => getInstallPrompt())
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
  const ballsRemaining = Math.max(0, matchOvers * 6 - score.balls)
  const runRate = score.balls ? (score.runs * 6 / score.balls).toFixed(2) : "0.00"
  const requiredRate = need !== null && ballsRemaining ? (need * 6 / ballsRemaining).toFixed(2) : "—"
  const lastWicket = score.fall?.at(-1) || "No wicket recorded"
  const statusLabel = score.result ? "FINAL" : isLive ? "LIVE" : "READY"

  useEffect(() => subscribeInstallPrompt(setInstallPrompt), [])

  const install = async () => {
    if (!installPrompt) {
      setInstallNote("On Android, open the browser menu and choose Add to Home screen.")
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    setInstallNote(choice.outcome === "accepted" ? "CricVault was added to your home screen." : "You can install it later from your browser menu.")
    clearInstallPrompt()
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
        <div className="widget-size-heading"><span>COMPACT LIVE MATCH WIDGET</span><b>2 × 1</b></div>
        <article className="compact-live-widget" aria-label={`${battingName} ${scoreText} after ${overs(score.balls)} overs against ${bowlingName}`}>
          <div className="compact-widget-topline"><div className="compact-widget-brand"><span>CV</span><b>CRICVAULT</b></div><small>T20 · {Math.floor(score.balls / 6) + 1}TH OV</small></div>
          <div className="compact-widget-scoreline">
            <TeamLogo team={battingTeam} small />
            <div><strong>{scoreText}</strong><span>{overs(score.balls)} OVERS <i /> <b className={isLive ? "live" : ""}>{statusLabel}</b></span></div>
            <TeamLogo team={bowlingTeam} small />
          </div>
          <div className="compact-widget-requirement"><span>{score.target ? "CHASE" : `INNINGS ${score.innings || 1}`}</span>{need !== null ? <>Need <strong>{need}</strong> runs from <strong>{ballsRemaining}</strong> balls</> : <>Live score updates automatically</>}</div>
        </article>
      </section>

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
        <div><Maximize2 /><span><b>THREE SIZES</b><small>2×1 · 4×2 · 5×3</small></span></div>
        <div><Moon /><span><b>DARK MODE</b><small>Optimized for Android</small></span></div>
        <button onClick={() => void install()}><Download /> Add to Android</button>
      </section>
      {installNote && <p className="widget-install-note">{installNote}</p>}
      <section className="android-install-guide">
        <div><small>ANDROID INSTALLATION</small><h2>Keep live cricket one tap away.</h2><p>Install CricVault from Chrome or Samsung Internet. The installed experience launches directly into the responsive live widget screen and continues receiving Firebase score updates.</p></div>
        <ol><li><b>01</b><span>Open CricVault in Chrome on Android.</span></li><li><b>02</b><span>Tap “Add to Android” or choose Install app from the browser menu.</span></li><li><b>03</b><span>Launch CricVault from the new home-screen icon.</span></li></ol>
      </section>
    </main>
  )
}
