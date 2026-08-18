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
export const TEAM_UPDATE_EVENT = "cricvault:teams-updated"

const normalizePlayerName = (name: string) =>
  name.trim().toLocaleLowerCase().replace(/\s+/g, " ")

export type TeamLinkedLeaguePlayer = {
  id: string
  name: string
  city: string
  photo: string
  createdAt: number
  createdBy: string
  teamId: string
  teamName: string
  source: "team-roster"
}

/**
 * Upserts only roster-owned player records. Existing gallery metadata is
 * preserved, unrelated records are never replaced, and repeated calls are
 * idempotent.
 */
export async function syncTeamPlayersToDirectory(teams: SharedTeamProfile[]) {
  if (!isLeagueAdmin(auth.currentUser)) return

  const stored = await fetchCloudData<Record<string, Partial<TeamLinkedLeaguePlayer>> | TeamLinkedLeaguePlayer[]>("players")
  const existing = stored && typeof stored === "object"
    ? (Array.isArray(stored) ? stored : Object.values(stored)).filter(Boolean)
    : []

  for (const team of teams) {
    for (const rosterPlayer of team.players || []) {
      const name = rosterPlayer?.name?.trim()
      if (!name) continue

      const normalizedName = normalizePlayerName(name)
      const byId = existing.find((player) => player.id === rosterPlayer.id)
      const byTeamAndName = existing.find((player) =>
        player.teamId === team.id && normalizePlayerName(player.name || "") === normalizedName,
      )
      const current = byId || byTeamAndName
      const id = current?.id || rosterPlayer.id
      if (!id) continue

      const next: TeamLinkedLeaguePlayer = {
        ...(current as TeamLinkedLeaguePlayer | undefined),
        id,
        name,
        city: current?.city || team.name || "DPL 6",
        photo: rosterPlayer.photo || current?.photo || "",
        createdAt: current?.createdAt || Date.now(),
        createdBy: current?.createdBy || auth.currentUser?.uid || "admin",
        teamId: team.id,
        teamName: team.name,
        source: "team-roster",
      }

      const unchanged = current && Object.entries(next).every(
        ([key, value]) => current[key as keyof typeof current] === value,
      )
      if (!unchanged) {
        await saveCloudItem("players", id, next)
        const index = existing.indexOf(current || {})
        if (index >= 0) existing[index] = next
        else existing.push(next)
      }
    }
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
