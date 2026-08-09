import { useEffect, useRef, useState } from "react"
import { ChevronDown, Menu, Play, X } from "lucide-react"
import type { FirebaseUser } from "../../lib/firebase"
import DropdownMenu, { type DropdownType } from "./DropdownMenu"
import type { NavScreen } from "./navigation-types"
import "./navbar-motion.css"

export type { NavScreen } from "./navigation-types"

type NavbarProps = {
  screen: NavScreen
  onNavigate: (screen: NavScreen) => void
  user: FirebaseUser | null
  onLogin: () => void
  onLogout: () => void
  isAdmin: boolean
}

const mobileMenus: Array<{ type: DropdownType; label: string; entries: Array<[string, NavScreen]> }> = [
  { type: "matches", label: "Matches", entries: [["Fixtures & results", "matches"], ["Points table", "points"]] },
  { type: "league", label: "League", entries: [["Tournament series", "series"], ["Teams", "teams"], ["Players", "players"]] },
  { type: "control", label: "Control", entries: [["Live scoring", "scoring"], ["Match operations", "matches"], ["Squad management", "teams"]] },
]

export function NavbarBrand() {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-[#17242a] text-[#91e521] shadow-inner ring-1 ring-inset ring-white/5 transition-colors group-hover:bg-[#213239]">
        <span className="font-['Rajdhani'] text-xs font-black">CV</span>
      </span>
      <span className="flex items-center gap-2">
        <strong className="font-['Rajdhani'] text-[18px] font-extrabold tracking-tight text-white">CRIC<span className="text-[#91e521]">VAULT</span></strong>
        <small className="rounded-full border border-[#91e521]/20 bg-[#91e521]/8 px-1.5 py-1 text-[8px] font-bold tracking-wider text-zinc-400">DPL 6</small>
      </span>
    </span>
  )
}

export default function Navbar({ screen, onNavigate, user, onLogin, onLogout, isAdmin }: NavbarProps) {
  const [activeDropdown, setActiveDropdown] = useState<DropdownType | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileAccordion, setMobileAccordion] = useState<DropdownType | null>(null)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20)
    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setActiveDropdown(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveDropdown(null)
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  const goTo = (next: NavScreen) => {
    onNavigate(next)
    setActiveDropdown(null)
    setMobileMenuOpen(false)
    setMobileAccordion(null)
  }

  const toggleDropdown = (type: DropdownType) => setActiveDropdown((current) => current === type ? null : type)
  const dropdownActive = (type: DropdownType) => {
    if (type === "matches") return screen === "matches" || screen === "points"
    if (type === "league") return screen === "series" || screen === "teams" || screen === "players"
    return screen === "scoring"
  }

  return (
    <>
      <header className="pointer-events-none fixed left-0 right-0 top-4 z-[100] flex justify-center px-4">
        <div
          ref={navRef}
          className={`pointer-events-auto relative w-full max-w-5xl rounded-full border px-3 transition-all duration-300 ease-out sm:px-4 ${
            isScrolled
              ? "border-white/15 bg-[#07141a]/88 py-2 shadow-[0_18px_48px_rgba(0,0,0,0.62)] backdrop-blur-2xl"
              : "border-white/10 bg-[#07141a]/58 py-2.5 shadow-[0_10px_38px_rgba(0,0,0,0.4)] backdrop-blur-[22px]"
          }`}
        >
          <div className="flex items-center justify-between">
            <button className="group shrink-0 focus:outline-none" onClick={() => goTo("home")} aria-label="CricVault home"><NavbarBrand /></button>

            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
              <button onClick={() => goTo("home")} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${screen === "home" ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`}>Home</button>
              {(["matches", "league"] as DropdownType[]).map((type) => (
                <div className="relative" key={type}>
                  <button
                    onClick={() => toggleDropdown(type)}
                    aria-expanded={activeDropdown === type}
                    className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${dropdownActive(type) || activeDropdown === type ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`}
                  >
                    {type === "matches" ? "Matches" : "League"}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${activeDropdown === type ? "rotate-180 text-[#91e521]" : "text-zinc-500"}`} />
                  </button>
                  {activeDropdown === type && <DropdownMenu type={type} onNavigate={goTo} />}
                </div>
              ))}
              <button onClick={() => goTo("series")} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${screen === "series" ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`}>Series</button>
              <button onClick={() => goTo("players")} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${screen === "players" ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`}>Players</button>
              {isAdmin && (
                <div className="relative">
                  <button onClick={() => toggleDropdown("control")} aria-expanded={activeDropdown === "control"} className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${dropdownActive("control") || activeDropdown === "control" ? "bg-[#91e521]/10 text-[#b2ff4d]" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"}`}>
                    Control <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${activeDropdown === "control" ? "rotate-180" : ""}`} />
                  </button>
                  {activeDropdown === "control" && <DropdownMenu type="control" onNavigate={goTo} />}
                </div>
              )}
            </nav>

            <div className="hidden items-center gap-2 md:flex">
              <button onClick={user ? onLogout : onLogin} className="rounded-full px-3.5 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:text-white">{isAdmin ? "Admin" : user ? "Account" : "Log in"}</button>
              <button onClick={() => goTo(isAdmin ? "scoring" : "points")} className="flex items-center gap-2 rounded-full bg-[#f4f4f5] px-4 py-1.5 text-sm font-semibold text-zinc-950 shadow-sm transition-all hover:scale-[1.02] hover:bg-white active:scale-[0.98]">
                {isAdmin && <Play className="h-3 w-3 fill-current" />}{isAdmin ? "Score live" : "View table"}
              </button>
            </div>

            <button onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? "Close menu" : "Open menu"} className="rounded-full p-2 text-zinc-300 transition-colors hover:bg-white/10 hover:text-white md:hidden">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="cv-mobile-panel mt-3 space-y-1 border-t border-white/10 pt-3 md:hidden">
              <button onClick={() => goTo("home")} className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-white">Home</button>
              {mobileMenus.filter((menu) => menu.type !== "control" || isAdmin).map((menu) => (
                <div key={menu.type}>
                  <button onClick={() => setMobileAccordion((current) => current === menu.type ? null : menu.type)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-white">
                    {menu.label}<ChevronDown className={`h-4 w-4 transition-transform ${mobileAccordion === menu.type ? "rotate-180 text-[#91e521]" : "text-zinc-500"}`} />
                  </button>
                  {mobileAccordion === menu.type && (
                    <div className="cv-mobile-accordion ml-3 space-y-1 border-l border-white/10 py-1 pl-4">
                      {menu.entries.map(([label, next]) => <button key={label} onClick={() => goTo(next)} className="block w-full py-1.5 text-left text-xs text-zinc-500 hover:text-white">{label}</button>)}
                    </div>
                  )}
                </div>
              ))}
              <div className="flex flex-col gap-2 border-t border-white/10 pt-3">
                <button onClick={user ? onLogout : onLogin} className="w-full rounded-xl bg-white/5 py-2 text-sm font-medium text-zinc-300">{user ? "Sign out" : "Admin login"}</button>
                <button onClick={() => goTo(isAdmin ? "scoring" : "points")} className="w-full rounded-full bg-[#f4f4f5] py-2.5 text-sm font-semibold text-zinc-950">{isAdmin ? "Open scoring" : "View points table"}</button>
              </div>
            </div>
          )}
        </div>
      </header>
      <div className="h-[88px]" aria-hidden="true" />
    </>
  )
}

