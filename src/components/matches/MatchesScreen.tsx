import { useEffect, useMemo, useState } from "react"
import type { SharedTeamProfile } from "../../data/teamStore"
import type { FirebaseUser } from "../../lib/firebase"
import { saveCloudData, subscribeCloudData } from "../../lib/firebase"
import MatchReportModal from "../report/MatchReportModal"
import type { Batter, Bowler, ScoreState, Team } from "../scoring/ScoringControls"
import "./matches.css"
import "./matches-results.css"

export type LeagueMatch = {
  id: string
  teamA: string
  teamB: string
  startsAt: number
  venue: string
  result?: string
  winnerId?: string
  record?: {
    result: string
    innings: Array<{
      team: string
      runs: number
      wickets: number
      balls: number
      batting?: Array<{ name: string; runs: number; balls: number; fours: number; sixes: number; out: boolean; dismissal: string }>
      bowling?: Array<{ name: string; balls: number; runs: number; wickets: number; maidens: number }>
      extras?: { wd: number; nb: number; b: number; lb: number }
    }>
    target?: number | null
    completedAt: number
    events?: Array<{ id: number; innings: number; over: string; mark: string; text: string; legal?: boolean; runs?: number }>
  }
  createdBy: string
}

const oversText = (balls = 0) => `${Math.floor(balls / 6)}.${balls % 6}`

type BattingLine = { name: string; runs: number; balls: number; fours: number; sixes: number; out: boolean; dismissal: string }
type BowlingLine = { name: string; balls: number; runs: number; wickets: number; maidens: number }

const deriveScorecards = (inningsNumber: number, events: NonNullable<LeagueMatch["record"]>["events"] = []) => {
  const batting = new Map<string, BattingLine>()
  const bowling = new Map<string, BowlingLine>()
  ;[...events].filter((event) => event.innings === inningsNumber).reverse().forEach((event) => {
    const delivery = event.text.match(/^(.+?) to (.+?),/)
    if (!delivery) return
    const [, bowlerName, batterName] = delivery
    const batter = batting.get(batterName) || { name: batterName, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: "not out" }
    const bowler = bowling.get(bowlerName) || { name: bowlerName, balls: 0, runs: 0, wickets: 0, maidens: 0 }
    const legal = event.legal ?? !/^(WD|NB)/.test(event.mark)
    const eventRuns = Number(event.runs ?? event.mark.match(/^\d+$/)?.[0] ?? 0)
    if (legal) { batter.balls += 1; bowler.balls += 1 }
    if (/^\d+$/.test(event.mark)) {
      batter.runs += eventRuns
      bowler.runs += eventRuns
      if (eventRuns === 4) batter.fours += 1
      if (eventRuns === 6) batter.sixes += 1
    } else if (/^NB/.test(event.mark)) {
      const batRuns = Math.max(0, eventRuns - 1)
      batter.runs += batRuns
      bowler.runs += eventRuns
      if (batRuns === 4) batter.fours += 1
      if (batRuns === 6) batter.sixes += 1
    } else if (/^WD/.test(event.mark)) bowler.runs += eventRuns
    if (event.mark === "W") {
      batter.out = true
      batter.dismissal = event.text.split(/OUT\s*[—-]\s*/)[1]?.replace(/\.$/, "") || "out"
      if (!/run out/i.test(event.text)) bowler.wickets += 1
    }
    batting.set(batterName, batter)
    bowling.set(bowlerName, bowler)
  })
  return { batting: [...batting.values()], bowling: [...bowling.values()] }
}

const matchStatus = (match: LeagueMatch) => {
  const now = Date.now()
  if (match.result || now > match.startsAt + 4 * 60 * 60 * 1000) return "ENDED"
  if (now >= match.startsAt) return "LIVE"
  return "UPCOMING"
}

