import { useEffect, useMemo, useRef, useState } from "react"
import {
  PLAYING_XI_SIZE,
  TEAM_ROSTER_SIZE,
  loadTeamProfiles,
  saveTeamProfiles,
  subscribeTeamProfiles,
  syncTeamPlayersToDirectory,
  updateLocalPlayerDirectory,
  type SharedTeamProfile,
} from "../../data/teamStore"
import { observeConnectionState, uploadLeagueImage } from "../../lib/firebase"
import "./teams.css"

type PlayerProfile = { id: string; name: string; photo: string }
type TeamProfile = SharedTeamProfile

const makePlayers = () =>
  Array.from({ length: TEAM_ROSTER_SIZE }, () => ({
    id: crypto.randomUUID(),
    name: "",
    photo: "",
  }))

const ensureRoster = (players: PlayerProfile[] = [], teamId: string) =>
  Array.from({ length: TEAM_ROSTER_SIZE }, (_, index) =>
    players[index] || { id: `${teamId}-player-${index + 1}`, name: "", photo: "" },
  )

const customPlayerName = (value: unknown) => {
  const name = typeof value === "string" ? value : ""
  return /^player\s+\d+$/i.test(name.trim()) ? "" : name
}

function normalizeStoredTeams(value: unknown): TeamProfile[] {
  if (!value) return []
  const rawList: any[] = Array.isArray(value) ? value : Object.values(value)
  return rawList.map((raw: any, index) => {
    const storedName = typeof raw.name === "string" ? raw.name : ""
    const name = /^(?:new\s+)?team\s+\d+$/i.test(storedName.trim()) ? "" : storedName
    const teamId = String(raw.id || `${raw.code || "team"}-${index}`)
    const storedPlayers = (raw.playerDetails || raw.players || []).map((player: any, playerIndex: number) =>
      typeof player === "string"
        ? { id: `${teamId}-player-${playerIndex + 1}`, name: customPlayerName(player), photo: "" }
        : {
            id: player.id || `${teamId}-player-${playerIndex + 1}`,
            name: customPlayerName(player.name),
            photo: player.photo || player.picture || player.photoURL || player.avatarUrl || "",
          },
    )
    return {
      id: teamId,
      name,
      code: typeof raw.code === "string" ? raw.code : "",
      color: raw.color || "#9df22f",
      logo: raw.logo || raw.logoUrl || "",
      players: ensureRoster(storedPlayers, teamId),
    }
  })
}

function TeamCard({
  team,
  onUpdate,
  onMessage,
  isAdmin,
  onDelete,
}: {
  team: TeamProfile
  onUpdate: (updater: (team: TeamProfile) => TeamProfile) => void
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
      const logo = await uploadLeagueImage(file, `teams/${team.id}`)
      onUpdate((current) => ({ ...current, logo }))
      onMessage("Team logo ready. Saving online…")
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Logo upload failed.")
    }
  }

  const updatePlayer = (index: number, changes: Partial<PlayerProfile>) => {
    onUpdate((current) => {
      const players = [...current.players]
      players[index] = { ...players[index], ...changes }
      return { ...current, players }
    })
  }

  const uploadPlayer = async (index: number, file?: File) => {
    if (!file) return
    onMessage(`Processing ${team.players[index].name || `squad member ${index + 1}`} photo…`)
    try {
      updatePlayer(index, { photo: await uploadLeagueImage(file, `teams/${team.id}/players`) })
      onMessage(`${team.players[index].name || `Squad member ${index + 1}`} photo ready. Saving online…`)
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
          {isAdmin && <button type="button" className="team-front-edit" onClick={(event) => {
            event.stopPropagation()
            setFlipped(true)
          }}>Edit team</button>}
          <div className="team-card-summary">
            <span className="team-card-kicker">CRICVAULT OFFICIAL TEAM</span>
            <div className="team-summary-title">
              <div>
                {isAdmin ? <input className="team-front-name" value={team.name} placeholder="Enter team name" onChange={(event) => {
                  const name = event.target.value
                  onUpdate((current) => ({ ...current, name }))
                }} aria-label="Team name" /> : <h3>{team.name || "Unnamed Team"}</h3>}
                <small>{team.code} · {PLAYING_XI_SIZE} playing XI + 1 reserve</small>
              </div>
            </div>
            <p>{isAdmin ? "Hover to edit the team name, team picture, player names and player photos." : "Open the card to view the complete registered squad."}</p>
          </div>
        </section>

        <section className="team-card-face team-card-back">
          <header className="team-roster-head">
            <div className="team-back-title">
              <small>TEAM NAME · CLICK BELOW TO EDIT</small>
              <input disabled={!isAdmin} className="team-name-editor" value={team.name} onChange={(event) => {
                const name = event.target.value
                onUpdate((current) => ({ ...current, name }))
              }} aria-label="Team name" />
            </div>
            {isAdmin && <label className="team-image-action">
              <input type="file" accept="image/*" onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ""
                void uploadLogo(file)
              }} />
              Replace image
            </label>}
            {isAdmin && <button type="button" className="team-delete-action" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
              event.stopPropagation()
              void onDelete()
            }}>Delete</button>}
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
                <b className={index === PLAYING_XI_SIZE ? "reserve-label" : ""}>
                  {index === PLAYING_XI_SIZE ? "12 · RESERVE" : index + 1}
                </b>
                <label className={`player-photo-control ${!isAdmin ? "read-only" : ""}`} title={isAdmin ? "Upload player photo" : "Player photo"}>
                  {isAdmin && <input type="file" accept="image/*" onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    event.currentTarget.value = ""
                    void uploadPlayer(index, file)
                  }} />}
                  {player.photo ? <img src={player.photo} alt="" /> : <span>{player.name.charAt(0) || "P"}</span>}
                </label>
                <input disabled={!isAdmin} value={player.name} onChange={(event) => updatePlayer(index, { name: event.target.value })} aria-label={`Squad member ${index + 1} name`} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </article>
  )
}

