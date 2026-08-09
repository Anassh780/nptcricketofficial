import { useEffect, useState } from "react"
import { MessageCircle, Plus, Save, Trash2, Upload } from "lucide-react"
import anasPhoto from "../../assets/anas-sheikh.jpg"
import { saveCloudData, subscribeCloudData, uploadLeagueImage } from "../../lib/firebase"
import "./about-section.css"

type ManagementMember = {
  id: string
  name: string
  role: string
  whatsapp: string
  photo?: string
}

type AboutData = {
  socials: { facebook: string; instagram: string; youtube: string }
  management: ManagementMember[]
}

const DEFAULT_ABOUT: AboutData = {
  socials: { facebook: "", instagram: "", youtube: "" },
  management: [],
}

const FacebookLogo = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 8.5V7c0-.8.5-1 1.1-1H18V2.2C17.5 2.1 15.8 2 14.2 2 11 2 8.8 4 8.8 7.6v.9H5v4.3h3.8V22H14v-9.2h3.5l.6-4.3H14Z" /></svg>
const InstagramLogo = () => <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></svg>
const YoutubeLogo = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23 7.1a3 3 0 0 0-2.1-2.2C19 4.4 12 4.4 12 4.4s-7 0-8.9.5A3 3 0 0 0 1 7.1 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.9 3 3 0 0 0 2.1 2.2c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.2 31 31 0 0 0 .5-4.9 31 31 0 0 0-.5-4.9ZM9.7 15.3V8.7l6 3.3-6 3.3Z"/></svg>

const whatsappUrl = (phone: string) => {
  const digits = phone.replace(/\D/g, "")
  return `https://wa.me/${digits.startsWith("0") ? `92${digits.slice(1)}` : digits}`
}

export default function AboutSection({ isAdmin }: { isAdmin: boolean }) {
  const [data, setData] = useState<AboutData>(DEFAULT_ABOUT)
  const [status, setStatus] = useState("")

  useEffect(() => subscribeCloudData<AboutData | null>("about", (online) => {
    if (!online) return
    setData({
      socials: { ...DEFAULT_ABOUT.socials, ...(online.socials || {}) },
      management: Array.isArray(online.management) ? online.management.filter(Boolean) : Object.values(online.management || {}),
    })
  }), [])

  const persist = async (next: AboutData, message: string) => {
    setData(next)
    setStatus("Saving…")
    try {
      await saveCloudData("about", next)
      setStatus(message)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save changes.")
    }
  }

  const updateMember = (id: string, patch: Partial<ManagementMember>) => {
    setData((current) => ({ ...current, management: current.management.map((member) => member.id === id ? { ...member, ...patch } : member) }))
  }

  const addMember = () => {
    const member: ManagementMember = { id: crypto.randomUUID(), name: "", role: "", whatsapp: "" }
    setData((current) => ({ ...current, management: [...current.management, member] }))
  }

  const uploadMemberPhoto = async (id: string, file?: File) => {
    if (!file) return
    setStatus("Preparing photo…")
    try {
      const photo = await uploadLeagueImage(file, "management")
      updateMember(id, { photo })
      setStatus("Photo ready. Save management to publish.")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Photo upload failed.")
    }
  }

  const socials = [
    { key: "facebook" as const, label: "Facebook", icon: FacebookLogo },
    { key: "instagram" as const, label: "Instagram", icon: InstagramLogo },
    { key: "youtube" as const, label: "YouTube", icon: YoutubeLogo },
  ]

  return (
    <section className="landing-section home-about" data-reveal>
      <header>
        <span>ABOUT THE LEAGUE</span>
        <h2>Local cricket. Professional presentation.</h2>
      </header>

      <div className="about-social-panel" id="follow-us">
        <div><small>COMMUNITY</small><h3>Follow DPL 6</h3><p>Official match announcements, highlights, team news, and results—all in one place.</p></div>
        <div className="social-link-grid">
          {socials.map(({ key, label, icon: Icon }) => data.socials[key] ? (
            <a key={key} href={data.socials[key]} target="_blank" rel="noreferrer"><Icon /><span>{label}</span><b>↗</b></a>
          ) : (
            <span className="social-link-empty" key={key}><Icon /><span>{label}</span><small>Link coming soon</small></span>
          ))}
        </div>
        {isAdmin && <div className="about-admin-social">
          {socials.map(({ key, label }) => <label key={key}>{label} URL<input value={data.socials[key]} onChange={(event) => setData((current) => ({ ...current, socials: { ...current.socials, [key]: event.target.value } }))} placeholder={`https://${key}.com/...`} /></label>)}
          <button onClick={() => void persist(data, "Social links published.")}><Save /> Save social links</button>
        </div>}
      </div>

      <div className="about-management" id="management">
        <div className="about-section-heading"><div><small>LEADERSHIP</small><h3>DPL 6 Management</h3><p>The people responsible for league direction, fair competition, and match-day operations.</p></div>{isAdmin && <button onClick={addMember}><Plus /> Add member</button>}</div>
        <div className="management-grid">
          {data.management.map((member) => <article key={member.id} className="management-card">
            <div className="management-photo">{member.photo ? <img src={member.photo} alt={member.name || "Management member"} /> : <span>{(member.name || "DPL").slice(0,2).toUpperCase()}</span>}{isAdmin && <label><Upload /> Photo<input type="file" accept="image/*" onChange={(event) => void uploadMemberPhoto(member.id, event.target.files?.[0])} /></label>}</div>
            {isAdmin ? <div className="management-fields"><input value={member.name} onChange={(event) => updateMember(member.id, { name: event.target.value })} placeholder="Full name" /><input value={member.role} onChange={(event) => updateMember(member.id, { role: event.target.value })} placeholder="Management role" /><input value={member.whatsapp} onChange={(event) => updateMember(member.id, { whatsapp: event.target.value })} placeholder="WhatsApp number" /><button className="remove-member" onClick={() => setData((current) => ({ ...current, management: current.management.filter((item) => item.id !== member.id) }))}><Trash2 /> Remove</button></div> : <div className="management-copy"><h4>{member.name || "DPL 6 Management"}</h4><p>{member.role || "League management"}</p>{member.whatsapp && <a href={whatsappUrl(member.whatsapp)} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>}</div>}
          </article>)}
          {!data.management.length && <div className="management-empty">{isAdmin ? "Add the first management member, then save." : "Management profiles will appear here."}</div>}
        </div>
        {isAdmin && <div className="management-save"><span>{status}</span><button onClick={() => void persist(data, "Management profiles published.")}><Save /> Save management</button></div>}
      </div>

      <article className="developer-profile" id="developer">
        <div className="developer-photo"><img src={anasPhoto} alt="Anas Sheikh, CricVault developer" /></div>
        <div className="developer-copy"><small>WEBSITE DEVELOPER</small><h3>Anas Sheikh</h3><span>Noorpur Thal, Pakistan</span><p>Anas Sheikh is the developer behind the complete CricVault experience for Diamond Premier League 6. He designed and built the platform to give local cricket a polished digital home—bringing live scoring, teams, players, fixtures, tournament progress, and official results into one clear and modern system.</p><p>His work focuses on practical technology, dependable match-day tools, and an experience that feels equally refined on Android and desktop.</p><a href="https://wa.me/923221011692" target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp · 0322 1011692</a></div>
      </article>
    </section>
  )
}
