import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react"
import { subscribeTeamProfiles, TEAM_UPDATE_EVENT, type SharedTeamProfile } from "./data/teamStore"
import { isLeagueAdmin, loginWithGoogle, logoutFirebase, observeFirebaseUser, saveCloudData, subscribeCloudData, type FirebaseUser } from "./lib/firebase"
import type { LeagueMatch } from "./components/matches/MatchesScreen"
import { deriveScorecards, type BattingLine, type BowlingLine } from "./utils/scorecardHelpers"
import Navbar, { NavbarBrand, type NavScreen as Screen } from "./components/navigation/Navbar"
import AboutSection from "./components/landing/AboutSection"
import WidgetsScreen from "./components/widgets/WidgetsScreen"
import ScoringControls from "./components/scoring/ScoringControls"
import MatchReportModal from "./components/report/MatchReportModal"
import tournamentStadiumUrl from "./assets/tournament-stadium.png"
import "./components/scoring/innings-result.css"
import "./components/series/series-expanded.css"
import "./components/landing/landing-motion.css"

const LazyTeamsScreen = lazy(() => import("./components/teams/TeamsScreen"))
const LazyPlayersScreen = lazy(() => import("./components/players/PlayersScreen"))
const LazyMatchesScreen = lazy(() => import("./components/matches/MatchesScreen"))
const LazyAdminAccessScreen = lazy(() => import("./components/admin/AdminAccessScreen"))

type Team = {
  code: string
  name: string
  color: string
  players: string[]
  logo?: string
  playerPhotos?: Record<string, string>
}
type Batter = {
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  out: boolean
  dismissal: string
}
type Bowler = {
  name: string
  balls: number
  runs: number
  wickets: number
  maidens: number
}
type Ball = {
  id: number
  innings: number
  over: string
  mark: string
  tone: string
  text: string
  legal: boolean
  runs: number
}
type InningsSummary = {
  team: string
  runs: number
  wickets: number
  balls: number
  batting?: Batter[]
  bowling?: Bowler[]
  extras?: { wd: number; nb: number; b: number; lb: number }
}
type Standing = {
  team: string
  p: number
  w: number
  l: number
  t: number
  nr: number
  pts: number
  forRuns: number
  forBalls: number
  againstRuns: number
  againstBalls: number
}
type ScoreState = {
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
  freeHit: boolean
  partnershipRuns: number
  partnershipBalls: number
  extras: { wd: number; nb: number; b: number; lb: number }
  batters: Record<string, Batter>
  bowlers: Record<string, Bowler>
  events: Ball[]
  overMarks: string[]
  fall: string[]
  summaries: InningsSummary[]
  target: number | null
  result: string
  needsBowler: boolean
  table: Standing[]
}

const inningsSnapshot = (state: ScoreState): InningsSummary => ({
  team: state.batting,
  runs: state.runs,
  wickets: state.wickets,
  balls: state.balls,
  batting: Object.values(state.batters).filter((player) => player.balls || player.runs || player.out),
  bowling: Object.values(state.bowlers).filter((player) => player.balls || player.runs || player.wickets),
  extras: { ...state.extras },
})

const EMPTY_TEAM: Team = { code: "--", name: "", color: "#91e521", players: [] }
const DEFAULT_TEAM_PROFILES: SharedTeamProfile[] = []

const blankStanding = (team: Team): Standing => ({
  team: team.name,
  p: 0,
  w: 0,
  l: 0,
  t: 0,
  nr: 0,
  pts: 0,
  forRuns: 0,
  forBalls: 0,
  againstRuns: 0,
  againstBalls: 0,
})

const netRunRate = (row: Standing) => {
  const forRate = row.forBalls ? row.forRuns / (row.forBalls / 6) : 0
  const againstRate = row.againstBalls
    ? row.againstRuns / (row.againstBalls / 6)
    : 0
  return forRate - againstRate
}

const dedupeStandings = (rows: Standing[]) => {
  const unique = new Map<string, Standing>()
  rows.forEach((row) => {
    const existing = unique.get(row.team)
    if (!existing || row.p > existing.p || (row.p === existing.p && row.pts > existing.pts)) {
      unique.set(row.team, row)
    }
  })
  return [...unique.values()]
}

const applyCompletedMatch = (
  table: Standing[],
  first: InningsSummary,
  second: InningsSummary,
  winner: string,
) => dedupeStandings(table).map((row) => {
  if (row.team !== first.team && row.team !== second.team) return row
  const own = row.team === first.team ? first : second
  const opponent = row.team === first.team ? second : first
  const tied = !winner
  const won = winner === row.team
  return {
    ...row,
    p: row.p + 1,
    w: row.w + (won ? 1 : 0),
    l: row.l + (!won && !tied ? 1 : 0),
    t: row.t + (tied ? 1 : 0),
    pts: row.pts + (won ? 2 : tied ? 1 : 0),
    forRuns: row.forRuns + own.runs,
    forBalls: row.forBalls + own.balls,
    againstRuns: row.againstRuns + opponent.runs,
    againstBalls: row.againstBalls + opponent.balls,
  }
})

const nrrSummary = (summary: InningsSummary, inningsBallLimit: number) => ({
  ...summary,
  balls: summary.wickets >= 10 ? inningsBallLimit : Math.max(1, summary.balls),
})

const INITIAL_TABLE: Standing[] = []

const teamByName = (name: string, teams: Team[] = []) =>
  teams.find((team) => team.name === name) || teams[0] || EMPTY_TEAM
const freshBatters = (team: Team) =>
  Object.fromEntries(
    team.players.map((name) => [
      name,
      {
        name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
        dismissal: "",
      },
    ]),
  )
