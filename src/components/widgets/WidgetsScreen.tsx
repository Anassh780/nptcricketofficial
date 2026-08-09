import { useEffect, useMemo, useState } from "react"
import { Activity, Download, Radio, Smartphone, Swords, Wifi } from "lucide-react"
import "./widgets.css"

type Batter = { name: string; runs: number; balls: number; fours: number; sixes: number; out: boolean }
type Bowler = { name: string; balls: number; runs: number; wickets: number }
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
  batters: Record<string, Batter>
  bowlers: Record<string, Bowler>
  overMarks: string[]
  target: number | null
  result: string
}

type WidgetTeam = { name: string; code: string; color: string; logo?: string }
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

const overs = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((word) => word[0]).join("").slice(0, 3).toUpperCase() || "DPL"

function TeamLogo({ team }: { team?: WidgetTeam }) {
  return <span className="widget-team-logo" style={{ "--team-color": team?.color || "#91e521" } as React.CSSProperties}>{team?.logo ? <img src={team.logo} alt={`${team.name} logo`} /> : <b>{team?.code || initials(team?.name || "DPL")}</b>}</span>
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
  const chaseLine = score.target && score.innings === 2 ? `${Math.max(0, score.target - score.runs)} runs needed · target ${score.target}` : `Innings ${score.innings || 1}`
  const lastBalls = useMemo(() => score.overMarks?.slice(-6) || [], [score.overMarks])

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

  return (
    <main className="widgets-page">
      <section className="widgets-intro">
        <div><span><Radio /> LIVE MATCH COMPANION</span><h1>Scores that stay close.</h1><p>Open a focused Android-ready score view with the live total, recent balls, active batters, and current bowler—all synchronized with the DPL 6 scoring room.</p></div>
        <button onClick={() => void install()}><Download /> Add Android shortcut</button>
      </section>

      <section className="widgets-showcase">
        <article className="score-widget score-widget-primary">
          <header><span className={isLive ? "is-live" : ""}><i /> {isLive ? "LIVE" : score.result ? "FINAL" : "WAITING"}</span><small>DPL 6 · MATCH CENTER</small></header>
          <div className="widget-primary-score">
            <TeamLogo team={battingTeam} />
            <div><small>{score.batting || "Next match"}</small><strong>{score.batting ? `${score.runs}/${score.wickets}` : "--/--"}</strong><p>{score.batting ? `${overs(score.balls)} overs` : "Live score will appear here"}</p></div>
          </div>
          <footer><span>{score.result || chaseLine}</span><Wifi /></footer>
        </article>

        <article className="score-widget score-widget-versus">
          <header><span>LIVE SCOREBOARD</span><Activity /></header>
          <div className="widget-versus-teams">
            <div><TeamLogo team={battingTeam} /><b>{score.batting || "Team A"}</b></div>
            <section><small>{score.innings ? `INNINGS ${score.innings}` : "DPL 6"}</small><strong>{score.batting ? `${score.runs}/${score.wickets}` : "VS"}</strong><span>{score.batting ? `${overs(score.balls)} OVERS` : "UPCOMING"}</span></section>
            <div><TeamLogo team={bowlingTeam} /><b>{score.bowling || "Team B"}</b></div>
          </div>
          <div className="widget-last-balls"><small>LAST BALLS</small><div>{lastBalls.length ? lastBalls.map((mark, index) => <b key={`${mark}-${index}`} className={mark === "W" ? "wicket" : mark === "4" || mark === "6" ? "boundary" : ""}>{mark}</b>) : <span>Waiting for play</span>}</div></div>
        </article>

        <article className="score-widget player-widget">
          <header><span>AT THE CREASE</span><Swords /></header>
          <div className="player-widget-row active"><i>BAT</i><div><strong>{score.striker || "Striker"} <em>●</em></strong><span>{striker ? `${striker.runs} runs · ${striker.balls} balls` : "Waiting for match setup"}</span></div>{striker && <b>{striker.balls ? (striker.runs * 100 / striker.balls).toFixed(1) : "0.0"}</b>}</div>
          <div className="player-widget-row"><i>BAT</i><div><strong>{score.nonStriker || "Non-striker"}</strong><span>{nonStriker ? `${nonStriker.runs} runs · ${nonStriker.balls} balls` : "Waiting for match setup"}</span></div>{nonStriker && <b>{nonStriker.balls ? (nonStriker.runs * 100 / nonStriker.balls).toFixed(1) : "0.0"}</b>}</div>
          <div className="player-widget-row bowler"><i>BOWL</i><div><strong>{score.bowler || "Current bowler"}</strong><span>{bowler ? `${overs(bowler.balls)} overs · ${bowler.runs} runs` : "Waiting for match setup"}</span></div>{bowler && <b>{bowler.wickets}W</b>}</div>
        </article>

        <article className="widget-install-card">
          <Smartphone />
          <div><small>ANDROID SHORTCUT</small><h2>One tap to the live view.</h2><p>Add CricVault to your home screen and it will open directly in this lightweight live score dashboard.</p>{installNote && <span>{installNote}</span>}</div>
          <button onClick={() => void install()}>Install shortcut</button>
        </article>
      </section>
    </main>
  )
}
