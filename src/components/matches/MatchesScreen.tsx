import { useEffect, useMemo, useState } from "react"
import type { SharedTeamProfile } from "../../data/teamStore"
import type { FirebaseUser } from "../../lib/firebase"
import { saveCloudData, subscribeCloudData } from "../../lib/firebase"
import "./matches.css"

export type LeagueMatch = {
  id: string
  teamA: string
  teamB: string
  startsAt: number
  venue: string
  result?: string
  createdBy: string
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
            return <article className={`vs-fixture status-${status.toLowerCase()}`} key={match.id}>
              <div className="fixture-top"><span className="fixture-status"><i />{status}</span><time>{new Date(match.startsAt).toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"})} · {new Date(match.startsAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</time></div>
              <div className="versus-stage">
                <div className="fixture-team"><div>{first?.logo ? <img src={first.logo} alt={`${first.name} logo`} /> : <b>{first?.code || "A"}</b>}</div><strong>{first?.name || "Team A"}</strong></div>
                <span className="versus-mark"><small>DPL 6</small>VS</span>
                <div className="fixture-team"><div>{second?.logo ? <img src={second.logo} alt={`${second.name} logo`} /> : <b>{second?.code || "B"}</b>}</div><strong>{second?.name || "Opponent"}</strong></div>
              </div>
              <div className="fixture-bottom"><span>⌖ {match.venue}</span>{match.result && <strong>{match.result}</strong>}{isAdmin && <button className="delete-fixture" onClick={() => void deleteMatch(match.id)}>Delete</button>}</div>
            </article>
          })}
          {!ordered.length && <div className="empty-fixtures">No fixtures published yet.</div>}
        </div>
      </section>
    </main>
  )
}
