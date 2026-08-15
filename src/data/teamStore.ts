import {
  auth,
  deleteCloudItem,
  isLeagueAdmin,
  saveCloudData,
  saveCloudItem,
  subscribeCloudData,
} from "../lib/firebase"

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
