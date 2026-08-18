import { useCallback, useEffect, useMemo, useState } from "react"
import type { FirebaseUser } from "../../lib/firebase"
import {
  mergeTeamPlayersIntoDirectory,
  PLAYER_DIRECTORY_STORAGE_KEY,
  PLAYER_DIRECTORY_UPDATE_EVENT,
  type SharedTeamProfile,
} from "../../data/teamStore"
import {
  deleteCloudItem,
  observeConnectionState,
  saveCloudItem,
  subscribeCloudData,
  uploadLeagueImage,
} from "../../lib/firebase"
import "./players.css"

export type LeaguePlayer = {
  id: string
  name: string
  city: string
  photo: string
  createdAt: number
  createdBy: string
}

const normalizePlayers = (value: unknown): LeaguePlayer[] => {
  if (!value) return []
  const rawList: any[] = Array.isArray(value) ? value : Object.values(value)
  const map = new Map<string, LeaguePlayer>()

  rawList.forEach((raw, idx) => {
    if (!raw || typeof raw !== "object") return
    const id = String(raw.id || raw.uid || `player-${idx}`)
    const name = String(raw.name || "").trim()
    if (!name) return

    map.set(id, {
      id,
      name,
      city: String(raw.city || "DPL 6").trim(),
      photo: String(raw.photo || raw.picture || raw.photoURL || raw.avatarUrl || ""),
      createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now() - idx * 1000,
      createdBy: String(raw.createdBy || "admin"),
    })
  })

  return Array.from(map.values())
}

const loadCachedPlayers = (): LeaguePlayer[] => {
  try {
    const cached = localStorage.getItem(PLAYER_DIRECTORY_STORAGE_KEY)
    return cached ? normalizePlayers(JSON.parse(cached)) : []
  } catch {
    return []
  }
}

const cachePlayers = (players: LeaguePlayer[]) => {
  try {
    // Only cache essential data to prevent localStorage quota issues
    localStorage.setItem(PLAYER_DIRECTORY_STORAGE_KEY, JSON.stringify(players))
  } catch (error) {
    console.warn("Player cache quota reached; running in live memory", error)
  }
}

