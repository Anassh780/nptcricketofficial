import { useEffect, useMemo, useRef, useState } from "react"
import { loadTeamProfiles, saveTeamProfiles, type SharedTeamProfile } from "../../data/teamStore"
import { uploadLeagueImage } from "../../lib/firebase"
import "./teams.css"

type PlayerProfile = { id: string; name: string; photo: string }
type TeamProfile = SharedTeamProfile

const playerNames = [
  "Arjun Dev", "Rohan Malhotra", "Vihaan Rao", "Ketan Deshmukh",
  "Shaurya Iyer", "Devansh Kulkarni", "Manav Bhandari", "Nirav Patel",
  "Samar Khanna", "Jayant Mehra", "Kabir Chopra",
]

const makePlayers = (prefix = "Player") =>
  Array.from({ length: 11 }, (_, index) => ({
    id: crypto.randomUUID(),
    name: prefix === "Player" ? `${prefix} ${index + 1}` : playerNames[index],
    photo: "",
  }))

const INITIAL_TEAMS: TeamProfile[] = [
  { id: "northern-warriors", name: "Northern Warriors", code: "NW", color: "#9df22f", logo: "", players: makePlayers("Warrior") },
  { id: "southern-strikers", name: "Southern Strikers", code: "SS", color: "#ff5f66", logo: "", players: makePlayers() },
  { id: "eastern-bulls", name: "Eastern Bulls", code: "EB", color: "#53a5ff", logo: "", players: makePlayers() },
  { id: "western-royals", name: "Western Royals", code: "WR", color: "#f2c94c", logo: "", players: makePlayers() },
]

const ensureEleven = (players: PlayerProfile[] = []) =>
  Array.from({ length: 11 }, (_, index) =>
    players[index] || { id: crypto.randomUUID(), name: `Player ${index + 1}`, photo: "" },
  )

function normalizeStoredTeams(value: unknown): TeamProfile[] {
  if (!Array.isArray(value)) return INITIAL_TEAMS
  return value.map((raw: any, index) => ({
    id: raw.id || `${raw.code || "team"}-${index}`,
    name: raw.name || `Team ${index + 1}`,
    code: raw.code || `T${index + 1}`,
    color: raw.color || "#9df22f",
    logo: raw.logo || raw.logoUrl || "",
    players: ensureEleven(
      (raw.playerDetails || raw.players || []).map((player: any, playerIndex: number) =>
        typeof player === "string"
          ? { id: crypto.randomUUID(), name: player, photo: "" }
          : {
              id: player.id || crypto.randomUUID(),
              name: player.name || `Player ${playerIndex + 1}`,
              photo: player.photo || player.avatarUrl || "",
            },
      ),
    ),
  }))
}

