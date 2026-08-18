import {
  auth,
  deleteCloudItem,
  isLeagueAdmin,
  fetchCloudData,
  saveCloudData,
  saveCloudItem,
  subscribeCloudData,
} from "../lib/firebase"

export const TEAM_ROSTER_SIZE = 12
export const PLAYING_XI_SIZE = 11

export type SharedPlayerProfile = { id: string; name: string; photo: string }
export type SharedTeamProfile = {
  id: string
  name: string
  code: string
  color: string
  logo: string
  players: SharedPlayerProfile[]
}

export const TEAM_STORAGE_KEY = "cricvault-teams-gallery-v2"
export const PLAYER_DIRECTORY_STORAGE_KEY = "dpl6-player-gallery-v2"
export const TEAM_UPDATE_EVENT = "cricvault:teams-updated"
export const PLAYER_DIRECTORY_UPDATE_EVENT = "cricvault:players-updated"

const normalizePlayerName = (name: string) =>
  name.trim().toLocaleLowerCase().replace(/\s+/g, " ")

const playerPhoto = (player: Record<string, unknown>) =>
  String(player.photo || player.picture || player.photoURL || player.avatarUrl || "")

export type TeamLinkedLeaguePlayer = {
  id: string
  name: string
  city: string
  photo: string
  createdAt: number
  createdBy: string
  teamId: string
  teamName: string
  source?: string
  [key: string]: unknown
}

/** Merge roster fields into the directory while retaining directory metadata. */
export function mergeTeamPlayersIntoDirectory(
  players: Partial<TeamLinkedLeaguePlayer>[],
  teams: SharedTeamProfile[],
  createdAt = Date.now(),
) {
  const merged = players.filter(Boolean).map((player) => ({
    ...player,
    photo: playerPhoto(player),
  }))

  for (const team of teams) {
    for (const rosterPlayer of team.players || []) {
      const name = rosterPlayer?.name?.trim()
      if (!name) continue

      const normalizedName = normalizePlayerName(name)
      const byId = merged.find((player) => String(player.id || "") === rosterPlayer.id)
      const byTeamAndName = merged.find((player) => {
        const storedTeamName = String(player.teamName || (player as Record<string, unknown>).team || "")
        const sameTeam = player.teamId === team.id || (
          !player.teamId && normalizePlayerName(storedTeamName) === normalizePlayerName(team.name)
        )
        return sameTeam && normalizePlayerName(String(player.name || "")) === normalizedName
      })
      const current = byId || byTeamAndName
      const id = String(current?.id || rosterPlayer.id || "")
      if (!id) continue

      const next: TeamLinkedLeaguePlayer = {
        ...current,
        id,
        name,
        city: String(current?.city || team.name || "DPL 6"),
        // A selected roster photo is explicit and wins; otherwise retain the
        // existing directory portrait, including legacy picture field shapes.
        photo: rosterPlayer.photo || playerPhoto(current || {}),
        createdAt: typeof current?.createdAt === "number" ? current.createdAt : createdAt,
        createdBy: String(current?.createdBy || auth.currentUser?.uid || "admin"),
        teamId: team.id,
        teamName: team.name,
        source: current?.source || "team-roster",
      }

      const index = current ? merged.indexOf(current) : -1
      if (index >= 0) merged[index] = next
      else merged.push(next)
    }
  }

  return merged as TeamLinkedLeaguePlayer[]
}

export function updateLocalPlayerDirectory(teams: SharedTeamProfile[]) {
  let existing: Partial<TeamLinkedLeaguePlayer>[] = []
  try {
    const cached = localStorage.getItem(PLAYER_DIRECTORY_STORAGE_KEY)
    existing = cached ? JSON.parse(cached) : []
  } catch {
    existing = []
  }
  const merged = mergeTeamPlayersIntoDirectory(existing, teams)
  try {
    localStorage.setItem(PLAYER_DIRECTORY_STORAGE_KEY, JSON.stringify(merged))
  } catch (error) {
    console.warn("Could not cache the optimistic player directory", error)
  }
  window.dispatchEvent(new CustomEvent(PLAYER_DIRECTORY_UPDATE_EVENT, { detail: merged }))
}

/** Persist exactly the same duplicate-safe merge used by the optimistic UI. */
export async function syncTeamPlayersToDirectory(teams: SharedTeamProfile[]) {
  if (!isLeagueAdmin(auth.currentUser)) return

  const stored = await fetchCloudData<Record<string, Partial<TeamLinkedLeaguePlayer>> | TeamLinkedLeaguePlayer[]>("players")
  const existing = stored && typeof stored === "object"
    ? (Array.isArray(stored) ? stored : Object.values(stored)).filter(Boolean)
    : []
  const merged = mergeTeamPlayersIntoDirectory(existing, teams)

  for (const next of merged) {
    const current = existing.find((player) => player.id === next.id)
    const unchanged = current && Object.entries(next).every(
      ([key, value]) => current[key as keyof typeof current] === value,
    )
    if (!unchanged && next.teamId) await saveCloudItem("players", next.id, next)
  }
}

export function normalizeTeamArray(value: unknown): SharedTeamProfile[] {
  if (!value) return []
  const rawList: any[] = Array.isArray(value) ? value : Object.values(value)
  return rawList.filter((item) => item && typeof item === "object" && (item.name || item.code || item.id))
}

export function loadTeamProfiles(fallback: SharedTeamProfile[]): SharedTeamProfile[] {
  try {
    const stored = localStorage.getItem(TEAM_STORAGE_KEY)
    if (!stored) return fallback
    const parsed = JSON.parse(stored)
    return normalizeTeamArray(parsed)
  } catch {
    return fallback
  }
}

export function saveTeamProfiles(teams: SharedTeamProfile[]) {
  try {
    localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(teams))
  } catch (error) {
    console.warn("Could not cache team profiles locally", error)
  }
  window.dispatchEvent(new CustomEvent(TEAM_UPDATE_EVENT, { detail: teams }))
  return isLeagueAdmin(auth.currentUser)
    ? saveCloudData("teams", teams)
    : Promise.resolve()
}

export function saveSingleTeamProfile(team: SharedTeamProfile) {
  if (!isLeagueAdmin(auth.currentUser)) return Promise.resolve()
  return saveCloudItem("teams", team.id, team)
}

export function deleteSingleTeamProfile(teamId: string) {
  if (!isLeagueAdmin(auth.currentUser)) return Promise.resolve()
  return deleteCloudItem("teams", teamId)
}

export function subscribeTeamProfiles(
  callback: (teams: SharedTeamProfile[]) => void,
) {
  return subscribeCloudData<SharedTeamProfile[] | Record<string, SharedTeamProfile> | null>("teams", (teams) => {
    const onlineTeams = normalizeTeamArray(teams)
    try {
      localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(onlineTeams))
    } catch {
      // ignore quota in background
    }
    callback(onlineTeams)
  })
}