export default function PlayersScreen({
  user,
  onLogin,
  isAdmin,
  teams,
}: {
  user: FirebaseUser | null
  onLogin: () => void
  isAdmin: boolean
  teams: SharedTeamProfile[]
}) {
  const [players, setPlayers] = useState<LeaguePlayer[]>(loadCachedPlayers)
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(true)
  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)

  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date())
  const [autoSyncMsg, setAutoSyncMsg] = useState<string>("")

  useEffect(() => observeConnectionState(setConnected), [])

  useEffect(() => {
    const applyLocalUpdate = (event: Event) => {
      const updated = normalizePlayers((event as CustomEvent<unknown>).detail)
      setPlayers(updated)
      cachePlayers(updated)
      setLoading(false)
    }
    window.addEventListener(PLAYER_DIRECTORY_UPDATE_EVENT, applyLocalUpdate)
    return () => window.removeEventListener(PLAYER_DIRECTORY_UPDATE_EVENT, applyLocalUpdate)
  }, [])

  const handleCloudData = useCallback((value: unknown) => {
    const cloudPlayers = normalizePlayers(value)
    // Overlay the current roster before rendering so an older listener value
    // cannot briefly roll back an optimistic team edit.
    const normalized = normalizePlayers(mergeTeamPlayersIntoDirectory(cloudPlayers, teams))
    setPlayers((prev) => {
      if (prev.length < normalized.length && prev.length > 0) {
        setAutoSyncMsg(`Auto-synced: Restored ${normalized.length - prev.length} cloud records`)
        setTimeout(() => setAutoSyncMsg(""), 4000)
      }
      return normalized
    })
    cachePlayers(normalized)
    setLoading(false)
    setLastSyncedAt(new Date())
  }, [teams])

  useEffect(() => {
    setLoading(true)
    const unsubscribe = subscribeCloudData<unknown>(
      "players",
      handleCloudData,
      (err) => {
        console.error("Could not load players:", err)
        setLoading(false)
      },
    )
    return () => unsubscribe()
  }, [handleCloudData, refreshKey])

  const ordered = useMemo(
    () => [...players].sort((a, b) => b.createdAt - a.createdAt),
    [players],
  )

  const addPlayer = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isAdmin || !user) return onLogin()
    if (!name.trim() || !city.trim() || !photo) {
      setMessage("Add the player name, city and profile picture.")
      return
    }
    setBusy(true)
    setMessage("")
    try {
      const id = crypto.randomUUID()
      const photoUrl = await uploadLeagueImage(photo, "players")
      const newPlayer: LeaguePlayer = {
        id,
        name: name.trim(),
        city: city.trim(),
        photo: photoUrl,
        createdAt: Date.now(),
        createdBy: user.uid,
      }

      // Optimistic local update
      setPlayers((current) => {
        const next = [newPlayer, ...current.filter((p) => p.id !== id)]
        cachePlayers(next)
        return next
      })

      // Atomic ID-keyed cloud write: never overwrites or loses other players
      await saveCloudItem("players", id, newPlayer)

      setName("")
      setCity("")
      setPhoto(null)
      setMessage("Player added to the DPL 6 gallery.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this player.")
    } finally {
      setBusy(false)
    }
  }

  const deletePlayer = async (id: string) => {
    if (!isAdmin || !window.confirm("Delete this player from the DPL 6 gallery?")) return
    
    // Optimistic local update
    setPlayers((current) => {
      const next = current.filter((p) => p.id !== id)
      cachePlayers(next)
      return next
    })

    try {
      // Atomic ID-keyed cloud removal
      await deleteCloudItem("players", id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete this player.")
    }
  }

  return (
    <main className="dpl-players-page">
      <header className="dpl-section-hero">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span>DIAMOND PREMIER LEAGUE · SEASON 6</span>
          <span className={`sync-pill ${connected ? "online" : "offline"}`}>
            <i /> {connected ? "Live Synced" : "Reconnecting"}
          </span>
          {autoSyncMsg && (
            <span className="auto-sync-badge animate-bounce">
              ⚡ {autoSyncMsg}
            </span>
          )}
        </div>
        <h1>DPL 6 Players</h1>
        <p>One online player directory for match setup, team selection and tournament records.</p>
      </header>

      {isAdmin && (
        <section className="player-registration-card">
          <div>
            <small>PLAYER REGISTRATION</small>
            <h2>Add the next league player</h2>
            <p>{user ? `Saving as ${user.displayName || user.email}` : "Google sign-in is required to publish players."}</p>
          </div>
          <form onSubmit={addPlayer}>
            <label>
              Player name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" />
            </label>
            <label>
              City
              <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Home city" />
            </label>
            <label className="player-photo-picker">
              Profile picture
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  setPhoto(event.currentTarget.files?.[0] || null)
                  event.currentTarget.value = ""
                }}
              />
              <span>{photo?.name || "Choose portrait"}</span>
            </label>
            <button disabled={busy}>
              {busy ? "Uploading…" : user ? "Add player →" : "Sign in to add"}
            </button>
          </form>
          {message && <div className="player-form-message">{message}</div>}
        </section>
      )}

      <section className="players-gallery-shell">
        <div className="gallery-heading">
          <div>
            <span>ONLINE ROSTER</span>
            <h2>Player gallery</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="gallery-refresh-btn"
              onClick={() => setRefreshKey((k) => k + 1)}
              title="Refresh player directory"
              aria-label="Refresh player directory"
            >
              🔄 Refresh
            </button>
            <b>{loading ? "LOADING…" : `${ordered.length.toString().padStart(2, "0")} PLAYERS`}</b>
          </div>
        </div>

        {loading && ordered.length === 0 ? (
          <div className="players-gallery">
            {Array.from({ length: 8 }).map((_, idx) => (
              <article className="league-player-card skeleton-card" key={`skel-${idx}`}>
                <div className="player-portrait skeleton-shimmer" />
                <div>
                  <div className="skeleton-line w-16 mb-2" />
                  <div className="skeleton-line w-32 h-5 mb-1" />
                  <div className="skeleton-line w-20" />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="players-gallery">
            {ordered.map((player, index) => (
              <article className="league-player-card" key={player.id}>
                <div className="player-portrait">
                  {player.photo ? (
                    <img src={player.photo} alt={player.name} loading="lazy" />
                  ) : (
                    <div className="player-placeholder-avatar">{player.name.charAt(0) || "P"}</div>
                  )}
                  <span>#{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div>
                  <small>DPL 6 PLAYER</small>
                  <h3>{player.name}</h3>
                  <p>⌖ {player.city}</p>
                  {isAdmin && (
                    <button
                      className="delete-gallery-item"
                      onClick={() => void deletePlayer(player.id)}
                    >
                      Delete player
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!ordered.length && (
              <div className="empty-player-gallery">
                No players published yet. Add the first DPL 6 player above.
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  )
}