function TeamCard({
  team,
  onUpdate,
  onMessage,
  isAdmin,
  onDelete,
}: {
  team: TeamProfile
  onUpdate: (team: TeamProfile) => void
  onMessage: (message: string) => void
  isAdmin: boolean
  onDelete: () => void
}) {
  const [flipped, setFlipped] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  const initials = team.code || team.name.split(" ").map((word) => word[0]).join("")

  const uploadLogo = async (file?: File) => {
    if (!file) return
    onMessage("Processing team logo…")
    try {
      onUpdate({ ...team, logo: await uploadLeagueImage(file, `teams/${team.id}`) })
      onMessage("Team logo ready. Saving online…")
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Logo upload failed.")
    }
  }

  const updatePlayer = (index: number, changes: Partial<PlayerProfile>) => {
    const players = [...team.players]
    players[index] = { ...players[index], ...changes }
    onUpdate({ ...team, players })
  }

  const uploadPlayer = async (index: number, file?: File) => {
    if (!file) return
    onMessage(`Processing ${team.players[index].name || `Player ${index + 1}`} photo…`)
    try {
      updatePlayer(index, { photo: await uploadLeagueImage(file, `teams/${team.id}/players`) })
      onMessage(`${team.players[index].name || `Player ${index + 1}`} photo ready. Saving online…`)
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Player upload failed.")
    }
  }

  return (
    <article
      ref={cardRef}
      className={`team-flip-card ${flipped ? "is-flipped" : ""}`}
      style={{ "--team-color": team.color } as React.CSSProperties}
      onFocusCapture={(event) => {
        if ((event.target as HTMLElement).closest(".team-card-back")) setFlipped(true)
      }}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget as Node | null
        if (nextTarget && event.currentTarget.contains(nextTarget)) return
        window.requestAnimationFrame(() => {
          if (!cardRef.current?.matches(":hover")) setFlipped(false)
        })
      }}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("input, label, button")) return
        setFlipped((current) => !current)
      }}
    >
      <div className="team-flip-inner">
        <section className="team-card-face team-card-front">
          <div className="team-logo-stage">
            {team.logo ? <img src={team.logo} alt={`${team.name} logo`} /> : <div className="team-logo-placeholder">{initials}</div>}
            {isAdmin && <label className="team-front-upload">
              <input type="file" accept="image/*" onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ""
                void uploadLogo(file)
              }} />
              {team.logo ? "Change team picture" : "Upload team picture"}
            </label>}
          </div>
          <div className="team-card-summary">
            <span className="team-card-kicker">CRICVAULT OFFICIAL TEAM</span>
            <div className="team-summary-title">
              <div><h3>{team.name || "Unnamed Team"}</h3><small>{team.code} · 11 registered players</small></div>
            </div>
            <p>{isAdmin ? "Hover to edit the team name, team picture, player names and player photos." : "Open the card to view the complete registered squad."}</p>
          </div>
        </section>

        <section className="team-card-face team-card-back">
          <header className="team-roster-head">
            <div className="team-back-title">
              <small>EDIT TEAM</small>
              <input disabled={!isAdmin} className="team-name-editor" value={team.name} onChange={(event) => onUpdate({ ...team, name: event.target.value })} aria-label="Team name" />
            </div>
            {isAdmin && <label className="team-image-action">
              <input type="file" accept="image/*" onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ""
                void uploadLogo(file)
              }} />
              Replace image
            </label>}
            {isAdmin && <button className="team-delete-action" onClick={onDelete}>Delete</button>}
          </header>
          <div className="team-player-list">
            {team.players.map((player, index) => (
              <div
                className="team-player-row"
                key={player.id}
                style={{
                  transform: flipped ? "translateX(0)" : "translateX(-12px)",
                  opacity: flipped ? 1 : 0,
                  transitionDelay: `${index * 38 + 120}ms`,
                }}
              >
                <label className={`player-photo-control ${!isAdmin ? "read-only" : ""}`} title={isAdmin ? "Upload player photo" : "Player photo"}>
                  {isAdmin && <input type="file" accept="image/*" onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    event.currentTarget.value = ""
                    void uploadPlayer(index, file)
                  }} />}
                  {player.photo ? <img src={player.photo} alt="" /> : <span>{player.name.charAt(0) || "P"}</span>}
                </label>
                <input disabled={!isAdmin} value={player.name} onChange={(event) => updatePlayer(index, { name: event.target.value })} aria-label={`Player ${index + 1} name`} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </article>
  )
}

export default function TeamsScreen({ isAdmin }: { isAdmin: boolean }) {
  const [teams, setTeams] = useState<TeamProfile[]>(() => {
    try {
      return normalizeStoredTeams(loadTeamProfiles(INITIAL_TEAMS))
    } catch {
      return INITIAL_TEAMS
    }
  })
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState("Ready to manage tournament squads.")

  useEffect(() => {
    if (!isAdmin) return
    const timer = window.setTimeout(() => {
      void saveTeamProfiles(teams)
        .then(() => setMessage("All team changes are synced online."))
        .catch((error) => {
          setMessage(error instanceof Error ? error.message : "Online team sync failed.")
        })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [teams, isAdmin])

  const visibleTeams = useMemo(
    () => teams.filter((team) => `${team.name} ${team.code}`.toLowerCase().includes(query.toLowerCase())),
    [query, teams],
  )
  const updateTeam = (updated: TeamProfile) =>
    setTeams((current) => current.map((team) => team.id === updated.id ? updated : team))
  const addTeam = () => {
    const number = teams.length + 1
    setTeams((current) => [...current, {
      id: crypto.randomUUID(), name: `New Team ${number}`, code: `T${number}`,
      color: "#9df22f", logo: "", players: makePlayers(),
    }])
    setMessage("New team added. Edit its name, logo and players directly on the card.")
  }
  const deleteTeam = (teamId: string) => {
    if (!window.confirm("Delete this team and its squad?")) return
    setTeams((current) => current.filter((team) => team.id !== teamId))
    setMessage("Team deleted from DPL 6.")
  }

  return (
    <main className="teams-hub-page">
      <section className="teams-hub-shell">
        <header className="teams-hub-hero">
          <div><span>DPL 6 TEAM CENTER</span><h1>Teams &amp; Players</h1><p>{isAdmin ? "Administrator controls for names, logos and player portraits." : "Official Diamond Premier League 6 squads and player rosters."}</p></div>
          {isAdmin && <button onClick={addTeam}>+ Add team</button>}
        </header>
        <div className="teams-hub-tools">
          <label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teams..." /></label>
          <p>{message}</p>
          <b>{visibleTeams.length} TEAMS</b>
        </div>
        <section className="teams-card-grid" aria-label="Tournament teams">
          {visibleTeams.map((team) => (
            <TeamCard key={team.id} team={team} onUpdate={updateTeam} onMessage={setMessage} isAdmin={isAdmin} onDelete={() => deleteTeam(team.id)} />
          ))}
        </section>
      </section>
    </main>
  )
}
