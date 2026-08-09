import { useEffect, useRef, useState } from "react"
import type { FirebaseUser } from "../../lib/firebase"
import "./cricvault-nav.css"

export type NavScreen = "home" | "matches" | "series" | "teams" | "players" | "scoring" | "points"

type CricVaultNavProps = {
  screen: NavScreen
  onNavigate: (screen: NavScreen) => void
  user: FirebaseUser | null
  onLogin: () => void
  onLogout: () => void
  isAdmin: boolean
}

const primaryLinks: Array<{ label: string; screen: NavScreen }> = [
  { label: "Home", screen: "home" },
  { label: "Matches", screen: "matches" },
  { label: "Series", screen: "series" },
  { label: "Teams", screen: "teams" },
  { label: "Players", screen: "players" },
]

export function CricVaultBrand() {
  return (
    <span className="cv-wordmark-brand">
      <span className="cv-mark" aria-hidden="true">V</span>
      <span className="cv-wordmark-copy">
        <strong>CRIC<span>VAULT</span></strong>
        <small>DPL 6</small>
      </span>
    </span>
  )
}

export default function CricVaultNav({
  screen,
  onNavigate,
  user,
  onLogin,
  onLogout,
  isAdmin,
}: CricVaultNavProps) {
  const navRef = useRef<HTMLElement>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        setAdvancedOpen(false)
        setMobileOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAdvancedOpen(false)
        setMobileOpen(false)
      }
    }
    document.addEventListener("mousedown", closeMenus)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("mousedown", closeMenus)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [])

  const goTo = (next: NavScreen) => {
    onNavigate(next)
    setAdvancedOpen(false)
    setMobileOpen(false)
  }

  const advancedActive = screen === "scoring" || screen === "points"

  return (
    <header ref={navRef} className="cv-nav-shell">
      <button className="cv-wordmark" onClick={() => goTo("home")} aria-label="CricVault home">
        <CricVaultBrand />
      </button>

      <nav className="cv-desktop-links" aria-label="Primary navigation">
        {primaryLinks.map((link) => (
          <button
            key={link.screen}
            className={screen === link.screen ? "is-active" : ""}
            onClick={() => goTo(link.screen)}
            aria-current={screen === link.screen ? "page" : undefined}
          >
            {link.label}
          </button>
        ))}

        {isAdmin && (
          <div className="cv-advanced-wrap">
            <button
              className={advancedActive ? "is-active" : ""}
              onClick={() => setAdvancedOpen((open) => !open)}
              aria-expanded={advancedOpen}
              aria-controls="cv-advanced-menu"
            >
              Advanced <span className="cv-chevron" aria-hidden="true">⌄</span>
            </button>

            {advancedOpen && (
              <div id="cv-advanced-menu" className="cv-mega-menu">
                <div className="cv-mega-intro">
                  <span className="cv-kicker">DPL 6 CONTROL CENTER</span>
                  <h2>Run every match from one place.</h2>
                  <p>Configure squads, score live innings, close results, and update the league table.</p>
                  <button onClick={() => goTo("scoring")}>Open scoring studio <span>→</span></button>
                </div>

                <div className="cv-mega-grid">
                  <button onClick={() => goTo("scoring")}>
                    <span className="cv-menu-number">01</span>
                    <span><b>Live scoring</b><small>Ball-by-ball match control</small></span>
                    <i aria-hidden="true">↗</i>
                  </button>
                  <button onClick={() => goTo("points")}>
                    <span className="cv-menu-number">02</span>
                    <span><b>Points table</b><small>Standings and run rate</small></span>
                    <i aria-hidden="true">↗</i>
                  </button>
                  <button onClick={() => goTo("matches")}>
                    <span className="cv-menu-number">03</span>
                    <span><b>Match records</b><small>Results and scorecards</small></span>
                    <i aria-hidden="true">↗</i>
                  </button>
                  <button onClick={() => goTo("teams")}>
                    <span className="cv-menu-number">04</span>
                    <span><b>League squads</b><small>Teams, logos, and players</small></span>
                    <i aria-hidden="true">↗</i>
                  </button>
                </div>

                <div className="cv-mega-status">
                  <span><i /> Firebase league data connected</span>
                  <strong>ADMIN ACCESS</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="cv-nav-actions">
        <button className="cv-auth" onClick={user ? onLogout : onLogin} title={user?.email || "Sign in with Google"}>
          {user?.photoURL ? <img src={user.photoURL} alt="" /> : <span aria-hidden="true">G</span>}
          <b>{isAdmin ? "Admin" : user ? "Account" : "Log in"}</b>
        </button>
        {isAdmin && <button className="cv-primary-action" onClick={() => goTo("scoring")}><span aria-hidden="true">▶</span> Score live</button>}
        <button
          className={`cv-menu-toggle ${mobileOpen ? "is-open" : ""}`}
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation menu"
        >
          <i /><i />
        </button>
      </div>

      {mobileOpen && (
        <div className="cv-mobile-menu">
          <span className="cv-kicker">EXPLORE CRICVAULT</span>
          <div>
            {primaryLinks.map((link) => (
              <button key={link.screen} className={screen === link.screen ? "is-active" : ""} onClick={() => goTo(link.screen)}>
                <span>{link.label}</span><i aria-hidden="true">→</i>
              </button>
            ))}
            <button onClick={() => goTo("points")} className={screen === "points" ? "is-active" : ""}>
              <span>Points table</span><i aria-hidden="true">→</i>
            </button>
            {isAdmin && <button onClick={() => goTo("scoring")} className={screen === "scoring" ? "is-active" : ""}>
              <span>Advanced scoring</span><i aria-hidden="true">→</i>
            </button>}
          </div>
          <button className="cv-mobile-auth" onClick={user ? onLogout : onLogin}>{user ? "Sign out" : "Admin login"}</button>
        </div>
      )}
    </header>
  )
}