const freshBowlers = (team: Team) =>
  Object.fromEntries(
    team.players.map((name) => [
      name,
      { name, balls: 0, runs: 0, wickets: 0, maidens: 0 },
    ]),
  )
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const oversText = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`

const INITIAL: ScoreState = {
  matchId: "",
  innings: 1,
  batting: "",
  bowling: "",
  runs: 0,
  wickets: 0,
  balls: 0,
  striker: "",
  nonStriker: "",
  bowler: "",
  freeHit: false,
  partnershipRuns: 0,
  partnershipBalls: 0,
  extras: { wd: 0, nb: 0, b: 0, lb: 0 },
  batters: {},
  bowlers: {},
  events: [],
  overMarks: [],
  fall: [],
  summaries: [],
  target: null,
  result: "",
  needsBowler: false,
  table: INITIAL_TABLE,
}

function SetupPanel({
  onStart,
  teams,
  onResumeMatch,
}: {
  teams: Team[]
  onStart: (setup: {
    teamA: string
    teamB: string
    overs: number
    toss: string
    decision: string
    striker: string
    nonStriker: string
    bowler: string
  }) => void
  onResumeMatch?: () => void
}) {
  const [step, setStep] = useState(1)
  const [teamA, setTeamA] = useState(teams[0].name)
  const [teamB, setTeamB] = useState(teams[1].name)
  const [overs, setOvers] = useState(20)
  const [toss, setToss] = useState(teams[0].name)
  const [decision, setDecision] = useState("Bat")

  const savedSessionRaw = localStorage.getItem("cricvault-active-session")
  const savedSession = useMemo(() => {
    if (!savedSessionRaw) return null
    try {
      const parsed = JSON.parse(savedSessionRaw)
      if (parsed?.state && !parsed.state.result && parsed.matchReady) return parsed
    } catch {
      return null
    }
    return null
  }, [savedSessionRaw])

  const a = teamByName(teamA, teams)
  const b = teamByName(teamB, teams)
  const battingName = decision === "Bat" ? toss : toss === teamA ? teamB : teamA
  const bowlingName = battingName === teamA ? teamB : teamA
  const battingTeam = teamByName(battingName, teams)
  const bowlingTeam = teamByName(bowlingName, teams)
  const [striker, setStriker] = useState(teams[0].players[0] || "")
  const [nonStriker, setNonStriker] = useState(teams[0].players[1] || "")
  const [openingBowler, setOpeningBowler] = useState(teams[1].players[0] || "")
  useEffect(() => {
    setStriker(battingTeam.players[0] || "")
    setNonStriker(battingTeam.players[1] || "")
    setOpeningBowler(bowlingTeam.players[0] || "")
  }, [battingName, bowlingName])
  const rostersReady = battingTeam.players.length >= 2 && bowlingTeam.players.length >= 1
  const next = () => setStep((value) => Math.min(5, value + 1))
  return (
    <section className="panel setup-panel">
      <div className="panel-title">
        <h2>Match setup</h2>
        <span>GUIDED FLOW</span>
      </div>

      {savedSession && onResumeMatch && (
        <div style={{
          margin: "12px 14px 0",
          padding: "14px 16px",
          background: "linear-gradient(135deg, rgba(145, 229, 33, 0.16), rgba(8, 24, 32, 0.95))",
          border: "1px solid rgba(145, 229, 33, 0.4)",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}>
          <div>
            <div style={{ fontSize: "10px", color: "#91e521", fontWeight: 700, letterSpacing: "0.1em" }}>
              ⚡ UNFINISHED MATCH IN PROGRESS
            </div>
            <strong style={{ fontSize: "14px", color: "#ffffff", display: "block", marginTop: "2px" }}>
              {savedSession.state.batting} vs {savedSession.state.bowling} ({savedSession.state.runs}/{savedSession.state.wickets})
            </strong>
            <small style={{ fontSize: "10px", color: "#8da0a7" }}>
              Stopped at {oversText(savedSession.state.balls)} overs · Last saved {new Date(savedSession.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </small>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="report-btn report-btn-secondary"
              style={{ height: "36px", padding: "0 12px", fontSize: "11px" }}
              onClick={() => {
                if (window.confirm("Discard the saved unfinished match session?")) {
                  localStorage.removeItem("cricvault-active-session")
                  window.location.reload()
                }
              }}
            >
              Discard
            </button>
            <button
              className="report-btn report-btn-primary"
              style={{ height: "36px", padding: "0 16px", fontSize: "12px", whiteSpace: "nowrap" }}
              onClick={onResumeMatch}
            >
              Resume Match →
            </button>
          </div>
        </div>
      )}
      <div className="steps">
        {["Match", "Teams", "Settings", "Openers", "Confirm"].map((label, index) => (
          <button
            className={
              step === index + 1 ? "on" : step > index + 1 ? "done" : ""
            }
            onClick={() => setStep(index + 1)}
            key={label}
          >
            <i>{index + 1}</i>
            <span>{label}</span>
          </button>
        ))}
      </div>
      {step === 1 && (
        <div className="setup-body">
          <label>
            Tournament / Series
            <input value="Diamond Premier League 6" readOnly />
          </label>
          <div className="form-grid">
            <label>
              Team A
              <select
                value={teamA}
                onChange={(e) => {
                  setTeamA(e.target.value)
                  if (teamB === e.target.value)
                    setTeamB(teams.find((t) => t.name !== e.target.value)!.name)
                }}
              >
                {teams.map((t) => (
                  <option key={t.name}>{t.name}</option>
                ))}
              </select>
            </label>
            <label>
              Team B
              <select value={teamB} onChange={(e) => setTeamB(e.target.value)}>
                {teams.filter((t) => t.name !== teamA).map((t) => (
                  <option key={t.name}>{t.name}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Venue
            <input defaultValue="Aurora Cricket Stadium, New Dawn" />
          </label>
        </div>
      )}
      {step === 2 && (
        <div className="setup-body roster-step">
          <p className="helper">
            Playing XI is ready. Opening selections can be changed after the
            toss.
          </p>
          <div className="roster-grid">
            <Roster team={a} keeper={a.players[3]} />
            <Roster team={b} keeper={b.players[1]} />
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="setup-body">
          <div className="format-row">
            <button
              className={overs === 20 ? "selected" : ""}
              onClick={() => setOvers(20)}
            >
              T20 · 20 overs
            </button>
            <button
              className={overs === 50 ? "selected" : ""}
              onClick={() => setOvers(50)}
            >
              ODI · 50 overs
            </button>
            <button
              className={![20, 50].includes(overs) ? "selected" : ""}
              onClick={() => setOvers(10)}
            >
              Custom
            </button>
          </div>
          <label>
            Overs per innings
            <input
              type="number"
              min="1"
              max="100"
              value={overs}
              onChange={(e) => setOvers(Math.max(1, Number(e.target.value)))}
            />
          </label>
          <div className="form-grid">
            <label>
              Toss winner
              <select value={toss} onChange={(e) => setToss(e.target.value)}>
                <option>{teamA}</option>
                <option>{teamB}</option>
              </select>
            </label>
            <label>
              Toss decision
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              >
                <option>Bat</option>
                <option>Bowl</option>
              </select>
            </label>
          </div>
        </div>
      )}
      {step === 4 && (
        <div className="setup-body opening-players-step">
          <div className="opening-team-note">
            <span>BATTING</span><strong>{battingName}</strong>
            <i>vs</i>
            <span>BOWLING</span><strong>{bowlingName}</strong>
          </div>
          <div className="form-grid">
            <label>
              Opening striker
              <select value={striker} onChange={(e) => {
                setStriker(e.target.value)
                if (e.target.value === nonStriker) setNonStriker(battingTeam.players.find((name) => name !== e.target.value) || "")
              }}>
                {battingTeam.players.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label>
              Opening non-striker
              <select value={nonStriker} onChange={(e) => setNonStriker(e.target.value)}>
                {battingTeam.players.filter((name) => name !== striker).map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
          </div>
          <label>
            Opening bowler
            <select value={openingBowler} onChange={(e) => setOpeningBowler(e.target.value)}>
              {bowlingTeam.players.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <p className="helper">These players will be active immediately when the scorer opens.</p>
          {!rostersReady && <div className="setup-roster-alert"><strong>Squad names required</strong><span>Add at least two named players to the batting team and one named player to the bowling team in Team Center.</span></div>}
        </div>
      )}
      {step === 5 && (
        <div className="setup-body confirm-card">
          <span className="mini-label">READY TO SCORE</span>
          <h3>
            {teamA} <em>vs</em> {teamB}
          </h3>
          <p>
            {overs} overs · {toss} won the toss and chose to{" "}
            {decision.toLowerCase()}.
          </p>
          <p>
            {striker} and {nonStriker} will open the batting. {openingBowler} will bowl first.
          </p>
        </div>
      )}
      <div className="setup-actions">
        <button
          className="subtle"
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
        >
          Back
        </button>
        {step < 5 ? (
          <button className="lime" onClick={next}>
            Continue →
          </button>
        ) : (
          <button
            className="lime"
            disabled={!rostersReady || !striker || !nonStriker || !openingBowler}
            onClick={() => onStart({ teamA, teamB, overs, toss, decision, striker, nonStriker, bowler: openingBowler })}
          >
            {rostersReady ? "Start scoring →" : "Add squad names first"}
          </button>
        )}
      </div>
    </section>
  )
}

function Roster({ team, keeper }: { team: Team; keeper: string }) {
  return (
    <div className="roster">
      <h4>
        <TeamBadge team={team} /> {team.name}
      </h4>
      {team.players.map((p, i) => (
        <div key={p}>
          <b>{i + 1}</b>
          <span>{p}</span>
          {p === keeper && <i>WK</i>}
        </div>
      ))}
    </div>
  )
}

function TeamBadge({ team }: { team: Team }) {
  return (
    <span
      className="team-badge"
      style={{ "--team": team.color } as React.CSSProperties}
    >
      {team.logo ? <img src={team.logo} alt={`${team.name} logo`} /> : team.code}
    </span>
  )
}

function ScoreHeader({
  state,
  overs,
  teams,
  onOpenReport,
}: {
  state: ScoreState
  overs: number
  teams: Team[]
  onOpenReport?: () => void
}) {
  const batting = teamByName(state.batting, teams),
    bowling = teamByName(state.bowling, teams)
  const crr = state.balls ? (state.runs / (state.balls / 6)).toFixed(2) : "0.00"
  const ballsLeft = Math.max(0, overs * 6 - state.balls)
  const need = state.target ? Math.max(0, state.target - state.runs) : 0
  const rrr =
    state.target && ballsLeft ? (need / (ballsLeft / 6)).toFixed(2) : "—"
  return (
    <section className="score-head">
      <div className="live-row">
        <span>
          <i /> LIVE
        </span>
        <div>
          {onOpenReport && (
            <button
              className="report-btn report-btn-primary"
              style={{ height: "24px", fontSize: "9px", padding: "0 8px", borderRadius: "4px" }}
              onClick={onOpenReport}
            >
              📄 Share Report
            </button>
          )}
          <button>▣</button>
          <button>•••</button>
        </div>
      </div>
      <div className="score-line">
        <div>
          <TeamBadge team={batting} />
          <strong>{batting.name}</strong>
        </div>
        <div className="big-score">
          <b>
            {state.runs}/{state.wickets}
          </b>
          <span>{oversText(state.balls)} OVERS</span>
        </div>
        <div className="opponent">
          <strong>{bowling.name}</strong>
          <TeamBadge team={bowling} />
        </div>
      </div>
      <div className="rate-line">
        <span>
          CRR <b>{crr}</b>
        </span>
        <span>
          {state.innings === 1
            ? `${overs}-over match`
            : `Target ${state.target}`}
        </span>
        <span>
          RRR <b>{rrr}</b>
        </span>
      </div>
      {state.freeHit && (
        <div className="free-hit">
          FREE HIT — only a run-out dismissal is valid
        </div>
      )}
      {state.result && <div className="result-banner">{state.result}</div>}
    </section>
  )
}
function PlayerCards({ state, teams }: { state: ScoreState; teams: Team[] }) {
  const striker = state.batters[state.striker],
    non = state.batters[state.nonStriker],
    bowler = state.bowlers[state.bowler]
  const playerPhoto = (name: string) =>
    teams.find((team) => team.players.includes(name))?.playerPhotos?.[name]
  const avatar = (name: string) =>
    playerPhoto(name) ? (
      <span className="avatar"><img src={playerPhoto(name)} alt={`${name} profile`} /></span>
    ) : (
      <span className="avatar">{name[0]}</span>
    )
  const batCard = (b: Batter, label: string, active = false) => (
    <article className={`player-card ${active ? "active-batter" : ""}`}>
      <span>{label}</span>
      {active && <b className="on-strike-badge">ON STRIKE</b>}
      <h3>
        {avatar(b.name)}
        {b.name}
        <i />
      </h3>
      <div className="stat-row">
        <Metric label="RUNS" value={b.runs} />
        <Metric label="BALLS" value={b.balls} />
        <Metric label="4s" value={b.fours} />
        <Metric label="6s" value={b.sixes} />
        <Metric
          label="SR"
          value={b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0"}
        />
      </div>
    </article>
  )
  return (
    <div className="player-grid">
      {batCard(striker, "BATSMAN · STRIKER", true)}
      {batCard(non, "BATSMAN · NON-STRIKER")}
      <article className="player-card">
        <span>BOWLER</span>
        <h3>
          {avatar(bowler.name)}
          {bowler.name}
          <i />
        </h3>
        <div className="stat-row">
          <Metric label="OVERS" value={oversText(bowler.balls)} />
          <Metric label="RUNS" value={bowler.runs} />
          <Metric label="WKTS" value={bowler.wickets} />
          <Metric
            label="ECON"
            value={
              bowler.balls
                ? (bowler.runs / (bowler.balls / 6)).toFixed(2)
                : "0.00"
            }
          />
        </div>
      </article>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  )
}

function InsightRow({ state }: { state: ScoreState }) {
  const last = state.fall.at(-1) || "—"
  return (
    <div className="insight-row">
      <div>
        <span>PARTNERSHIP</span>
        <strong>
          {state.partnershipRuns} <small>({state.partnershipBalls})</small>
        </strong>
      </div>
      <div>
        <span>LAST WICKET</span>
        <strong>{last}</strong>
      </div>
      <div>
        <span>FALL OF WICKETS</span>
        <strong>
          {state.fall.length ? state.fall.slice(-4).join(" · ") : "—"}
        </strong>
      </div>
      <div>
        <span>EXTRAS</span>
        <strong>
          {Object.values(state.extras).reduce((a, b) => a + b, 0)}
        </strong>
        <small>
          {" "}
          WD {state.extras.wd} · NB {state.extras.nb} · B {state.extras.b} · LB{" "}
          {state.extras.lb}
        </small>
      </div>
    </div>
  )
}

function ScoreTables({ state, teams }: { state: ScoreState; teams: Team[] }) {
  const playerPhoto = (name: string) =>
    teams.find((team) => team.players.includes(name))?.playerPhotos?.[name]
  const playerName = (name: string) => (
    <span className="table-player-name">
      {playerPhoto(name) && <img src={playerPhoto(name)} alt="" />}
      <span>{name}</span>
    </span>
  )
  return (
    <div className="tables-grid">
      <section className="panel data-table">
        <div className="panel-label">
          <span>Batting scorecard</span>
          <small>{state.batting}</small>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>BATSMAN</th>
              <th>DISMISSAL</th>
              <th>R</th>
              <th>B</th>
              <th>4s</th>
              <th>6s</th>
              <th>SR</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(state.batters).map((b, i) => (
              <tr
                className={
                  b.name === state.striker
                    ? "playing striker-row"
                    : b.name === state.nonStriker
                      ? "playing"
                    : ""
                }
                key={b.name}
              >
                <td>{i + 1}</td>
                <td>{playerName(b.name)}{b.name === state.striker && <b className="table-striker-mark">BAT</b>}</td>
                <td>
                  {b.out
                    ? b.dismissal
                    : b.name === state.striker || b.name === state.nonStriker
                      ? "not out"
                      : "yet to bat"}
                </td>
                <td>{b.runs}</td>
                <td>{b.balls}</td>
                <td>{b.fours}</td>
                <td>{b.sixes}</td>
                <td>{b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="panel data-table">
        <div className="panel-label">
          <span>Bowling figures</span>
          <small>{state.bowling}</small>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>BOWLER</th>
              <th>O</th>
              <th>R</th>
              <th>W</th>
              <th>ECON</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(state.bowlers)
              .filter((b) => b.balls || b.name === state.bowler)
              .map((b, i) => (
                <tr key={b.name}>
                  <td>{i + 1}</td>
                  <td>{playerName(b.name)}</td>
                  <td>{oversText(b.balls)}</td>
                  <td>{b.runs}</td>
                  <td>{b.wickets}</td>
                  <td>
                    {b.balls ? (b.runs / (b.balls / 6)).toFixed(2) : "0.00"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function RightRail({ state, overs }: { state: ScoreState; overs: number }) {
  return (
    <aside className="right-rail focused-rail">
      <section className="panel compact">
        <div className="panel-label"><span>Match status</span></div>
        <p><i /> Live <b>Innings {state.innings}</b></p>
        <p><i /> Overs limit <b>{overs}</b></p>
        <p><i /> Free hit <b>{state.freeHit ? "Active" : "No"}</b></p>
      </section>
      <section className="panel event-log">
        <div className="panel-label">
          <span>Recent deliveries</span>
          <small>Latest first</small>
        </div>
        {state.events.slice(0, 10).map((ball) => (
          <div key={ball.id}>
            <span>{ball.over}</span>
            <i className={ball.tone}>{ball.mark}</i>
            <p>{ball.text}</p>
          </div>
        ))}
        {!state.events.length && <div className="empty">Score the first ball to begin.</div>}
      </section>
    </aside>
  )
}
const TABLE_COLORS = [
  "#91e521",
  "#ff4b4b",
  "#53a5ff",
  "#f2c94c",
  "#ff8b32",
  "#7c67ff",
  "#25d0ba",
  "#ff667d",
  "#8cc6ff",
  "#d0a55e",
]

function HomeScreen({ onNavigate, isAdmin }: { onNavigate: (screen: Screen) => void; isAdmin: boolean }) {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"))
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elements.forEach((element) => element.classList.add("is-revealed"))
      return
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed")
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.14, rootMargin: "0px 0px -7%" })
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <main className="public-home">
        <section className="public-hero">
          <div className="public-overlay" />
          <div className="public-copy landing-hero-enter">
            <span>THE GAME NEVER STOPS</span>
            <h1>
              Cricket.
              <br />
              Live every
              <br />
              <em>moment.</em>
            </h1>
            <p>
              Live scores, match intelligence, highlights, and professional
              scoring tools—built into one premium cricket platform.
            </p>
            <div>
              <button
                className="home-primary"
                onClick={() => onNavigate("scoring")}
              >
                ▶ Open live scorer
              </button>
              <button
                className="home-secondary"
                onClick={() => onNavigate("points")}
              >
                View points table →
              </button>
            </div>
          </div>
          <div className="hero-edge-note">
            <span>LIVE SYSTEMS</span>
            <b>ONLINE</b>
          </div>
        </section>
        <section className="home-features" data-reveal>
          <article>
            <span>01</span>
            <h2>Match center</h2>
            <p>Live coverage and precise ball-by-ball context.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Advanced scoring</h2>
            <p>A complete operator workspace for real matches.</p>
          </article>
          <article>
            <span>03</span>
            <h2>League standings</h2>
            <p>Team identities, points and calculated net run rate.</p>
          </article>
        </section>
        <section className="home-metrics" data-reveal>
          <div><strong>Live</strong><span>Ball-by-ball scoring</span></div>
          <div><strong>2 groups</strong><span>DPL 6 tournament</span></div>
          <div><strong>Real time</strong><span>Firebase synchronization</span></div>
          <div><strong>One platform</strong><span>Teams, players, and results</span></div>
        </section>

        <section className="landing-section home-platform" data-reveal>
          <header>
            <span>BUILT FOR THE WHOLE LEAGUE</span>
            <h2>Everything from the toss to the trophy.</h2>
            <p>CricVault keeps the tournament connected without forcing scorers, teams, and supporters through separate tools.</p>
          </header>
          <div className="home-platform-grid">
            <article><small>01 / MATCH DAY</small><h3>Fixtures and results</h3><p>Track every scheduled match, winner, innings, batting card, and bowling card.</p><button onClick={() => onNavigate("matches")}>Open match center →</button></article>
            <article><small>02 / TOURNAMENT</small><h3>Series progression</h3><p>Follow group stages, qualifiers, semi-finals, and the championship path.</p><button onClick={() => onNavigate("series")}>View tournament →</button></article>
            <article><small>03 / SQUADS</small><h3>Teams and players</h3><p>One source for team logos, player portraits, names, and live match identities.</p><button onClick={() => onNavigate("teams")}>Explore squads →</button></article>
            <article><small>04 / OPERATIONS</small><h3>Advanced scoring</h3><p>A guided setup and focused scoring room built for accurate match-day operation.</p><button onClick={() => onNavigate("scoring")}>Open scoring →</button></article>
          </div>
        </section>

        <AboutSection isAdmin={isAdmin} />

        <section className="home-final-cta" data-reveal>
          <span>READY FOR MATCH DAY?</span>
          <h2>Every ball becomes part of the official story.</h2>
          <div><button className="home-primary" onClick={() => onNavigate("matches")}>Explore matches</button><button className="home-secondary" onClick={() => onNavigate("points")}>View standings →</button></div>
        </section>
      </main>
      <PublicFooter onNavigate={onNavigate} />
    </>
  )
}

function PublicFooter({
  onNavigate,
}: {
  onNavigate: (screen: Screen) => void
}) {
  return (
    <footer className="public-footer">
      <div className="footer-top">
        <div>
            <NavbarBrand />
          <p>
            Cricket intelligence and professional match operations, designed as
            one coherent platform.
          </p>
        </div>
        <div>
          <span>PLATFORM</span>
          <button onClick={() => onNavigate("scoring")}>Live scorer</button>
          <button onClick={() => onNavigate("points")}>Points table</button>
        </div>
        <div>
          <span>UPCOMING</span>
          <button disabled>Matches</button>
          <button onClick={() => onNavigate("series")}>Series</button>
          <button onClick={() => onNavigate("teams")}>Teams</button>
        </div>
        <div className="footer-live">
          <i /> SYSTEMS ONLINE<small>Scoring engine 2.6.1</small>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 CRICVAULT</span>
        <span>THE GAME, REFINED</span>
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          BACK TO TOP ↑
        </button>
      </div>
    </footer>
  )
}

function TournamentCanvas({
  groups,
}: {
  groups: { name: string; teams: Standing[] }[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const holder = canvas?.parentElement
    if (!canvas || !holder) return
    const stadium = new Image()

    const draw = () => {
      const width = Math.max(320, Math.round(holder.clientWidth))
      const mobile = width < 700
      const height = mobile ? 1120 : Math.max(760, Math.round(width * 0.77))
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * pixelRatio
      canvas.height = height * pixelRatio
      canvas.style.height = `${height}px`
      const context = canvas.getContext("2d")
      if (!context) return
      context.scale(pixelRatio, pixelRatio)
      context.clearRect(0, 0, width, height)

      const roundRect = (
        x: number,
        y: number,
        w: number,
        h: number,
        radius: number,
      ) => {
        context.beginPath()
        context.roundRect(x, y, w, h, radius)
      }
      const polygon = (points: [number, number][]) => {
        context.beginPath()
        points.forEach(([x, y], index) =>
          index === 0 ? context.moveTo(x, y) : context.lineTo(x, y),
        )
        context.closePath()
      }
      const centeredText = (
        text: string,
        x: number,
        y: number,
        font: string,
        color = "#fff",
      ) => {
        context.save()
        context.font = font
        context.fillStyle = color
        context.textAlign = "center"
        context.textBaseline = "middle"
        context.fillText(text, x, y)
        context.restore()
      }
      const drawCover = (image: HTMLImageElement) => {
        if (!image.complete || !image.naturalWidth) return
        const stageHeight = mobile ? 500 : height
        const scale = Math.max(width / image.naturalWidth, stageHeight / image.naturalHeight)
        const imageWidth = image.naturalWidth * scale
        const imageHeight = image.naturalHeight * scale
        context.drawImage(
          image,
          (width - imageWidth) / 2,
          mobile ? 0 : (height - imageHeight) / 2,
          imageWidth,
          imageHeight,
        )
      }
      const line = (points: [number, number][]) => {
        context.save()
        context.beginPath()
        context.moveTo(points[0][0], points[0][1])
        points.slice(1).forEach(([x, y]) => context.lineTo(x, y))
        context.strokeStyle = "rgba(224,248,255,.88)"
        context.lineWidth = mobile ? 1.25 : 2
        context.shadowColor = "rgba(75,211,255,.8)"
        context.shadowBlur = 7
        context.stroke()
        context.restore()
      }
      const slot = (
        centerX: number,
        y: number,
        label: string,
        title: string,
        color: string,
        slotWidth = mobile ? 78 : 178,
      ) => {
        const h = mobile ? 29 : 34
        const x = centerX - slotWidth / 2
        context.save()
        context.shadowColor = "rgba(0,0,0,.52)"
        context.shadowBlur = 12
        context.shadowOffsetY = 6
        const metal = context.createLinearGradient(0, y, 0, y + h)
        metal.addColorStop(0, "#ffffff")
        metal.addColorStop(0.52, "#d7dde1")
        metal.addColorStop(1, "#f7f8f8")
        context.fillStyle = metal
        context.strokeStyle = "rgba(232,247,255,.95)"
        roundRect(x, y, slotWidth, h, 2)
        context.fill()
        context.stroke()
        context.shadowColor = "transparent"
        const tagWidth = mobile ? 25 : 45
        const tag = context.createLinearGradient(0, y, 0, y + h)
        tag.addColorStop(0, color)
        tag.addColorStop(1, "#76121b")
        context.fillStyle = tag
        context.fillRect(x, y, tagWidth, h)
        centeredText(label, x + tagWidth / 2, y + h / 2, `800 ${mobile ? 6 : 7}px Rajdhani`)
        context.save()
        context.beginPath()
        context.rect(x + tagWidth + 2, y, slotWidth - tagWidth - 4, h)
        context.clip()
        centeredText(
          title.toUpperCase(),
          x + tagWidth + (slotWidth - tagWidth) / 2,
          y + h / 2,
          `800 ${mobile ? 5 : 7}px Rajdhani`,
          "#102844",
        )
        context.restore()
        context.restore()
      }
      const drawBanner = () => {
        const center = width / 2
        const plateWidth = mobile ? 250 : Math.min(470, width * 0.46)
        const plateHeight = mobile ? 60 : 72
        const top = 30
        const wingWidth = mobile ? 62 : 160
        const wingHeight = mobile ? 34 : 44
        const silver = context.createLinearGradient(0, top, 0, top + wingHeight)
        silver.addColorStop(0, "#ffffff")
        silver.addColorStop(0.5, "#c6cbd0")
        silver.addColorStop(1, "#f8f9fa")
        context.fillStyle = silver
        polygon([
          [center - plateWidth / 2 - wingWidth + 26, top + 14],
          [center - plateWidth / 2 + 22, top + 14],
          [center - plateWidth / 2 + 2, top + wingHeight + 8],
          [center - plateWidth / 2 - wingWidth + 46, top + wingHeight + 8],
        ])
        context.fill()
        polygon([
          [center + plateWidth / 2 - 22, top + 14],
          [center + plateWidth / 2 + wingWidth - 26, top + 14],
          [center + plateWidth / 2 + wingWidth - 46, top + wingHeight + 8],
          [center + plateWidth / 2 - 2, top + wingHeight + 8],
        ])
        context.fill()
        const blue = context.createLinearGradient(0, top, 0, top + plateHeight)
        blue.addColorStop(0, "#16417d")
        blue.addColorStop(0.55, "#061b4b")
        blue.addColorStop(1, "#082a67")
        context.fillStyle = blue
        context.strokeStyle = "#b9def7"
        context.lineWidth = 1
        polygon([
          [center - plateWidth / 2 + 28, top],
          [center + plateWidth / 2 - 28, top],
          [center + plateWidth / 2, top + plateHeight / 2],
          [center + plateWidth / 2 - 28, top + plateHeight],
          [center - plateWidth / 2 + 28, top + plateHeight],
          [center - plateWidth / 2, top + plateHeight / 2],
        ])
        context.fill()
        context.stroke()
        centeredText("CRICVAULT PREMIER LEAGUE", center, top + 18, `700 ${mobile ? 6 : 8}px Rajdhani`, "#87cdf8")
        centeredText("TOURNAMENT 2026", center, top + 42, `800 ${mobile ? 20 : 29}px Rajdhani`)
        const ribbonY = top + plateHeight - 1
        context.fillStyle = "#d62535"
        polygon([
          [center - 138, ribbonY],
          [center + 138, ribbonY],
          [center + 123, ribbonY + 28],
          [center - 123, ribbonY + 28],
        ])
        context.fill()
        centeredText("FOR GROUPS AND TEAMS", center, ribbonY + 14, `700 ${mobile ? 7 : 9}px Rajdhani`)
      }
      const drawGroup = (
        group: { name: string; teams: Standing[] },
        groupIndex: number,
        x: number,
        y: number,
        panelWidth: number,
      ) => {
        const panelHeight = mobile ? 310 : 330
        context.save()
        context.shadowColor = "rgba(0,0,0,.55)"
        context.shadowBlur = 24
        context.shadowOffsetY = 12
        const panel = context.createLinearGradient(x, y, x + panelWidth, y + panelHeight)
        panel.addColorStop(0, "rgba(4,27,66,.96)")
        panel.addColorStop(1, "rgba(4,61,78,.93)")
        context.fillStyle = panel
        context.strokeStyle = "rgba(170,226,250,.76)"
        roundRect(x, y, panelWidth, panelHeight, 8)
        context.fill()
        context.stroke()
        context.shadowColor = "transparent"
        const head = context.createLinearGradient(x, y, x + panelWidth, y)
        head.addColorStop(0, "rgba(13,67,130,.96)")
        head.addColorStop(1, "rgba(3,30,69,.72)")
        context.fillStyle = head
        context.fillRect(x + 1, y + 1, panelWidth - 2, 60)
        context.textAlign = "left"
        context.fillStyle = "#75dcff"
        context.font = `700 ${mobile ? 7 : 8}px Rajdhani`
        context.fillText("LEAGUE STAGE", x + 18, y + 19)
        context.fillStyle = "#fff"
        context.font = `800 ${mobile ? 22 : 26}px Rajdhani`
        context.fillText(group.name.toUpperCase(), x + 18, y + 46)
        context.textAlign = "right"
        context.fillStyle = "#b6edff"
        context.font = "700 7px Rajdhani"
        context.fillText("TOP 2 QUALIFY", x + panelWidth - 16, y + 35)
        const rowX = x + 10
        const rowWidth = panelWidth - 20
        const rowHeight = 42
        const tableY = y + 79
        context.textAlign = "left"
        context.fillStyle = "#8bb7c9"
        context.font = "700 7px Rajdhani"
        context.fillText("TEAM", rowX + 57, y + 72)
        ;["M", "W", "PTS"].forEach((label, index) =>
          centeredText(label, rowX + rowWidth - 88 + index * 35, y + 70, "700 7px Rajdhani", "#8bb7c9"),
        )
        group.teams.slice(0, 5).forEach((team, index) => {
          const rowY = tableY + index * 47
          const color = TABLE_COLORS[(groupIndex * 5 + index) % TABLE_COLORS.length]
          const metal = context.createLinearGradient(0, rowY, 0, rowY + rowHeight)
          metal.addColorStop(0, "rgba(255,255,255,.99)")
          metal.addColorStop(1, "rgba(205,216,222,.98)")
          context.fillStyle = metal
          roundRect(rowX, rowY, rowWidth, rowHeight, 3)
          context.fill()
          context.fillStyle = color
          context.fillRect(rowX, rowY, 4, rowHeight)
          centeredText(String(index + 1), rowX + 16, rowY + rowHeight / 2, "700 8px Rajdhani", "#688194")
          context.beginPath()
          context.arc(rowX + 40, rowY + rowHeight / 2, 13, 0, Math.PI * 2)
          context.fillStyle = "#fff"
          context.fill()
          context.lineWidth = 2
          context.strokeStyle = color
          context.stroke()
          const initials = team.team.split(" ").map((word) => word[0]).join("")
          centeredText(initials, rowX + 40, rowY + rowHeight / 2, "800 6px Rajdhani", color)
          context.save()
          context.beginPath()
          context.rect(rowX + 58, rowY, Math.max(80, rowWidth - 170), rowHeight)
          context.clip()
          context.textAlign = "left"
          context.textBaseline = "middle"
          context.fillStyle = "#0b2746"
          context.font = `800 ${mobile ? 8 : 9}px Rajdhani`
          context.fillText(team.team, rowX + 61, rowY + rowHeight / 2)
          context.restore()
          const statsX = rowX + rowWidth - 88
          centeredText(String(team.p), statsX, rowY + rowHeight / 2, "800 9px Rajdhani", "#0a2748")
          centeredText(String(team.w), statsX + 35, rowY + rowHeight / 2, "800 9px Rajdhani", "#0a2748")
          context.fillStyle = "#09275a"
          context.fillRect(rowX + rowWidth - 35, rowY, 35, rowHeight)
          centeredText(String(team.pts), rowX + rowWidth - 17.5, rowY + rowHeight / 2, "800 10px Rajdhani")
        })
        context.restore()
      }

      context.fillStyle = "#03142b"
      context.fillRect(0, 0, width, height)
      drawCover(stadium)
      const shade = context.createLinearGradient(0, 0, 0, height)
      shade.addColorStop(0, "rgba(0,14,43,.05)")
      shade.addColorStop(mobile ? 0.43 : 0.55, "rgba(0,18,42,.42)")
      shade.addColorStop(1, "rgba(0,30,32,.93)")
      context.fillStyle = shade
      context.fillRect(0, 0, width, height)
      const vignette = context.createRadialGradient(width / 2, height * 0.35, 20, width / 2, height * 0.4, width * 0.72)
      vignette.addColorStop(0, "rgba(100,223,255,.08)")
      vignette.addColorStop(1, "rgba(0,4,20,.62)")
      context.fillStyle = vignette
      context.fillRect(0, 0, width, height)

      drawBanner()
      const finalY = 145
      const semiY = 225
      const qualifierY = 310
      const bracketHeight = mobile ? 29 : 34
      const semiCenters = [width * 0.28, width * 0.72]
      const qualifierCenters = [width * 0.12, width * 0.37, width * 0.63, width * 0.88]
      line([[width / 2, finalY + bracketHeight], [width / 2, 201], [semiCenters[0], 201], [semiCenters[0], semiY]])
      line([[width / 2, 201], [semiCenters[1], 201], [semiCenters[1], semiY]])
      semiCenters.forEach((semiX, index) => {
        const leftQualifier = qualifierCenters[index * 2]
        const rightQualifier = qualifierCenters[index * 2 + 1]
        line([[semiX, semiY + bracketHeight], [semiX, 286], [leftQualifier, 286], [leftQualifier, qualifierY]])
        line([[semiX, 286], [rightQualifier, 286], [rightQualifier, qualifierY]])
      })
      slot(width / 2, finalY, "FINAL", "Championship Match", "#e52f3b", mobile ? 150 : 190)
      slot(semiCenters[0], semiY, "SF 1", "Semifinal One", "#ef7b1a", mobile ? 105 : 180)
      slot(semiCenters[1], semiY, "SF 2", "Semifinal Two", "#ef7b1a", mobile ? 105 : 180)
      const seeds = [
        ["A1", "Group A Winner"],
        ["B2", "Group B Runner-up"],
        ["B1", "Group B Winner"],
        ["A2", "Group A Runner-up"],
      ]
      qualifierCenters.forEach((x, index) =>
        slot(x, qualifierY, seeds[index][0], seeds[index][1], "#2b963d"),
      )

      if (mobile) {
        drawGroup(groups[0], 0, 10, 385, width - 20)
        drawGroup(groups[1], 1, 10, 725, width - 20)
      } else {
        const groupWidth = width * 0.45
        drawGroup(groups[0], 0, width * 0.035, 405, groupWidth)
        drawGroup(groups[1], 1, width - width * 0.035 - groupWidth, 405, groupWidth)
      }
    }

    stadium.onload = draw
    stadium.src = tournamentStadiumUrl
    if (stadium.complete) draw()
    const observer = new ResizeObserver(draw)
    observer.observe(holder)
    return () => observer.disconnect()
  }, [groups])

  return <canvas ref={canvasRef} className="tournament-canvas" aria-hidden="true" />
}

function CanvasSeriesScreen({ table }: { table: Standing[] }) {
  const groups = useMemo(() => {
    const ordered = [...table].sort(
      (a, b) => b.pts - a.pts || b.w - a.w || a.team.localeCompare(b.team),
    )
    return [
      { name: "Group A", teams: ordered.filter((_, index) => index % 2 === 0) },
      { name: "Group B", teams: ordered.filter((_, index) => index % 2 === 1) },
    ]
  }, [table])

  return (
    <main className="series-canvas-page">
      <section className="tournament-canvas-shell" aria-label="CricVault Tournament 2026">
        <TournamentCanvas groups={groups} />
        <div className="series-canvas-data">
          <h1>CricVault Tournament 2026</h1>
          <p>Group A winner plays Group B runner-up. Group B winner plays Group A runner-up.</p>
          {groups.map((group) => (
            <section key={group.name}>
              <h2>{group.name}</h2>
              <ol>
                {group.teams.map((team) => (
                  <li key={team.team}>{team.team}: {team.p} matches, {team.w} wins, {team.pts} points</li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </section>
    </main>
  )
}


function BracketSlot({
  flagLabel,
  value,
  placeholder,
  options,
  teams,
  disabled = false,
  tone = "green",
  onChange,
}: {
  flagLabel: string
  value: string
  placeholder: string
  options: string[]
  teams: Team[]
  disabled?: boolean
  tone?: "red" | "orange" | "green"
  onChange: (val: string) => void
}) {
  const selectedTeam = teams.find((team) => team.name === value)
  const toneMap = {
    red: "linear-gradient(180deg,#d42a2a,#8e0c10)",
    orange: "linear-gradient(180deg,#e98623,#b44308)",
    green: "linear-gradient(180deg,#2a8a3e,#0a5a1e)",
  }
  return (
    <div className={`tb-slot tone-${tone}`}>
      <span className="tb-flag" style={{ background: toneMap[tone] }}>
        {selectedTeam?.logo ? (
          <img src={selectedTeam.logo} alt={`${selectedTeam.name} logo`} />
        ) : (
          selectedTeam?.code || flagLabel
        )}
      </span>
      <div className="tb-name-wrap">
        <select
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="tb-select"
          aria-label={placeholder}
        >
          <option value="">{placeholder}</option>
          {options.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="tb-chevron">▼</span>
      </div>
    </div>
  )
}

type TournamentSelections = {
  final: string
  sf1: string
  sf2: string
  qf1: string
  qf2: string
  qf3: string
  qf4: string
  qualifiers: string[]
  groups: string[][]
}

function SeriesScreen({
  table,
  teams,
  result,
  isAdmin,
}: {
  table: Standing[]
  teams: Team[]
  result: string
  isAdmin: boolean
}) {
  const allTeamNames = useMemo(() => {
    return Array.from(new Set(teams.map((team) => team.name)))
  }, [teams])

  const initialSelections = useMemo<TournamentSelections>(() => {
    const ordered = [...table].sort(
      (a, b) => b.pts - a.pts || b.w - a.w || a.team.localeCompare(b.team),
    )
    const orderedNames = Array.from(
      new Set([...ordered.map((row) => row.team), ...allTeamNames]),
    )
    const gA = orderedNames.filter((_, index) => index % 2 === 0).slice(0, 4)
    const gB = orderedNames.filter((_, index) => index % 2 === 1).slice(0, 4)
    while (gA.length < 4) gA.push("")
    while (gB.length < 4) gB.push("")

    return {
      final: "",
      sf1: "",
      sf2: "",
      qf1: gA[0],
      qf2: gB[0],
      qf3: gA[1],
      qf4: gB[1],
      qualifiers: orderedNames.slice(0, 8).concat(Array(8).fill("")).slice(0, 8),
      groups: [gA, gB],
    }
  }, [table, allTeamNames])

  const [selections, setSelections] = useState<TournamentSelections>(() => {
    try {
      const saved = localStorage.getItem("cricvault-series-selections")
      return saved ? JSON.parse(saved) : initialSelections
    } catch {
      return initialSelections
    }
  })

  useEffect(() => subscribeCloudData<TournamentSelections>("series", (online) => {
    if (online?.groups) setSelections((current) =>
      JSON.stringify(current) === JSON.stringify(online) ? current : online,
    )
  }), [])

  useEffect(() => {
    setSelections((current) => {
      const cleanValue = (value: string) => allTeamNames.includes(value) ? value : ""
      const sourceGroups = current.groups?.length ? current.groups : initialSelections.groups
      const groupCount = Math.max(1, sourceGroups.length)
      const groups = Array.from({ length: groupCount }, (_, groupIndex) => {
        const sourceTeams = sourceGroups[groupIndex]?.length
          ? sourceGroups[groupIndex]
          : initialSelections.groups[groupIndex]?.length
            ? initialSelections.groups[groupIndex]
            : [""]
        return sourceTeams.map(cleanValue)
      })
      const cleaned = {
        ...current,
        final: cleanValue(current.final),
        sf1: cleanValue(current.sf1),
        sf2: cleanValue(current.sf2),
        qf1: cleanValue(current.qf1) || initialSelections.qf1,
        qf2: cleanValue(current.qf2) || initialSelections.qf2,
        qf3: cleanValue(current.qf3) || initialSelections.qf3,
        qf4: cleanValue(current.qf4) || initialSelections.qf4,
        qualifiers: Array.from({ length: 8 }, (_, index) =>
          cleanValue(current.qualifiers?.[index] || initialSelections.qualifiers[index]),
        ),
        groups,
      }
      return JSON.stringify(cleaned) === JSON.stringify(current) ? current : cleaned
    })
  }, [allTeamNames, initialSelections])

  useEffect(() => {
    localStorage.setItem("cricvault-series-selections", JSON.stringify(selections))
    if (isAdmin) void saveCloudData("series", selections).catch(() => undefined)
  }, [selections, isAdmin])

  const updateSelection = (key: keyof Omit<TournamentSelections, "groups">, val: string) => {
    setSelections((prev) => ({ ...prev, [key]: val }))
  }

  const updateGroupTeam = (groupIdx: number, slotIdx: number, val: string) => {
    setSelections((prev) => {
      const newGroups = prev.groups.map((grp, gi) =>
        gi === groupIdx ? grp.map((t, ti) => (ti === slotIdx ? val : t)) : grp,
      )
      return { ...prev, groups: newGroups }
    })
  }

  const updateQualifier = (slotIndex: number, val: string) => {
    setSelections((current) => ({
      ...current,
      qualifiers: Array.from({ length: 8 }, (_, index) =>
        index === slotIndex ? val : current.qualifiers?.[index] || "",
      ),
    }))
  }

  const resetSelections = () => {
    setSelections(initialSelections)
  }
  const addGroup = () => setSelections((current) => ({
    ...current,
    groups: [...current.groups, [""]],
  }))
  const deleteGroup = (groupIndex: number) => setSelections((current) => ({
    ...current,
    groups: current.groups.length > 1
      ? current.groups.filter((_, index) => index !== groupIndex)
      : current.groups,
  }))
  const addTeamToGroup = (groupIndex: number) => setSelections((current) => ({
    ...current,
    groups: current.groups.map((group, index) => index === groupIndex ? [...group, ""] : group),
  }))
  const deleteTeamFromGroup = (groupIndex: number, teamIndex: number) => setSelections((current) => ({
    ...current,
    groups: current.groups.map((group, index) =>
      index === groupIndex && group.length > 1
        ? group.filter((_, slotIndex) => slotIndex !== teamIndex)
        : group,
    ),
  }))

  const qfSelections = [selections.qf1, selections.qf2, selections.qf3, selections.qf4]
  const qfOptions = (quarterIndex: number) => Array.from(new Set([
    qfSelections[quarterIndex],
    selections.qualifiers?.[quarterIndex * 2],
    selections.qualifiers?.[quarterIndex * 2 + 1],
  ].filter(Boolean)))
  const sf1Options = useMemo(() => Array.from(new Set([selections.qf1, selections.qf2, ...allTeamNames].filter(Boolean))), [selections.qf1, selections.qf2, allTeamNames])
  const sf2Options = useMemo(() => Array.from(new Set([selections.qf3, selections.qf4, ...allTeamNames].filter(Boolean))), [selections.qf3, selections.qf4, allTeamNames])
  const finalOptions = useMemo(() => Array.from(new Set([selections.sf1, selections.sf2, ...allTeamNames].filter(Boolean))), [selections.sf1, selections.sf2, allTeamNames])

  const groupLabels = selections.groups.map((_, index) => `GROUP ${String.fromCharCode(65 + index)}`)

  return (
    <main className="tb-page">
      {/* Stadium ambient effects */}
      <div className="tb-ambient" aria-hidden="true" />
      <div className="tb-spot tb-spot-l" aria-hidden="true" />
      <div className="tb-spot tb-spot-r" aria-hidden="true" />

      <section className="tb-stage">
        {/* ── Banner ── */}
        <header className="tb-banner-wrap">
          <div className="tb-wing tb-wing-l" />
          <div className="tb-hexagon">
            <small>DIAMOND PREMIER LEAGUE</small>
            <h1>DPL Tournament 6</h1>
          </div>
          <div className="tb-wing tb-wing-r" />
        </header>
        <div className="tb-ribbon">FOR GROUPS AND TEAMS</div>

        {/* ── Editor Toolbar ── */}
        <div className="tb-toolbar">
          <span>🎯 INTERACTIVE BRACKET & GROUP TEAM SELECTOR</span>
          {isAdmin && <div className="tb-admin-actions">
            <button onClick={addGroup} className="tb-reset-btn">+ Add group</button>
            <button onClick={resetSelections} className="tb-reset-btn">Reset to Standings</button>
          </div>}
        </div>
        {result && <div className="global-result-strip">LATEST RESULT · {result}</div>}

        {/* ── Bracket Section ── */}
        <section className="tb-bracket" aria-label="Tournament bracket">
          {/* SVG Connecting Flow Lines */}
          <svg
            className="tb-wires-svg"
            viewBox="0 0 1000 310"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* Final → Semis Bridge & Drops */}
            <line x1="500" y1="36" x2="500" y2="60" vectorEffect="non-scaling-stroke" />
            <line x1="250" y1="60" x2="750" y2="60" vectorEffect="non-scaling-stroke" />
            <line x1="250" y1="60" x2="250" y2="84" vectorEffect="non-scaling-stroke" />
            <line x1="750" y1="60" x2="750" y2="84" vectorEffect="non-scaling-stroke" />

            {/* SF1 → QF1 & QF2 Bridge & Drops */}
            <line x1="250" y1="120" x2="250" y2="144" vectorEffect="non-scaling-stroke" />
            <line x1="125" y1="144" x2="375" y2="144" vectorEffect="non-scaling-stroke" />
            <line x1="125" y1="144" x2="125" y2="168" vectorEffect="non-scaling-stroke" />
            <line x1="375" y1="144" x2="375" y2="168" vectorEffect="non-scaling-stroke" />

            {/* SF2 → QF3 & QF4 Bridge & Drops */}
            <line x1="750" y1="120" x2="750" y2="144" vectorEffect="non-scaling-stroke" />
            <line x1="625" y1="144" x2="875" y2="144" vectorEffect="non-scaling-stroke" />
            <line x1="625" y1="144" x2="625" y2="168" vectorEffect="non-scaling-stroke" />
            <line x1="875" y1="144" x2="875" y2="168" vectorEffect="non-scaling-stroke" />

            {/* QF1..4 → Groups Vertical Drops */}
            {[125, 375, 625, 875].map((quarterCenter, index) => {
              const left = quarterCenter - 62.5
              const right = quarterCenter + 62.5
              return <g key={quarterCenter} className={`tb-qualifier-wire tb-qualifier-wire-${index + 1}`}>
                <line x1={quarterCenter} y1="204" x2={quarterCenter} y2="234" vectorEffect="non-scaling-stroke" />
                <line x1={left} y1="234" x2={right} y2="234" vectorEffect="non-scaling-stroke" />
                <line x1={left} y1="234" x2={left} y2="264" vectorEffect="non-scaling-stroke" />
                <line x1={right} y1="234" x2={right} y2="264" vectorEffect="non-scaling-stroke" />
              </g>
            })}
          </svg>

          {/* Final tier */}
          <div className="tb-tier tb-tier-final">
            <BracketSlot
              flagLabel="FLAG"
              value={selections.final}
              placeholder="TOURNAMENT CHAMPION"
              options={finalOptions}
              teams={teams}
              disabled={!isAdmin}
              tone="red"
              onChange={(val) => updateSelection("final", val)}
            />
          </div>

          {/* Semi-final tier */}
          <div className="tb-tier tb-tier-semi">
            <div className="tb-semi-cell">
              <BracketSlot
                flagLabel="FLAG"
                value={selections.sf1}
                placeholder="SEMI-FINAL 1"
                options={sf1Options}
                teams={teams}
                disabled={!isAdmin}
                tone="orange"
                onChange={(val) => updateSelection("sf1", val)}
              />
            </div>
            <div className="tb-semi-cell">
              <BracketSlot
                flagLabel="FLAG"
                value={selections.sf2}
                placeholder="SEMI-FINAL 2"
                options={sf2Options}
                teams={teams}
                disabled={!isAdmin}
                tone="orange"
                onChange={(val) => updateSelection("sf2", val)}
              />
            </div>
          </div>

          {/* Quarter-final tier */}
          <div className="tb-tier tb-tier-qf">
            <BracketSlot
              flagLabel="FLAG"
              value={selections.qf1}
              placeholder="QUARTER-FINAL 1"
              options={qfOptions(0)}
              teams={teams}
              disabled={!isAdmin}
              tone="green"
              onChange={(val) => updateSelection("qf1", val)}
            />
            <BracketSlot
              flagLabel="FLAG"
              value={selections.qf2}
              placeholder="QUARTER-FINAL 2"
              options={qfOptions(1)}
              teams={teams}
              disabled={!isAdmin}
              tone="green"
              onChange={(val) => updateSelection("qf2", val)}
            />
            <BracketSlot
              flagLabel="FLAG"
              value={selections.qf3}
              placeholder="QUARTER-FINAL 3"
              options={qfOptions(2)}
              teams={teams}
              disabled={!isAdmin}
              tone="green"
              onChange={(val) => updateSelection("qf3", val)}
            />
            <BracketSlot
              flagLabel="FLAG"
              value={selections.qf4}
              placeholder="QUARTER-FINAL 4"
              options={qfOptions(3)}
              teams={teams}
              disabled={!isAdmin}
              tone="green"
              onChange={(val) => updateSelection("qf4", val)}
            />
          </div>
          <div className="tb-tier tb-tier-qualifiers" aria-label="Quarter-final qualifying matches">
            {Array.from({ length: 4 }, (_, quarterIndex) => (
              <div className="tb-qualifier-pair" key={quarterIndex}>
                {[0, 1].map((pairIndex) => {
                  const slotIndex = quarterIndex * 2 + pairIndex
                  return <BracketSlot
                    key={slotIndex}
                    flagLabel="FLAG"
                    value={selections.qualifiers?.[slotIndex] || ""}
                    placeholder={`QUALIFIER ${slotIndex + 1}`}
                    options={allTeamNames}
                    teams={teams}
                    disabled={!isAdmin}
                    tone="green"
                    onChange={(val) => updateQualifier(slotIndex, val)}
                  />
                })}
              </div>
            ))}
          </div>
        </section>

        {/* ── Groups Section ── */}
        <section className="tb-groups" aria-label="Tournament groups">
          {groupLabels.map((label, gi) => {
            const groupTeams = selections.groups[gi] || ["", "", "", ""]
            return (
              <article className="tb-group" key={label}>
                <h2 className="tb-group-title">{label}{isAdmin && selections.groups.length > 1 && <button type="button" onClick={() => deleteGroup(gi)} aria-label={`Delete ${label}`}>×</button>}</h2>
                <div className="tb-group-list">
                  {groupTeams.map((teamName, ti) => {
                    const selectedTeam = teams.find((team) => team.name === teamName)
                    return <div
                      className={`tb-group-row ${!teamName ? "tb-row-empty" : ""}`}
                      key={ti}
                      style={
                        {
                          "--row-accent":
                            TABLE_COLORS[(gi * 4 + ti) % TABLE_COLORS.length],
                        } as React.CSSProperties
                      }
                    >
                      <span
                        className="tb-row-flag"
                        style={{
                          background: `linear-gradient(180deg,#d42a2a,#8e0c10)`,
                        }}
                      >
                        {selectedTeam?.logo ? (
                          <img src={selectedTeam.logo} alt={`${selectedTeam.name} logo`} />
                        ) : (
                          selectedTeam?.code || "—"
                        )}
                      </span>
                      <div className="tb-row-select-wrap">
                        <select
                          disabled={!isAdmin}
                          value={teamName}
                          onChange={(e) => updateGroupTeam(gi, ti, e.target.value)}
                          className="tb-row-select"
                          aria-label={`${label} Place ${ti + 1}`}
                        >
                          <option value="">NAME OF TEAM</option>
                          {allTeamNames.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <span className="tb-chevron-small">▼</span>
                      </div>
                      {isAdmin && groupTeams.length > 1 && <button type="button" className="tb-remove-team" onClick={() => deleteTeamFromGroup(gi, ti)} aria-label={`Remove team slot ${ti + 1} from ${label}`}>×</button>}
                    </div>
                  })}
                </div>
                {isAdmin && <button type="button" className="tb-add-team" onClick={() => addTeamToGroup(gi)}>+ Add team</button>}
              </article>
            )
          })}
        </section>
      </section>

      {/* Grass Overlay at Bottom */}
      <div className="tb-grass" aria-hidden="true" />
    </main>
  )
}


