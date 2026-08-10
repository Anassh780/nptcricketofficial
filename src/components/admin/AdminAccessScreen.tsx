import { FormEvent, useEffect, useState } from "react"
import { Check, Crown, ShieldCheck, Trash2, UserPlus } from "lucide-react"
import {
  ADMIN_EMAIL,
  grantAdminByEmail,
  isMainAdmin,
  revokeAdminAccess,
  subscribeAdminDirectory,
  type AdminAccessEntry,
  type FirebaseUser,
} from "../../lib/firebase"
import "./admin-access.css"

export default function AdminAccessScreen({ user }: { user: FirebaseUser | null }) {
  const [entries, setEntries] = useState<AdminAccessEntry[]>([])
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const mainAdmin = isMainAdmin(user)

  useEffect(() => {
    if (!mainAdmin) return
    try { return subscribeAdminDirectory(setEntries) } catch (error) {
      setMessage(error instanceof Error ? error.message : "Admin directory could not be loaded.")
    }
  }, [mainAdmin])

  const grant = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage("")
    try {
      await grantAdminByEmail(email)
      setEmail("")
      setMessage("Administrator access granted. The user can refresh or sign in again to activate it.")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Access could not be granted.")
    } finally { setBusy(false) }
  }

  const revoke = async (entry: AdminAccessEntry) => {
    if (!window.confirm(`Remove administrator access for ${entry.email}?`)) return
    try {
      await revokeAdminAccess(entry.uid)
      setMessage(`Access removed for ${entry.email}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Access could not be removed.")
    }
  }

  if (!mainAdmin) return <main className="admin-access-page"><section><span>MAIN ADMIN ONLY</span><h1>Access management is protected</h1><p>Only the permanent DPL 6 main administrator can grant or revoke administrator permissions.</p></section></main>

  const active = entries.filter((entry) => entry.active)
  return <main className="access-manager-page">
    <section className="access-manager-hero">
      <div><span>SECURE CONTROL CENTER</span><h1>Administrator access</h1><p>Grant trusted people permission to manage teams, players, fixtures, Series, standings and live scoring.</p></div>
      <div className="main-admin-badge"><Crown /><small>PERMANENT MAIN ADMIN</small><strong>{ADMIN_EMAIL}</strong></div>
    </section>

    <section className="access-manager-grid">
      <form className="access-grant-card" onSubmit={grant}>
        <div className="access-icon"><UserPlus /></div><small>ADD ADMINISTRATOR</small><h2>Grant access by email</h2>
        <p>The person must first sign in to CricVault once with this Google email. Then enter the same address below.</p>
        <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" required /></label>
        <button disabled={busy}>{busy ? "Granting access…" : "Grant administrator access"}</button>
        {message && <div className="access-message" role="status">{message}</div>}
      </form>

      <section className="access-list-card">
        <div className="access-list-head"><div><small>AUTHORIZED TEAM</small><h2>Active administrators</h2></div><b>{active.length + 1}</b></div>
        <article className="access-person main"><div className="access-avatar"><Crown /></div><div><strong>Main administrator</strong><span>{ADMIN_EMAIL}</span></div><em><Check /> Permanent</em></article>
        {active.map((entry) => <article className="access-person" key={entry.uid}>
          <div className="access-avatar">{entry.photoURL ? <img src={entry.photoURL} alt="" /> : <ShieldCheck />}</div>
          <div><strong>{entry.name || "DPL 6 administrator"}</strong><span>{entry.email}</span></div>
          <button onClick={() => void revoke(entry)} aria-label={`Revoke ${entry.email}`}><Trash2 /> Revoke</button>
        </article>)}
        {!active.length && <p className="access-empty">No additional administrators have access yet.</p>}
      </section>
    </section>
  </main>
}