export default function TeamsScreen({
  isAdmin,
  onTeamsChange,
}: {
  isAdmin: boolean
  onTeamsChange?: (teams: TeamProfile[]) => void
}) {
  const [teams, setTeams] = useState<TeamProfile[]>(() => normalizeStoredTeams(loadTeamProfiles([])))
  const [loaded, setLoaded] = useState(() => loadTeamProfiles([]).length > 0)
  const [connected, setConnected] = useState(true)
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState("Ready to manage tournament squads.")

  useEffect(() => observeConnectionState(setConnected), [])

  useEffect(() => subscribeTeamProfiles((onlineTeams) => {
    const normalized = normalizeStoredTeams(onlineTeams)
    setTeams((current) =>
      JSON.stringify(current) === JSON.stringify(normalized) ? current : normalized,
    )
    setLoaded(true)
  }), [])

  useEffect(() => {
    if (!isAdmin || !loaded) return
    const timer = window.setTimeout(() => {
      void saveTeamProfiles(teams)
        .then(() => syncTeamPlayersToDirectory(teams))
        .then(() => setMessage("Team changes and player directory are synced online."))
        .catch((error) => {
          setMessage(error instanceof Error ? error.message : "Online team sync failed.")
        })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [teams, isAdmin, loaded])

  const visibleTeams = useMemo(
    () => teams.filter((team) => `${team.name} ${team.code}`.toLowerCase().includes(query.toLowerCase())),
    [query, teams],
  )
  const updateTeam = (teamId: string, updater: (team: TeamProfile) => TeamProfile) =>
    setTeams((current) => {
      const next = current.map((team) => team.id === teamId ? updater(team) : team)
      updateLocalPlayerDirectory(next)
      onTeamsChange?.(next)
      return next
    })
  const addTeam = () => {
    const number = teams.length + 1
    setTeams((current) => [...current, {
      id: crypto.randomUUID(), name: "", code: `T${number}`,
      color: "#9df22f", logo: "", players: makePlayers(),
    }])
    setMessage("New team added. Edit its name, logo and players directly on the card.")
  }
  const deleteTeam = async (teamId: string) => {
    if (!window.confirm("Delete this team and its squad?")) return
    const next = teams.filter((team) => team.id !== teamId)
    setTeams(next)
    try {
      await saveTeamProfiles(next)
      setMessage("Team deleted from DPL 6 and every connected section.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete the team online.")
    }
  }

  return (
    <main className="teams-hub-page">
      <section className="teams-hub-shell">
        <header className="teams-hub-hero">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span>DPL 6 TEAM CENTER</span>
              <span className={`sync-pill ${connected ? "online" : "offline"}`}>
                <i /> {connected ? "Live Synced" : "Reconnecting"}
              </span>
            </div>
            <h1>Teams &amp; Players</h1>
            <p>{isAdmin ? "Administrator controls for names, logos and player portraits." : "Official Diamond Premier League 6 squads and player rosters."}</p>
          </div>
          {isAdmin && <button onClick={addTeam}>+ Add team</button>}
        </header>
        <div className="teams-hub-tools">
          <label><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search teams..." /></label>
          <p>{message}</p>
          <b>{!loaded ? "LOADING TEAMS…" : `${visibleTeams.length} TEAMS`}</b>
        </div>
        {!loaded ? (
          <section className="teams-card-grid" aria-label="Loading teams">
            {Array.from({ length: 4 }).map((_, i) => (
              <article className="team-flip-card skeleton-card" key={`team-skel-${i}`} style={{ height: "320px", borderRadius: "16px" }}>
                <div className="skeleton-shimmer" style={{ width: "100%", height: "100%", borderRadius: "16px" }} />
              </article>
            ))}
          </section>
        ) : (
          <section className="teams-card-grid" aria-label="Tournament teams">
            {visibleTeams.map((team) => (
              <TeamCard key={team.id} team={team} onUpdate={(updater) => updateTeam(team.id, updater)} onMessage={setMessage} isAdmin={isAdmin} onDelete={() => deleteTeam(team.id)} />
            ))}
          </section>
        )}
      </section>
    </main>
  )
}