function LegacyPointsScreen({
  table,
  onNavigate,
}: {
  table: Standing[]
  onNavigate: (screen: Screen) => void
}) {
  const ranked = [...table].sort(
    (a, b) =>
      b.pts - a.pts ||
      b.forRuns / (b.forBalls / 6) -
        b.againstRuns / (b.againstBalls / 6) -
        (a.forRuns / (a.forBalls / 6) - a.againstRuns / (a.againstBalls / 6)),
  )
  return (
    <main className="points-page">
      <section className="points-hero">
        <div className="points-kicker">CRICVAULT PREMIER LEAGUE · 2026</div>
        <h1>
          Points <em>Table</em>
        </h1>
        <p>
          Live tournament standings calculated from completed matches. Teams are
          ranked by points, then Net Run Rate.
        </p>
        <div className="points-actions">
          <button onClick={() => onNavigate("scoring")}>
            Open live scorer →
          </button>
          <button onClick={() => onNavigate("home")}>← Home</button>
        </div>
      </section>
      <section className="points-card">
        <div className="points-card-head">
          <div>
            <span>LEAGUE STANDINGS</span>
            <h2>CricVault Premier League 2026</h2>
          </div>
          <div>
            <i /> AUTO-UPDATED
          </div>
        </div>
        <div className="points-table-wrap">
          <table>
            <thead>
              <tr>
                <th>POS</th>
                <th>TEAM</th>
                <th>M</th>
                <th>W</th>
                <th>L</th>
                <th>T</th>
                <th>NR</th>
                <th>NRR</th>
                <th>PTS</th>
                <th>FORM</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row, index) => {
                const nrr =
                  row.forRuns / (row.forBalls / 6) -
                  row.againstRuns / (row.againstBalls / 6)
                return (
                  <tr className={index < 4 ? "qualifies" : ""} key={row.team}>
                    <td>
                      <b>{index + 1}</b>
                    </td>
                    <td>
                      <span
                        className="points-logo"
                        style={
                          {
                            "--logo": TABLE_COLORS[index % TABLE_COLORS.length],
                          } as React.CSSProperties
                        }
                      >
                        {row.team
                          .split(" ")
                          .map((w) => w[0])
                          .join("")}
                      </span>
                      <strong>{row.team}</strong>
                    </td>
                    <td>{row.p}</td>
                    <td>{row.w}</td>
                    <td>{row.l}</td>
                    <td>{row.t}</td>
                    <td>{row.nr}</td>
                    <td className={nrr >= 0 ? "positive" : "negative"}>
                      {nrr >= 0 ? "+" : ""}
                      {nrr.toFixed(3)}
                    </td>
                    <td>
                      <b>{row.pts}</b>
                    </td>
                    <td>
                      <span className="form-dot win">W</span>
                      <span className="form-dot win">W</span>
                      <span className="form-dot loss">L</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mobile-points-list">
          {ranked.map((row, index) => {
            const nrr =
              row.forRuns / (row.forBalls / 6) -
              row.againstRuns / (row.againstBalls / 6)
            return (
              <article className={index < 4 ? "qualifies" : ""} key={row.team}>
                <div className="mobile-team">
                  <b>{index + 1}</b>
                  <span
                    className="points-logo"
                    style={
                      {
                        "--logo": TABLE_COLORS[index % TABLE_COLORS.length],
                      } as React.CSSProperties
                    }
                  >
                    {row.team
                      .split(" ")
                      .map((w) => w[0])
                      .join("")}
                  </span>
                  <strong>{row.team}</strong>
                  <em>{row.pts} PTS</em>
                </div>
                <div className="mobile-stats">
                  <Metric label="M" value={row.p} />
                  <Metric label="W" value={row.w} />
                  <Metric label="L" value={row.l} />
                  <Metric label="T" value={row.t} />
                  <Metric label="NR" value={row.nr} />
                  <Metric
                    label="NRR"
                    value={`${nrr >= 0 ? "+" : ""}${nrr.toFixed(3)}`}
                  />
                </div>
              </article>
            )
          })}
        </div>
        <div className="points-card-foot">
          <span>
            <i /> Top four qualify for the playoffs
          </span>
          <span>Last updated from scoring engine</span>
        </div>
      </section>
    </main>
  )
}

function PointsScreen({ table, teams, result, isAdmin, onNavigate, onChangeTable }: { table: Standing[]; teams: Team[]; result: string; isAdmin: boolean; onNavigate: (screen: Screen) => void; onChangeTable: (table: Standing[]) => void }) {
  const [editing, setEditing] = useState(false)
  const runRate = (row: Standing) => row.forBalls ? row.forRuns / (row.forBalls / 6) : 0
  const ranked = [...table].sort((a, b) => b.w - a.w || runRate(b) - runRate(a))
  const editStanding = (teamName: string, field: "p" | "w" | "l" | "rr", value: number) => {
    onChangeTable(table.map((row) => {
      if (row.team !== teamName) return row
      if (field === "rr") {
        const balls = row.forBalls || 6
        return { ...row, forBalls: balls, forRuns: Math.max(0, value) * (balls / 6) }
      }
      return { ...row, [field]: Math.max(0, Math.round(value || 0)) }
    }))
  }
  return <main className="points-page imported-points-page">
    {result && <div className="global-result-strip points-result-strip">LATEST RESULT · {result}</div>}
    <section className="points-utility"><div><span>TOURNAMENT CENTER</span><strong>Live standings from the scoring engine</strong></div><div className="points-actions">{isAdmin && <button onClick={() => setEditing((value) => !value)}>{editing ? "Finish editing" : "Edit standings"}</button>}<button onClick={() => onNavigate("home")}>← Home</button></div></section>
    <section className="imported-points-board">
      <div className="import-board-title"><h1>Points Table</h1><h2>Diamond Premier League 6</h2></div>
      <div className="imported-table"><div className="imported-table-head"><span>Team</span><span>M</span><span>W</span><span>L</span><span>RR</span></div><div className="imported-table-rows">
        {ranked.map((row,index) => { const rr=runRate(row); const team=teams.find((item)=>item.name===row.team); const initials=row.team.split(" ").map(word=>word[0]).join(""); const cell=(field:"p"|"w"|"l"|"rr",value:number)=><b>{editing&&isAdmin?<input className="standing-editor" type="number" min="0" step={field==="rr"?"0.01":"1"} value={field==="rr"?value.toFixed(2):value} onChange={(event)=>editStanding(row.team,field,Number(event.target.value))}/>:field==="rr"?value.toFixed(2):value}</b>; return <div className={`imported-row ${editing&&isAdmin?"editing":""}`} key={row.team}><div className="imported-team" style={{"--team-color":team?.color || TABLE_COLORS[index%TABLE_COLORS.length]} as React.CSSProperties}><i/><div className="logo-capsule">{team?.logo ? <img src={team.logo} alt={`${team.name} logo`} /> : <span>{team?.code || initials}</span>}</div><strong>{row.team}</strong></div>{cell("p",row.p)}{cell("w",row.w)}{cell("l",row.l)}{cell("rr",rr)}</div> })}
      </div></div>
      <div className="import-board-foot"><span>◉ CricVault Match Center</span><span><i/> AUTO-UPDATED · TOP 4 QUALIFY</span></div>
    </section>
  </main>
}

function ChoiceModal({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose?: () => void
}) {
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose()
        }
      }}
    >
      <div className="choice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="panel-title">
          <h2>{title}</h2>
          {onClose && <button onClick={onClose}>×</button>}
        </div>
        {children}
      </div>
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    const params = new URLSearchParams(window.location.search)
    if (/^\/open\/live-score\/[A-Za-z0-9_-]{1,80}\/?$/.test(window.location.pathname)) return "widgets"
    if (params.has("widget")) return "widgets"
    const requested = params.get("screen") as Screen | null
    return requested && ["home", "matches", "series", "teams", "players", "widgets", "scoring", "points", "admin"].includes(requested) ? requested : "home"
  })
  const [routeLeaving, setRouteLeaving] = useState(false)
  const routeTimeoutRef = useRef<number | null>(null)
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [adminRevision, setAdminRevision] = useState(0)
  useEffect(() => () => {
    if (routeTimeoutRef.current) window.clearTimeout(routeTimeoutRef.current)
  }, [])
  const admin = useMemo(() => isLeagueAdmin(user), [user, adminRevision])
  const [overs, setOvers] = useState(20)
  const [teamProfiles, setTeamProfiles] = useState<SharedTeamProfile[]>(() =>
    DEFAULT_TEAM_PROFILES,
  )
  const [teamsLoaded, setTeamsLoaded] = useState(false)
  const [scheduledMatches, setScheduledMatches] = useState<LeagueMatch[]>([])
  const scoringTeams = useMemo<Team[]>(() => {
    const mapped = teamProfiles.map((profile) => {
      const savedPlayers = Array.isArray(profile.players) ? profile.players : []
      const namedPlayers = savedPlayers
        .map((player) =>
          (typeof player === "string" ? player : player?.name || "").trim(),
        )
        .filter(Boolean)
      const players = namedPlayers
      return {
        code: profile.code || profile.name.slice(0, 2).toUpperCase(),
        name: profile.name,
        color: profile.color || "#91e521",
        logo: profile.logo,
        players,
        playerPhotos: Object.fromEntries(
          savedPlayers
            .filter(
              (player) =>
                typeof player !== "string" && player?.name?.trim() && player.photo,
            )
            .map((player) => [player.name.trim(), player.photo]),
        ),
      }
    })
    const unique = mapped.filter(
      (team, index) => mapped.findIndex((item) => item.name === team.name) === index,
    )
    return unique
  }, [teamProfiles])
  const [matchReady, setMatchReady] = useState(
    () => localStorage.getItem("cricvault-match-ready") === "true",
  )
  const [state, setState] = useState<ScoreState>(INITIAL)
  const [history, setHistory] = useState<ScoreState[]>([])
  const [inningsResultOpen, setInningsResultOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const previousInnings = useRef(state.innings)
  const previousProfiles = useRef<SharedTeamProfile[]>(DEFAULT_TEAM_PROFILES)
  const liveScoreReady = Boolean(
    state.striker &&
    state.nonStriker &&
    state.bowler &&
    state.batters?.[state.striker] &&
    state.batters?.[state.nonStriker] &&
    state.bowlers?.[state.bowler],
  )

  useEffect(() => observeFirebaseUser((nextUser) => {
    setUser(nextUser)
    setAdminRevision((revision) => revision + 1)
  }), [])

  useEffect(() => subscribeCloudData<LeagueMatch[] | Record<string, LeagueMatch>>(
    "matches",
    (onlineMatches) => setScheduledMatches(
      Array.isArray(onlineMatches)
        ? onlineMatches.filter(Boolean)
        : Object.values(onlineMatches || {}),
    ),
  ), [])

  useEffect(() => subscribeTeamProfiles((onlineTeams) => {
    setTeamProfiles((current) =>
      JSON.stringify(current) === JSON.stringify(onlineTeams) ? current : onlineTeams,
    )
    setTeamsLoaded(true)
  }), [])

  useEffect(() => subscribeCloudData<Standing[] | null>("standings", (onlineTable) => {
    const currentNames = new Set(scoringTeams.map((team) => team.name))
    const validRows = Array.isArray(onlineTable)
      ? onlineTable.filter((row) => currentNames.has(row.team))
      : []
    const nextTable = dedupeStandings(validRows)
    setState((current) =>
      JSON.stringify(current.table) === JSON.stringify(nextTable)
        ? current
        : { ...current, table: nextTable },
    )
  }), [scoringTeams])

  useEffect(() => {
    if (admin) return
    return subscribeCloudData<ScoreState | null>("liveScore", (onlineScore) => {
      if (!onlineScore) return
      setState((current) => ({ ...current, ...onlineScore, table: current.table }))
    })
  }, [admin])

  useEffect(() => {
    const syncTeams = (event: Event) => {
      const updated = (event as CustomEvent<SharedTeamProfile[]>).detail
      if (Array.isArray(updated)) setTeamProfiles(updated)
    }
    window.addEventListener(TEAM_UPDATE_EVENT, syncTeams)
    return () => window.removeEventListener(TEAM_UPDATE_EVENT, syncTeams)
  }, [])

  useEffect(() => {
    const previous = previousProfiles.current
    const renamed = new Map<string, string>()
    teamProfiles.forEach((profile) => {
      const old = previous.find((item) => item.id === profile.id)
      if (old && old.name !== profile.name) renamed.set(old.name, profile.name)
    })
    previousProfiles.current = teamProfiles

    setState((current) => {
      const existingNames = new Set(
        current.table.map((row) => renamed.get(row.team) || row.team),
      )
      const missingRows = scoringTeams
        .filter((team) => !existingNames.has(team.name))
        .map(blankStanding)
      const activeNames = new Set(scoringTeams.map((team) => team.name))
      const nextTable = current.table
        .map((row) => ({ ...row, team: renamed.get(row.team) || row.team }))
        .filter((row) => activeNames.has(row.team))
      const renamedBatting = renamed.get(current.batting) || current.batting
      const renamedBowling = renamed.get(current.bowling) || current.bowling
      const nextBatting = activeNames.has(renamedBatting) ? renamedBatting : ""
      const nextBowling = activeNames.has(renamedBowling) ? renamedBowling : ""
      if (
        !renamed.size &&
        !missingRows.length && nextTable.length === current.table.length &&
        nextBatting === current.batting &&
        nextBowling === current.bowling
      ) return current
      return {
        ...current,
        batting: nextBatting,
        bowling: nextBowling,
        summaries: current.summaries
          .map((summary) => ({ ...summary, team: renamed.get(summary.team) || summary.team }))
          .filter((summary) => activeNames.has(summary.team)),
        table: dedupeStandings([...nextTable, ...missingRows]),
      }
    })
  }, [teamProfiles, scoringTeams])
  useEffect(() => {
    localStorage.setItem("cricvault-score", JSON.stringify(state))
    if (matchReady && liveScoreReady && !state.result) {
      localStorage.setItem(
        "cricvault-active-session",
        JSON.stringify({
          state,
          history,
          matchReady: true,
          overs,
          updatedAt: Date.now(),
        }),
      )
    } else if (state.result) {
      localStorage.removeItem("cricvault-active-session")
    }
  }, [state, history, matchReady, overs, liveScoreReady])

  const handleResumeMatch = () => {
    try {
      const savedRaw = localStorage.getItem("cricvault-active-session")
      if (!savedRaw) return
      const session = JSON.parse(savedRaw)
      if (session.state && session.matchReady) {
        setState(session.state)
        if (Array.isArray(session.history)) setHistory(session.history)
        if (session.overs) setOvers(session.overs)
        setMatchReady(true)
        void saveCloudData("liveScore", {
          ...session.state,
          matchOvers: session.overs || 20,
          updatedAt: Date.now(),
        }).catch(() => undefined)
      }
    } catch (err) {
      console.error("Resume failed:", err)
    }
  }

  const handleResumeMatchRecord = (match: LeagueMatch) => {
    try {
      const innings = match.record?.innings || []
      const first = innings[0]
      const second = innings[1] || first || { team: match.teamA, runs: 0, wickets: 0, balls: 0 }

      const derived1 = deriveScorecards(1, match.record?.events)
      const derived2 = deriveScorecards(2, match.record?.events)

      const battersObj: Record<string, Batter> = {}
      const bowlersObj: Record<string, Bowler> = {}

      const secondBatting = second.batting?.length ? second.batting : derived2.batting
      const secondBowling = second.bowling?.length ? second.bowling : derived2.bowling

      secondBatting.forEach((b: BattingLine) => {
        battersObj[b.name] = { ...b, dismissal: b.dismissal || (b.out ? "out" : "not out") }
      })
      secondBowling.forEach((bw: BowlingLine) => {
        bowlersObj[bw.name] = { ...bw }
      })

      const loadedState: ScoreState = {
        matchId: match.id,
        innings: innings.length || 1,
        batting: second.team || match.teamA,
        bowling: innings.length > 1 ? first?.team || match.teamB : match.teamB,
        runs: second.runs || 0,
        wickets: second.wickets || 0,
        balls: second.balls || 0,
        striker: secondBatting[0]?.name || "Batter 1",
        nonStriker: secondBatting[1]?.name || "Batter 2",
        bowler: secondBowling[0]?.name || "Bowler 1",
        target: match.record?.target ?? null,
        freeHit: false,
        partnershipRuns: 0,
        partnershipBalls: 0,
        extras: second.extras || { wd: 0, nb: 0, b: 0, lb: 0 },
        batters: battersObj,
        bowlers: bowlersObj,
        overMarks: [],
        fall: [],
        result: "",
        needsBowler: false,
        summaries: first
          ? [
              {
                team: first.team,
                runs: first.runs,
                wickets: first.wickets,
                balls: first.balls,
                extras: first.extras,
                batting: first.batting?.length ? first.batting : derived1.batting,
                bowling: first.bowling?.length ? first.bowling : derived1.bowling,
              },
            ]
          : [],
        events: (match.record?.events || []).map((e) => ({
          id: e.id,
          innings: e.innings || 1,
          over: e.over || "0.1",
          mark: e.mark || "0",
          tone: "neutral",
          text: e.text || "Delivery",
          legal: e.legal ?? true,
          runs: e.runs || 0,
        })),
        table: state.table,
      }

      setState(loadedState)
      setMatchReady(true)
      setScreen("scoring")
      void saveCloudData("liveScore", { ...loadedState, matchOvers: overs, updatedAt: Date.now() }).catch(() => undefined)
    } catch (err) {
      console.error("Failed to resume match record:", err)
    }
  }
  useEffect(() => {
    if (previousInnings.current === 1 && state.innings === 2 && state.summaries[0]) {
      setInningsResultOpen(true)
    }
    previousInnings.current = state.innings
  }, [state.innings, state.matchId, state.summaries.length])
  useEffect(() => {
    if (teamsLoaded && scoringTeams.length < 2) setMatchReady(false)
  }, [teamsLoaded, scoringTeams.length])
  useEffect(() => {
    if (!admin || !teamsLoaded) return
    const timer = window.setTimeout(() => {
      void saveCloudData("liveScore", { ...state, matchOvers: overs, updatedAt: Date.now() }).catch(() => undefined)
      void saveCloudData("standings", state.table).catch(() => undefined)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [state, admin, teamsLoaded, overs])
  useEffect(() => {
    if (!admin || !state.result || !state.matchId) return
    void saveCloudData(`results/${state.matchId}`, {
      id: state.matchId,
      result: state.result,
      batting: state.batting,
      bowling: state.bowling,
      innings: state.summaries,
      target: state.target,
      events: state.events,
      standings: state.table,
      completedAt: Date.now(),
    }).catch(() => undefined)

    const battingId = teamProfiles.find((team) => team.name === state.batting)?.id
    const bowlingId = teamProfiles.find((team) => team.name === state.bowling)?.id
    const winnerId = teamProfiles.find((team) => state.result.startsWith(`${team.name} won by`))?.id
    const scheduled = scheduledMatches.find((match) =>
      !match.result &&
      ((match.teamA === battingId && match.teamB === bowlingId) ||
        (match.teamA === bowlingId && match.teamB === battingId)),
    )
    if (scheduled) {
      const record = {
        result: state.result,
        innings: state.summaries,
        target: state.target,
        events: state.events,
        completedAt: Date.now(),
      }
      const updated = scheduledMatches.map((match) =>
        match.id === scheduled.id ? { ...match, result: state.result, winnerId, record } : match,
      )
      setScheduledMatches(updated)
      void saveCloudData("matches", updated).catch(() => undefined)
    }
  }, [state.result, state.matchId, admin])
  useEffect(() => {
    localStorage.setItem("cricvault-match-ready", String(matchReady))
  }, [matchReady])
  const remainingBatters = useMemo(
    () =>
      Object.values(state.batters).filter(
        (b) =>
          !b.out && b.name !== state.striker && b.name !== state.nonStriker,
      ),
    [state],
  )

  const commit = (mutate: (draft: ScoreState) => void) => {
    if (state.result || state.needsBowler) return
    setHistory((h) => [...h.slice(-39), clone(state)])
    setState((prev) => {
      const draft = clone(prev)
      mutate(draft)
      finishDelivery(draft)
      return draft
    })
  }

  const addEvent = (
    draft: ScoreState,
    mark: string,
    tone: string,
    text: string,
    legal: boolean,
    runs: number,
  ) => {
    const ballNo = legal ? draft.balls + 1 : draft.balls
    draft.events.unshift({
      id: Date.now() + Math.random(),
      innings: draft.innings,
      over: oversText(ballNo),
      mark,
      tone,
      text,
      legal,
      runs,
    })
    draft.overMarks.push(mark)
    if (draft.overMarks.length > 10) draft.overMarks.shift()
  }

  const swap = (draft: ScoreState) => {
    ;[draft.striker, draft.nonStriker] = [draft.nonStriker, draft.striker]
  }

  const finishDelivery = (draft: ScoreState) => {
    const inningsOver =
      draft.wickets >= 10 ||
      draft.balls >= overs * 6 ||
      (draft.innings === 2 &&
        draft.target !== null &&
        draft.runs >= draft.target)
    if (inningsOver) {
      if (draft.innings === 1) {
        draft.summaries.push(inningsSnapshot(draft))
        const oldBatting = draft.batting
        draft.innings = 2
        draft.batting = draft.bowling
        draft.bowling = oldBatting
        draft.target = draft.runs + 1
        draft.runs = 0
        draft.wickets = 0
        draft.balls = 0
        draft.freeHit = false
        draft.partnershipRuns = 0
        draft.partnershipBalls = 0
        draft.extras = { wd: 0, nb: 0, b: 0, lb: 0 }
        draft.fall = []
        draft.overMarks = []
        const battingTeam = teamByName(draft.batting, scoringTeams),
          bowlingTeam = teamByName(draft.bowling, scoringTeams)
        draft.batters = freshBatters(battingTeam)
        draft.bowlers = freshBowlers(bowlingTeam)
        draft.striker = battingTeam.players[0]
        draft.nonStriker = battingTeam.players[1]
        draft.bowler = bowlingTeam.players[0]
      } else {
        const first = draft.summaries[0]
        if (draft.runs >= (draft.target || 0))
          draft.result = `${draft.batting} won by ${10 - draft.wickets} wickets`
        else if (draft.runs === first.runs) draft.result = "Match tied"
        else
          draft.result = `${draft.bowling} won by ${first.runs - draft.runs} runs`
        const second = inningsSnapshot(draft)
        const winner = draft.result.includes(" won by ")
          ? draft.result.startsWith(draft.batting)
            ? draft.batting
            : draft.bowling
          : ""
        draft.summaries.push(second)
        draft.table = applyCompletedMatch(
          draft.table,
          nrrSummary(first, overs * 6),
          nrrSummary(second, overs * 6),
          winner,
        )
      }
      return
    }
    if (draft.balls > 0 && draft.balls % 6 === 0) {
      swap(draft)
      draft.needsBowler = true
      draft.overMarks = []
    }
  }

  const scoreRuns = (runs: number) =>
    commit((draft) => {
      const batter = draft.batters[draft.striker],
        bowler = draft.bowlers[draft.bowler]
      batter.runs += runs
      batter.balls++
      if (runs === 4) batter.fours++
      if (runs === 6) batter.sixes++
      bowler.runs += runs
      bowler.balls++
      draft.runs += runs
      draft.balls++
      draft.partnershipRuns += runs
      draft.partnershipBalls++
      draft.freeHit = false
      addEvent(
        draft,
        String(runs),
        runs >= 4 ? "green" : "neutral",
        `${draft.bowler} to ${draft.striker}, ${
          runs === 0 ? "dot ball" : `${runs} run${runs === 1 ? "" : "s"}`
        }.`,
        true,
        runs,
      )
      if (runs % 2 === 1) swap(draft)
    })

  const scoreExtra = (type: "wd" | "nb" | "b" | "lb", amount: number) => {
    commit((draft) => {
      const bowler = draft.bowlers[draft.bowler],
        batter = draft.batters[draft.striker]
      const isIllegal = type === "wd" || type === "nb"
      const total = isIllegal ? amount + 1 : amount
      draft.runs += total
      draft.extras[type] += total
      draft.partnershipRuns += total
      if (type === "wd" || type === "nb") bowler.runs += total
      if (!isIllegal) {
        draft.balls++
        bowler.balls++
        batter.balls++
        draft.partnershipBalls++
      }
      if (type === "nb") {
        batter.runs += amount
        if (amount === 4) batter.fours++
        if (amount === 6) batter.sixes++
        draft.freeHit = true
      } else if (!isIllegal) draft.freeHit = false
      addEvent(
        draft,
        `${type.toUpperCase()}${total}`,
        "amber",
        `${draft.bowler} to ${draft.striker}, ${total} ${type.toUpperCase()} extra${
          total === 1 ? "" : "s"
        }.`,
        !isIllegal,
        total,
      )
      const runningRuns = isIllegal ? amount : total
      if (runningRuns % 2 === 1) swap(draft)
    })
  }

  const confirmWicket = (
    wType: string,
    fielderName: string,
    nextBatterName: string,
  ) => {
    if (
      (!nextBatterName && state.wickets < 9) ||
      (["Caught", "Run out", "Stumped"].includes(wType) && !fielderName)
    )
      return
    commit((draft) => {
      const dismissed = draft.batters[draft.striker],
        bowler = draft.bowlers[draft.bowler]
      const assisted =
        ["Caught", "Run out", "Stumped"].includes(wType) && fielderName
          ? `${wType} (${fielderName})`
          : wType
      dismissed.out = true
      dismissed.dismissal = assisted
      dismissed.balls++
      draft.balls++
      draft.wickets++
      draft.partnershipBalls++
      bowler.balls++
      if (wType !== "Run out") bowler.wickets++
      draft.fall.push(`${draft.wickets}-${draft.runs}`)
      addEvent(
        draft,
        "W",
        "red",
        `${draft.bowler} to ${draft.striker}, OUT — ${assisted}.`,
        true,
        0,
      )
      draft.freeHit = false
      draft.partnershipRuns = 0
      draft.partnershipBalls = 0
      if (draft.wickets < 10) draft.striker = nextBatterName
    })
  }

  const changeBowler = (name: string) =>
    setState((prev) => ({ ...prev, bowler: name, needsBowler: false }))
  const bowlerOptions = Object.values(state.bowlers).filter(
    (b) => b.name !== state.bowler && b.balls < (overs / 5) * 6,
  )
  const startMatch = ({
    teamA,
    teamB,
    overs: matchOvers,
    toss,
    decision,
    striker,
    nonStriker,
    bowler,
  }: {
    teamA: string
    teamB: string
    overs: number
    toss: string
    decision: string
    striker: string
    nonStriker: string
    bowler: string
  }) => {
    setOvers(matchOvers)
    const batting = decision === "Bat" ? toss : toss === teamA ? teamB : teamA
    const bowling = batting === teamA ? teamB : teamA
    const bt = teamByName(batting, scoringTeams),
      bw = teamByName(bowling, scoringTeams)
    const next = clone(INITIAL)
    Object.assign(next, {
      matchId: crypto.randomUUID(),
      batting,
      bowling,
      table: state.table,
      striker,
      nonStriker,
      bowler,
      batters: freshBatters(bt),
      bowlers: freshBowlers(bw),
    })
    setState(next)
    setHistory([])
    setMatchReady(true)
  }

  const swapBattingPlayers = () => {
    if (state.result) return
    setHistory((current) => [...current.slice(-39), clone(state)])
    setState((current) => ({
      ...current,
      striker: current.nonStriker,
      nonStriker: current.striker,
    }))
  }

  const endMatch = () => {
    if (state.result || !window.confirm("End this match now? Scoring controls will be locked.")) return
    setHistory((current) => [...current.slice(-39), clone(state)])
    setState((current) => {
      const draft = clone(current)
      if (draft.innings === 2 && draft.summaries[0]) {
        const first = draft.summaries[0]
        const second = inningsSnapshot(draft)
        let winner = ""
        if (second.runs > first.runs) {
          winner = second.team
          draft.result = `${second.team} won by ${10 - second.wickets} wickets`
        } else if (second.runs < first.runs) {
          winner = first.team
          draft.result = `${first.team} won by ${first.runs - second.runs} runs`
        } else {
          draft.result = "Match tied"
        }
        draft.summaries.push(second)
        draft.table = applyCompletedMatch(
          draft.table,
          nrrSummary(first, overs * 6),
          nrrSummary(second, overs * 6),
          winner,
        )
      } else {
        if (!draft.summaries.length) draft.summaries.push(inningsSnapshot(draft))
        draft.result = `No result · ${draft.batting} ${draft.runs}/${draft.wickets} (${oversText(draft.balls)})`
        draft.table = draft.table.map((row) =>
          row.team === draft.batting || row.team === draft.bowling
            ? { ...row, p: row.p + 1, nr: row.nr + 1, pts: row.pts + 1 }
            : row,
        )
      }
      return draft
    })
  }

  const navigate = (next: Screen) => {
    if (next === screen) {
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }
    if (routeTimeoutRef.current) window.clearTimeout(routeTimeoutRef.current)
    setRouteLeaving(true)
    routeTimeoutRef.current = window.setTimeout(() => {
      setScreen(next)
      setRouteLeaving(false)
      window.scrollTo({ top: 0, behavior: "auto" })
      routeTimeoutRef.current = null
    }, 160)
  }
  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle()
    } catch (error) {
      alert(error instanceof Error ? error.message : "Google sign-in could not be completed.")
    }
  }
  return (
    <div className={`scoring-app screen-${screen}`}>
      <Navbar screen={screen} onNavigate={navigate} user={user} isAdmin={admin} onLogin={handleGoogleLogin} onLogout={() => void logoutFirebase()} />
      <div key={screen} className={`route-stage ${routeLeaving ? "route-leaving" : ""}`}>
      {screen === "home" && <HomeScreen onNavigate={navigate} isAdmin={admin} />}
      {screen === "matches" && (
        <Suspense fallback={<main className="players-loading">Loading DPL 6 match center…</main>}>
          <LazyMatchesScreen teams={teamProfiles} user={user} isAdmin={admin} onLogin={handleGoogleLogin} onResumeMatch={handleResumeMatchRecord} />
        </Suspense>
      )}
      {screen === "series" && <SeriesScreen table={state.table} teams={scoringTeams} result={state.result} isAdmin={admin} />}
      {screen === "teams" && (
        <Suspense fallback={<main className="teams-loading">Loading team center…</main>}>
          <LazyTeamsScreen isAdmin={admin} />
        </Suspense>
      )}
      {screen === "players" && (
        <Suspense fallback={<main className="players-loading">Loading DPL 6 players…</main>}>
          <LazyPlayersScreen user={user} isAdmin={admin} onLogin={handleGoogleLogin} />
        </Suspense>
      )}
      {screen === "widgets" && <WidgetsScreen score={state} teams={scoringTeams} matchOvers={overs} />}
      {screen === "admin" && <Suspense fallback={<main className="players-loading">Loading access controls…</main>}><LazyAdminAccessScreen user={user} /></Suspense>}
      {screen === "points" && (
        <PointsScreen table={state.table} teams={scoringTeams} result={state.result} isAdmin={admin} onNavigate={navigate} onChangeTable={(table) => setState((current) => ({ ...current, table }))} />
      )}
      {screen === "scoring" && !admin && (
        <main className="admin-access-page">
          <section>
            <span>RESTRICTED CONTROL ROOM</span>
            <h1>Administrator access only</h1>
            <p>Live scoring and match controls are protected. Public visitors can view teams, players, fixtures, Series and the points table.</p>
            <button onClick={handleGoogleLogin}>Sign in as DPL 6 administrator</button>
          </section>
        </main>
      )}
      {screen === "scoring" && admin && teamsLoaded && scoringTeams.length < 2 && (
        <main className="admin-access-page">
          <section>
            <span>TEAMS REQUIRED</span>
            <h1>Add teams first</h1>
            <p>Create at least two teams in the Teams section. The scoring setup will automatically use their current names, logos and players.</p>
            <button onClick={() => navigate("teams")}>Open Team Center</button>
          </section>
        </main>
      )}
      {screen === "scoring" && admin && scoringTeams.length >= 2 && (!matchReady || !liveScoreReady) && (
        <main className="guided-flow-page">
          <section className="guided-intro">
            <span>GUIDED MATCH SETUP</span>
            <h1>Prepare the match first.</h1>
            <p>Complete the guided flow. The live scoring workspace will open only after setup succeeds.</p>
          </section>
          <SetupPanel onStart={startMatch} teams={scoringTeams} onResumeMatch={handleResumeMatch} />
        </main>
      )}
      {screen === "scoring" && admin && scoringTeams.length >= 2 && matchReady && liveScoreReady && (
        <>
          <main className="dashboard scoring-focus-dashboard">
            <aside className="scorecards-left">
              <div className="scorecards-left-head">
                <span>LIVE SCORECARDS</span>
                <strong>Batting above · Bowling below</strong>
              </div>
              <ScoreTables state={state} teams={scoringTeams} />
            </aside>
            <div className="scoring-main">
              <div className="scoring-focus-toolbar">
                <div><i /> MATCH IN PROGRESS</div>
                <div className="scoring-toolbar-actions">
                  <button
                    className="report-btn report-btn-secondary"
                    style={{ height: "28px", fontSize: "11px", padding: "0 10px" }}
                    onClick={() => {
                      localStorage.setItem(
                        "cricvault-active-session",
                        JSON.stringify({
                          state,
                          history,
                          matchReady: true,
                          overs,
                          updatedAt: Date.now(),
                        }),
                      )
                      alert("Match paused & saved! You can resume it anytime from setup.")
                      setMatchReady(false)
                    }}
                  >
                    ⏸ Pause Match
                  </button>
                  <button
                    className="report-btn report-btn-primary"
                    style={{ height: "28px", fontSize: "11px", padding: "0 12px" }}
                    onClick={() => setIsReportModalOpen(true)}
                  >
                    📄 Share Match Report
                  </button>
                  <button onClick={() => {
                    if (window.confirm("Open guided setup for a new match?")) setMatchReady(false)
                  }}>New match setup</button>
                  <button className="end-match-button" onClick={endMatch} disabled={!!state.result}>End match</button>
                </div>
              </div>
              <ScoreHeader
                state={state}
                overs={overs}
                teams={scoringTeams}
                onOpenReport={() => setIsReportModalOpen(true)}
              />
              <ScoringControls
                state={state}
                onRuns={scoreRuns}
                onExtra={scoreExtra}
                onWicket={confirmWicket}
                onSwapBatters={swapBattingPlayers}
                undo={() => {
                  const last = history.at(-1)
                  if (last) {
                    setState(last)
                    setHistory((current) => current.slice(0, -1))
                  }
                }}
                endOver={() => {
                  if (state.result) return
                  setState((prev) => ({
                    ...prev,
                    needsBowler: true,
                    overMarks: [],
                  }))
                }}
                onChangeBowler={changeBowler}
                scoringTeams={scoringTeams}
                remainingBatters={remainingBatters}
                bowlerOptions={bowlerOptions}
                overs={overs}
                oversText={oversText}
                teamByName={teamByName}
              />
              <PlayerCards state={state} teams={scoringTeams} />
            </div>
            <RightRail state={state} overs={overs} />
          </main>
          <footer className="dash-footer">
            <span>© 2026 CricVault Advanced Scoring System</span>
            <span>Scoring Engine 2.6.1 <i /> LIVE</span>
          </footer>
        </>
      )}
      {screen === "scoring" && admin && inningsResultOpen && state.summaries[0] && (() => {
        const summary = state.summaries[0]
        const inningsTeam = teamByName(summary.team, scoringTeams)
        const runRate = summary.balls ? (summary.runs / (summary.balls / 6)).toFixed(2) : "0.00"
        return <div className="innings-result-backdrop" onClick={(e) => {
          if (e.target === e.currentTarget) setInningsResultOpen(false)
        }}>
          <section className="innings-result-modal" role="dialog" aria-modal="true" aria-label="First innings result" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <button className="innings-result-close" onClick={() => setInningsResultOpen(false)} aria-label="Close first innings result">×</button>
            <div className="innings-result-kicker"><i /> FIRST INNINGS COMPLETE</div>
            <div className="innings-result-team">
              <span>{inningsTeam.logo ? <img src={inningsTeam.logo} alt={`${summary.team} logo`} /> : inningsTeam.code}</span>
              <div><small>DPL 6 INNINGS REPORT</small><h2>{summary.team}</h2></div>
            </div>
            <div className="innings-result-score"><strong>{summary.runs}<em>/{summary.wickets}</em></strong><span>{oversText(summary.balls)} OVERS</span></div>
            <div className="innings-result-stats">
              <article><small>RUN RATE</small><b>{runRate}</b></article>
              <article><small>WICKETS</small><b>{summary.wickets}</b></article>
              <article><small>DELIVERIES</small><b>{summary.balls}</b></article>
              <article><small>CHASE TARGET</small><b>{state.target || summary.runs + 1}</b></article>
            </div>
            <div className="innings-result-chase"><span>{state.batting}</span><strong>need {state.target || summary.runs + 1} runs to win</strong></div>
            <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
              <button
                className="report-btn report-btn-secondary"
                style={{ flex: 1, height: "44px", fontSize: "12px", justifyContent: "center" }}
                onClick={() => setIsReportModalOpen(true)}
              >
                📄 Share PDF Match Report
              </button>
              <button className="continue-chase-button" style={{ flex: 1 }} onClick={() => setInningsResultOpen(false)}>Continue to second innings →</button>
            </div>
          </section>
        </div>
      })()}
      <MatchReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        state={state}
        teams={scoringTeams}
        overs={overs}
      />
      </div>
    </div>
  )
}
