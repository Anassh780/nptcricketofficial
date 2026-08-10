import type { ElementType } from "react"
import {
  Activity,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  Code2,
  Heart,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
  UsersRound,
  UserCog,
} from "lucide-react"
import type { NavScreen } from "./navigation-types"

type DropdownType = "matches" | "league" | "about" | "control"

type DropdownItem = {
  icon: ElementType
  title: string
  description: string
  screen?: NavScreen
  anchor?: string
  badge?: string
}

const menuContent: Record<DropdownType, {
  eyebrow: string
  featureTitle: string
  featureDescription: string
  featureScreen: NavScreen
  featureAnchor?: string
  items: DropdownItem[]
}> = {
  matches: {
    eyebrow: "MATCH CENTER",
    featureTitle: "DPL 6 fixtures",
    featureDescription: "Follow upcoming matches and open complete records when play finishes.",
    featureScreen: "matches",
    items: [
      { icon: CalendarDays, title: "Fixtures", description: "Upcoming and completed DPL 6 matches", screen: "matches", badge: "Live" },
      { icon: BookOpen, title: "Match records", description: "Full batting and bowling scorecards", screen: "matches" },
      { icon: ChartNoAxesCombined, title: "Points table", description: "Standings, wins, losses, and run rate", screen: "points" },
    ],
  },
  league: {
    eyebrow: "LEAGUE DIRECTORY",
    featureTitle: "Diamond Premier League 6",
    featureDescription: "Explore the tournament tree, registered squads, and player gallery.",
    featureScreen: "series",
    items: [
      { icon: Trophy, title: "Tournament series", description: "Groups, qualifiers, and knockout path", screen: "series" },
      { icon: ShieldCheck, title: "Teams", description: "Official team cards, logos, and squads", screen: "teams" },
      { icon: UsersRound, title: "Players", description: "DPL 6 player gallery and profiles", screen: "players" },
    ],
  },
  about: {
    eyebrow: "ABOUT DPL 6",
    featureTitle: "The league behind the game",
    featureDescription: "Meet the management, follow the tournament, and discover who builds the platform.",
    featureScreen: "home",
    featureAnchor: "management",
    items: [
      { icon: Heart, title: "Follow us", description: "DPL 6 news, highlights, and community", anchor: "follow-us" },
      { icon: BriefcaseBusiness, title: "DPL 6 Management", description: "League leadership and match operations", anchor: "management" },
      { icon: Code2, title: "Developer", description: "The technology behind CricVault", anchor: "developer" },
    ],
  },
  control: {
    eyebrow: "ADMIN OPERATIONS",
    featureTitle: "Scoring control room",
    featureDescription: "Set up the match, score every ball, and publish the official result.",
    featureScreen: "scoring",
    items: [
      { icon: Radio, title: "Live scoring", description: "Ball-by-ball innings controls", screen: "scoring", badge: "Admin" },
      { icon: Activity, title: "Match operations", description: "Review fixtures, winners, and records", screen: "matches" },
      { icon: UsersRound, title: "Squad management", description: "Manage teams, logos, and player data", screen: "teams" },
      { icon: UserCog, title: "Admin access", description: "Main admin can grant or revoke access", screen: "admin" },
    ],
  },
}

export type { DropdownType }

export default function DropdownMenu({
  type,
  onNavigate,
  onAnchor,
}: {
  type: DropdownType
  onNavigate: (screen: NavScreen) => void
  onAnchor: (anchor: string) => void
}) {
  const content = menuContent[type]
  return (
    <div className="cv-dropdown pointer-events-auto absolute top-full left-1/2 z-50 mt-3 w-[600px] max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[#08151b]/95 p-4 text-left shadow-[0_28px_70px_rgba(0,0,0,0.78)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-[#91e521]/8 blur-3xl" />
      <div className="relative z-10 grid grid-cols-12 gap-4">
        <div className="col-span-8 space-y-1">
          <div className="mb-2 px-2 text-[9px] font-bold tracking-[0.2em] text-[#91e521]">{content.eyebrow}</div>
          {content.items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.title}
                onClick={() => item.anchor ? onAnchor(item.anchor) : item.screen && onNavigate(item.screen)}
                className="group flex w-full items-start gap-3 rounded-xl border border-transparent p-2.5 text-left transition-all duration-150 hover:border-white/5 hover:bg-white/[0.06]"
              >
                <span className="mt-0.5 shrink-0 rounded-lg border border-white/10 bg-white/[0.055] p-2 text-zinc-300 transition-all group-hover:border-[#91e521]/25 group-hover:text-[#aaff3c]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <b className="text-sm font-semibold text-zinc-200 group-hover:text-white">{item.title}</b>
                    {item.badge && <small className="rounded-full border border-[#91e521]/20 bg-[#91e521]/10 px-1.5 py-0.5 text-[9px] font-bold text-[#aaff3c]">{item.badge}</small>}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-zinc-500 group-hover:text-zinc-400">{item.description}</span>
                </span>
                <ArrowRight className="mt-3 h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-[#91e521]" />
              </button>
            )
          })}
        </div>

        <button
          onClick={() => content.featureAnchor ? onAnchor(content.featureAnchor) : onNavigate(content.featureScreen)}
          className="group col-span-4 flex flex-col justify-between rounded-xl border border-white/10 bg-zinc-950/45 p-4 text-left transition-colors hover:border-[#91e521]/25"
        >
          <span>
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] font-medium text-zinc-300">
              <Sparkles className="h-3 w-3 text-[#aaff3c]" /> Featured
            </span>
            <strong className="block font-['Rajdhani'] text-lg font-bold text-white">{content.featureTitle}</strong>
            <span className="mt-1.5 block text-xs leading-relaxed text-zinc-500">{content.featureDescription}</span>
          </span>
          <span className="flex items-center justify-between border-t border-white/10 pt-3 text-xs font-semibold text-white">
            Explore section <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </span>
        </button>
      </div>
    </div>
  )
}
