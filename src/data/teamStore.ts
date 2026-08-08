import { auth, isLeagueAdmin, saveCloudData, subscribeCloudData } from "../lib/firebase"

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

export function loadTeamProfiles(fallback: SharedTeamProfile[]): SharedTeamProfile[] {
  try {
    const stored = localStorage.getItem(TEAM_STORAGE_KEY)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

export function saveTeamProfiles(teams: SharedTeamProfile[]) {
  localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(teams))
  window.dispatchEvent(new CustomEvent(TEAM_UPDATE_EVENT, { detail: teams }))
  return isLeagueAdmin(auth.currentUser)
    ? saveCloudData("teams", teams)
    : Promise.resolve()
}

export function subscribeTeamProfiles(
  callback: (teams: SharedTeamProfile[]) => void,
) {
  return subscribeCloudData<SharedTeamProfile[]>("teams", (teams) => {
    if (!Array.isArray(teams)) return
    localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(teams))
    callback(teams)
  })
}
