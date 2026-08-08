import { useEffect, useMemo, useState } from "react"
import type { FirebaseUser } from "../../lib/firebase"
import { saveCloudData, subscribeCloudData, uploadLeagueImage } from "../../lib/firebase"
import "./players.css"

type LeaguePlayer = {
  id: string
  name: string
  city: string
  photo: string
  createdAt: number
  createdBy: string
}

export default function PlayersScreen({
  user,
  onLogin,
  isAdmin,
}: {
  user: FirebaseUser | null
  onLogin: () => void
  isAdmin: boolean
}) {
  const [players, setPlayers] = useState<LeaguePlayer[]>([])
  const [name, setName] = useState("")
  const [city, setCity] = useState("")
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => subscribeCloudData<LeaguePlayer[] | Record<string, LeaguePlayer>>(
    "players",
    (value) => setPlayers(Array.isArray(value) ? value.filter(Boolean) : Object.values(value || {})),
  ), [])

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
      const next: LeaguePlayer[] = [
        ...players,
        { id, name: name.trim(), city: city.trim(), photo: photoUrl, createdAt: Date.now(), createdBy: user.uid },
      ]
      await saveCloudData("players", next)
      setPlayers(next)
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
    const next = players.filter((player) => player.id !== id)
    setPlayers(next)
    try {
      await saveCloudData("players", next)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete this player.")
    }
  }

  return (
    <main className="dpl-players-page">
      <header className="dpl-section-hero">
        <span>DIAMOND PREMIER LEAGUE · SEASON 6</span>
        <h1>DPL 6 Players</h1>
        <p>One online player directory for match setup, team selection and tournament records.</p>
      </header>

      {isAdmin && <section className="player-registration-card">
        <div>
          <small>PLAYER REGISTRATION</small>
          <h2>Add the next league player</h2>
          <p>{user ? `Saving as ${user.displayName || user.email}` : "Google sign-in is required to publish players."}</p>
        </div>
        <form onSubmit={addPlayer}>
          <label>Player name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Full name" /></label>
          <label>City<input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Home city" /></label>
          <label className="player-photo-picker">Profile picture<input type="file" accept="image/*" onChange={(event) => setPhoto(event.target.files?.[0] || null)} /><span>{photo?.name || "Choose portrait"}</span></label>
          <button disabled={busy}>{busy ? "Uploading…" : user ? "Add player →" : "Sign in to add"}</button>
        </form>
        {message && <div className="player-form-message">{message}</div>}
      </section>}

      <section className="players-gallery-shell">
        <div className="gallery-heading"><div><span>ONLINE ROSTER</span><h2>Player gallery</h2></div><b>{ordered.length.toString().padStart(2, "0")} PLAYERS</b></div>
        <div className="players-gallery">
          {ordered.map((player, index) => (
            <article className="league-player-card" key={player.id}>
              <div className="player-portrait"><img src={player.photo} alt={player.name} /><span>#{String(index + 1).padStart(2, "0")}</span></div>
              <div><small>DPL 6 PLAYER</small><h3>{player.name}</h3><p>⌖ {player.city}</p>{isAdmin && <button className="delete-gallery-item" onClick={() => void deletePlayer(player.id)}>Delete player</button>}</div>
            </article>
          ))}
          {!ordered.length && <div className="empty-player-gallery">No players published yet. Add the first DPL 6 player above.</div>}
        </div>
      </section>
    </main>
  )
}