export default function MatchesScreen({
  teams,
  user,
  onLogin,
  isAdmin,
}: {
  teams: SharedTeamProfile[]
  user: FirebaseUser | null
  onLogin: () => void
  isAdmin: boolean
}) {
  const [matches, setMatches] = useState<LeagueMatch[]>([])
  const [teamA, setTeamA] = useState(teams[0]?.id || "")
  const [teamB, setTeamB] = useState(teams[1]?.id || "")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [venue, setVenue] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<LeagueMatch | null>(null)
  const [reportModalState, setReportModalState] = useState<ScoreState | null>(null)

  const convertMatchToScoreState = (match: LeagueMatch): ScoreState => {
    const innings = match.record?.innings || []
    const first = innings[0]
    const second = innings[1] || first || { team: match.teamA, runs: 0, wickets: 0, balls: 0 }

    const derived1 = deriveScorecards(1, match.record?.events)
    const derived2 = deriveScorecards(2, match.record?.events)

    const battersObj: Record<string, Batter> = {}
    const bowlersObj: Record<string, Bowler> = {}

    const secondBatting = second.batting?.length ? second.batting : derived2.batting
    const secondBowling = second.bowling?.length ? second.bowling : derived2.bowling

    secondBatting.forEach((b) => {
      battersObj[b.name] = { ...b, dismissal: b.dismissal || (b.out ? "out" : "not out") }
    })
    secondBowling.forEach((bw) => {
      bowlersObj[bw.name] = { ...bw }
    })

    return {
      matchId: match.id,
      innings: innings.length,
      batting: second.team || match.teamA,
      bowling: innings.length > 1 ? first?.team || match.teamB : match.teamB,
      runs: second.runs || 0,
      wickets: second.wickets || 0,
      balls: second.balls || 0,
      striker: secondBatting[0]?.name || "Batter 1",
      nonStriker: secondBatting[1]?.name || "Batter 2",
      bowler: secondBowling[0]?.name || "Bowler 1",
      freeHit: false,
      partnershipRuns: 0,
      partnershipBalls: 0,
      extras: second.extras || { wd: 0, nb: 0, b: 0, lb: 0 },
      batters: battersObj,
      bowlers: bowlersObj,
      overMarks: [],
      fall: [],
      result: match.record?.result || match.result || "Match Ended",
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
        mark: e.mark,
        runs: e.runs || 0,
        legal: e.legal ?? true,
      })),
    }
  }

  useEffect(() => subscribeCloudData<LeagueMatch[] | Record<string, LeagueMatch>>(
    "matches",
    (value) => setMatches(Array.isArray(value) ? value.filter(Boolean) : Object.values(value || {})),
  ), [])

  useEffect(() => {
    if (!teams.some((team) => team.id === teamA)) setTeamA(teams[0]?.id || "")
    if (!teams.some((team) => team.id === teamB) || teamA === teamB) {
      setTeamB(teams.find((team) => team.id !== teamA)?.id || "")
    }
  }, [teams, teamA, teamB])

  const ordered = useMemo(
    () => [...matches].sort((a, b) => {
      const aEnded = matchStatus(a) === "ENDED"
      const bEnded = matchStatus(b) === "ENDED"
      return Number(aEnded) - Number(bEnded) || a.startsAt - b.startsAt
    }),
    [matches],
  )

  const createMatch = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isAdmin || !user) return onLogin()
    if (!teamA || !teamB || teamA === teamB || !date || !time) {
      setMessage("Choose two different teams and add the match date and time.")
      return
    }
    setBusy(true)
    try {
      const next = [
        ...matches,
        { id: crypto.randomUUID(), teamA, teamB, startsAt: new Date(`${date}T${time}`).getTime(), venue: venue.trim() || "DPL Cricket Ground", createdBy: user.uid },
      ]
      await saveCloudData("matches", next)
      setMatches(next)
      setMessage("Match published to the DPL 6 schedule.")
      setDate("")
      setTime("")
      setVenue("")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not publish this match.")
    } finally {
      setBusy(false)
    }
  }
  const deleteMatch = async (id: string) => {
    if (!isAdmin || !window.confirm("Delete this DPL 6 fixture?")) return
    const next = matches.filter((match) => match.id !== id)
    setMatches(next)
    try {
      await saveCloudData("matches", next)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete this fixture.")
    }
  }

  const team = (id: string) => teams.find((item) => item.id === id)

  return (
    <main className="dpl-matches-page">
      <header className="dpl-section-hero match-hero"><span>DIAMOND PREMIER LEAGUE · SEASON 6</span><h1>Match Center</h1><p>Publish fixtures once. Team names and logos are fetched directly from the online team registry.</p></header>
      {isAdmin && <section className="match-publisher">
        <div><small>CREATE FIXTURE</small><h2>Schedule a DPL 6 match</h2><p>The system automatically moves fixtures from upcoming to live and ended.</p></div>
        <form onSubmit={createMatch}>
          <label>Home team<select value={teamA} onChange={(event) => setTeamA(event.target.value)}>{teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Opponent<select value={teamB} onChange={(event) => setTeamB(event.target.value)}>{teams.filter((item) => item.id !== teamA).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label>Time<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
          <label>Venue<input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="DPL Cricket Ground" /></label>
          <button disabled={busy}>{busy ? "Publishing…" : user ? "Publish match →" : "Sign in to publish"}</button>
        </form>
        {message && <div className="match-message">{message}</div>}
      </section>}

      <section className="fixture-feed">
        <div className="fixture-feed-head"><div><span>AUTO-TRACKED SCHEDULE</span><h2>DPL 6 Fixtures</h2></div><b>{ordered.length} MATCHES</b></div>
        <div className="fixture-grid">
          {ordered.map((match) => {
            const first = team(match.teamA)
            const second = team(match.teamB)
            const status = matchStatus(match)
            const winnerId = match.winnerId || (status === "ENDED"
              ? [first, second].find((candidate) => candidate && match.result?.startsWith(`${candidate.name} won by`))?.id
              : undefined)
            return <article
              className={`vs-fixture status-${status.toLowerCase()} ${status === "ENDED" ? "is-result-link" : ""}`}
              key={match.id}
              role={status === "ENDED" ? "button" : undefined}
              tabIndex={status === "ENDED" ? 0 : undefined}
              onClick={() => status === "ENDED" && setSelectedMatch(match)}
              onKeyDown={(event) => {
                if (status === "ENDED" && (event.key === "Enter" || event.key === " ")) setSelectedMatch(match)
              }}
            >
              <div className="fixture-top"><span className="fixture-status"><i />{status}</span><time>{new Date(match.startsAt).toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"})} · {new Date(match.startsAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</time></div>
              <div className="versus-stage">
                <div className={`fixture-team ${winnerId === first?.id ? "is-winner" : ""}`}><div>{first?.logo ? <img src={first.logo} alt={`${first.name} logo`} /> : <b>{first?.code || "A"}</b>}</div>{winnerId === first?.id && <span className="fixture-winner-tag">WINNER</span>}<strong>{first?.name || "Team A"}</strong></div>
                <span className="versus-mark"><small>DPL 6</small>VS</span>
                <div className={`fixture-team ${winnerId === second?.id ? "is-winner" : ""}`}><div>{second?.logo ? <img src={second.logo} alt={`${second.name} logo`} /> : <b>{second?.code || "B"}</b>}</div>{winnerId === second?.id && <span className="fixture-winner-tag">WINNER</span>}<strong>{second?.name || "Opponent"}</strong></div>
              </div>
              <div className="fixture-bottom"><span>⌖ {match.venue}</span>{match.result && <strong>{match.result} · View full result</strong>}{isAdmin && <button className="delete-fixture" onClick={(event) => { event.stopPropagation(); void deleteMatch(match.id) }}>Delete</button>}</div>
            </article>
          })}
          {!ordered.length && <div className="empty-fixtures">No fixtures published yet.</div>}
        </div>
      </section>
      {selectedMatch && (() => {
        const first = team(selectedMatch.teamA)
        const second = team(selectedMatch.teamB)
        const innings = selectedMatch.record?.innings || []
        return <div className="match-result-backdrop" onMouseDown={() => setSelectedMatch(null)}>
          <section className="match-result-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Completed match result">
            <button className="result-modal-close" onClick={() => setSelectedMatch(null)} aria-label="Close match result">×</button>
            <header><small>OFFICIAL DPL 6 RESULT</small><h2>Match record</h2><time>{new Date(selectedMatch.startsAt).toLocaleString()}</time></header>
            <div className="result-matchup">
              <div><span className="result-team-logo">{first?.logo ? <img src={first.logo} alt="" /> : <b>{first?.code || "A"}</b>}</span><strong>{first?.name || "Team A"}</strong></div>
              <em>VS</em>
              <div><span className="result-team-logo">{second?.logo ? <img src={second.logo} alt="" /> : <b>{second?.code || "B"}</b>}</span><strong>{second?.name || "Opponent"}</strong></div>
            </div>
            <div className="result-verdict">{selectedMatch.record?.result || selectedMatch.result || "Match ended"}</div>
            <div className="result-innings-grid">
              {innings.map((item, index) => <article key={`${item.team}-${index}`}><small>{index === 0 ? "FIRST INNINGS" : "SECOND INNINGS"}</small><h3>{item.team}</h3><strong>{item.runs}/{item.wickets}</strong><span>{oversText(item.balls)} overs</span></article>)}
              {!innings.length && <p className="legacy-result-note">The result is available, but this older fixture has no detailed score record.</p>}
            </div>
            <div className="result-performance-stack">
              {innings.map((item, index) => {
                const derived = deriveScorecards(index + 1, selectedMatch.record?.events)
                const batting = item.batting?.length ? item.batting : derived.batting
                const bowling = item.bowling?.length ? item.bowling : derived.bowling
                return <section className="result-scorecard" key={`scorecard-${item.team}-${index}`}>
                  <header><div><small>{index === 0 ? "FIRST INNINGS" : "SECOND INNINGS"}</small><h3>{item.team} performance</h3></div><strong>{item.runs}/{item.wickets} <span>{oversText(item.balls)} ov</span></strong></header>
                  <div className="result-scorecard-grid">
                    <div className="result-stat-table result-batting-table">
                      <div className="result-table-title"><span>Batting</span><small>RUNS · BALLS · BOUNDARIES</small></div>
                      <table><thead><tr><th>BATTER</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>
                        {batting.map((player) => <tr key={player.name}><td><strong>{player.name}</strong><small>{player.out ? player.dismissal || "out" : "not out"}</small></td><td>{player.runs}</td><td>{player.balls}</td><td>{player.fours}</td><td>{player.sixes}</td><td>{player.balls ? ((player.runs / player.balls) * 100).toFixed(1) : "—"}</td></tr>)}
                        {!batting.length && <tr><td colSpan={6} className="result-empty-stat">No batting deliveries recorded.</td></tr>}
                      </tbody></table>
                    </div>
                    <div className="result-stat-table result-bowling-table">
                      <div className="result-table-title"><span>Bowling</span><small>OVERS · RUNS · WICKETS</small></div>
                      <table><thead><tr><th>BOWLER</th><th>O</th><th>R</th><th>W</th><th>ECON</th></tr></thead><tbody>
                        {bowling.map((player) => <tr key={player.name}><td><strong>{player.name}</strong></td><td>{oversText(player.balls)}</td><td>{player.runs}</td><td>{player.wickets}</td><td>{player.balls ? (player.runs / (player.balls / 6)).toFixed(2) : "0.00"}</td></tr>)}
                        {!bowling.length && <tr><td colSpan={5} className="result-empty-stat">No bowling figures recorded.</td></tr>}
                      </tbody></table>
                    </div>
                  </div>
                  {item.extras && <footer><span>EXTRAS</span><b>{Object.values(item.extras).reduce((total, value) => total + value, 0)}</b><small>WD {item.extras.wd} · NB {item.extras.nb} · B {item.extras.b} · LB {item.extras.lb}</small></footer>}
                </section>
              })}
            </div>
            <footer>
              <button
                className="report-btn report-btn-primary"
                style={{ height: "32px", fontSize: "11px", padding: "0 14px" }}
                onClick={() => setReportModalState(convertMatchToScoreState(selectedMatch))}
              >
                📄 Share PDF Match Report
              </button>
              <span>⌖ {selectedMatch.venue}</span>
              {selectedMatch.record?.completedAt ? <time>Completed {new Date(selectedMatch.record.completedAt).toLocaleString()}</time> : null}
            </footer>
          </section>
        </div>
      })()}

      {reportModalState && (
        <MatchReportModal
          isOpen={Boolean(reportModalState)}
          onClose={() => setReportModalState(null)}
          state={reportModalState}
          teams={teams.map((t) => ({
            code: t.code,
            name: t.name,
            color: t.color,
            players: (t.players || []).map((p) => (typeof p === "string" ? p : p.name)),
            logo: t.logo,
          }))}
          overs={20}
        />
      )}
    </main>
  )
}
