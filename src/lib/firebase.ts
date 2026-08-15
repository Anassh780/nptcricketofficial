import { initializeApp } from "firebase/app"
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth"
import { get, getDatabase, onValue, ref, remove, set, update } from "firebase/database"
import { optimizeUploadedImage } from "../components/teams/imageUpload"

const firebaseConfig = {
  apiKey: "AIzaSyD0Xe5iE0tSZZOWwsm5on6T5HViRFqVv2s",
  authDomain: "universal-store-b80a0.firebaseapp.com",
  databaseURL: "https://universal-store-b80a0-default-rtdb.firebaseio.com",
  projectId: "universal-store-b80a0",
  storageBucket: "universal-store-b80a0.firebasestorage.app",
  messagingSenderId: "758108130697",
  appId: "1:758108130697:android:7b9bc478be3e9102e12558",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const database = getDatabase(app)
export type FirebaseUser = User
export const ADMIN_EMAIL = "ghhhbbbhjn3@gmail.com"
const delegatedAdminUids = new Set<string>()
const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const isMainAdmin = (user: User | null | undefined) =>
  normalizeEmail(user?.email || "") === ADMIN_EMAIL
export const isLeagueAdmin = (user: User | null | undefined) =>
  Boolean(user && (isMainAdmin(user) || delegatedAdminUids.has(user.uid)))

const cleanForFirebase = <T,>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T

export const loginWithGoogle = () =>
  signInWithPopup(auth, new GoogleAuthProvider())

export const logoutFirebase = () => signOut(auth)

export const observeConnectionState = (callback: (connected: boolean) => void) =>
  onValue(
    ref(database, ".info/connected"),
    (snapshot) => callback(Boolean(snapshot.val())),
    () => callback(false),
  )

export const observeFirebaseUser = (callback: (user: User | null) => void) => {
  let stopRole: (() => void) | undefined
  const stopAuth = onAuthStateChanged(auth, (user) => {
    stopRole?.()
    stopRole = undefined
    delegatedAdminUids.clear()
    callback(user)
    if (!user?.email) return

    // A candidate record lets the main administrator grant access by email
    // without exposing Firebase user IDs in the interface.
    void set(ref(database, `adminCandidates/${user.uid}`), {
      email: user.email,
      name: user.displayName || "",
      photoURL: user.photoURL || "",
      lastSeenAt: Date.now(),
    }).catch(() => undefined)

    if (isMainAdmin(user)) return
    stopRole = onValue(ref(database, `adminAccess/${user.uid}`), (snapshot) => {
      if (snapshot.val()?.active === true) delegatedAdminUids.add(user.uid)
      else delegatedAdminUids.delete(user.uid)
      callback(user)
    }, () => {
      delegatedAdminUids.delete(user.uid)
      callback(user)
    })
  })
  return () => {
    stopRole?.()
    stopAuth()
  }
}

export type AdminAccessEntry = {
  uid: string
  email: string
  name: string
  photoURL: string
  active: boolean
  grantedAt?: number
}

export const subscribeAdminDirectory = (callback: (entries: AdminAccessEntry[]) => void) => {
  if (!isMainAdmin(auth.currentUser)) throw new Error("Only the main administrator can manage access.")
  let candidates: Record<string, { email?: string; name?: string; photoURL?: string }> = {}
  let access: Record<string, { email?: string; active?: boolean; grantedAt?: number }> = {}
  const publish = () => callback(Object.entries(candidates).map(([uid, candidate]) => ({
    uid,
    email: normalizeEmail(candidate.email || access[uid]?.email || ""),
    name: candidate.name || "",
    photoURL: candidate.photoURL || "",
    active: access[uid]?.active === true,
    grantedAt: access[uid]?.grantedAt,
  })).filter((entry) => entry.email && entry.email !== ADMIN_EMAIL).sort((a, b) => a.email.localeCompare(b.email)))
  const stopCandidates = onValue(ref(database, "adminCandidates"), (snapshot) => {
    candidates = snapshot.val() || {}
    publish()
  })
  const stopAccess = onValue(ref(database, "adminAccess"), (snapshot) => {
    access = snapshot.val() || {}
    publish()
  })
  return () => { stopCandidates(); stopAccess() }
}

export const grantAdminByEmail = async (email: string) => {
  const current = auth.currentUser
  if (!isMainAdmin(current)) throw new Error("Only the main administrator can grant access.")
  const normalized = normalizeEmail(email)
  if (!normalized || !normalized.includes("@")) throw new Error("Enter a valid email address.")
  if (normalized === ADMIN_EMAIL) throw new Error("This is already the permanent main administrator.")
  const snapshot = await get(ref(database, "adminCandidates"))
  const candidates = (snapshot.val() || {}) as Record<string, { email?: string }>
  const match = Object.entries(candidates).find(([, candidate]) => normalizeEmail(candidate.email || "") === normalized)
  if (!match) throw new Error("This email must sign in to CricVault with Google once before access can be granted.")
  await set(ref(database, `adminAccess/${match[0]}`), {
    email: normalized,
    active: true,
    grantedAt: Date.now(),
    grantedBy: current?.email || ADMIN_EMAIL,
  })
}

export const revokeAdminAccess = async (uid: string) => {
  if (!isMainAdmin(auth.currentUser)) throw new Error("Only the main administrator can revoke access.")
  await remove(ref(database, `adminAccess/${uid}`))
}

export const saveCloudData = async (path: string, value: unknown) => {
  if (!isLeagueAdmin(auth.currentUser)) throw new Error("DPL 6 administrator access is required.")
  try {
    await set(ref(database, `dpl6/${path}`), cleanForFirebase(value))
  } catch (error) {
    console.error("Firebase Realtime Database save failed", error)
    throw new Error("Firebase Database is offline or deactivated. Enable Realtime Database in the Firebase Console, then try again.")
  }
}

export const saveCloudItem = async (collection: string, id: string, value: unknown) => {
  if (!isLeagueAdmin(auth.currentUser)) throw new Error("DPL 6 administrator access is required.")
  try {
    await set(ref(database, `dpl6/${collection}/${id}`), cleanForFirebase(value))
  } catch (error) {
    console.error(`Firebase Realtime Database save item failed at dpl6/${collection}/${id}`, error)
    throw new Error("Firebase save failed. Check your internet connection and try again.")
  }
}

export const deleteCloudItem = async (collection: string, id: string) => {
  if (!isLeagueAdmin(auth.currentUser)) throw new Error("DPL 6 administrator access is required.")
  try {
    await remove(ref(database, `dpl6/${collection}/${id}`))
  } catch (error) {
    console.error(`Firebase Realtime Database remove failed at dpl6/${collection}/${id}`, error)
    throw new Error("Firebase delete failed. Check your internet connection and try again.")
  }
}

export const updateCloudItem = async (collection: string, id: string, partial: Record<string, unknown>) => {
  if (!isLeagueAdmin(auth.currentUser)) throw new Error("DPL 6 administrator access is required.")
  try {
    await update(ref(database, `dpl6/${collection}/${id}`), cleanForFirebase(partial))
  } catch (error) {
    console.error(`Firebase Realtime Database update failed at dpl6/${collection}/${id}`, error)
    throw new Error("Firebase update failed. Check your internet connection and try again.")
  }
}

export const fetchCloudData = async <T,>(path: string): Promise<T | null> => {
  try {
    const snapshot = await get(ref(database, `dpl6/${path}`))
    return snapshot.exists() ? (snapshot.val() as T) : null
  } catch (error) {
    console.warn(`Direct fetch failed for dpl6/${path}:`, error)
    return null
  }
}

export const subscribeCloudData = <T,>(
  path: string,
  callback: (value: T) => void,
  onError?: (error: Error) => void,
) => {
  const dbRef = ref(database, `dpl6/${path}`)
  let initialReceived = false

  const performFetch = async () => {
    try {
      const snapshot = await get(dbRef)
      if (snapshot.exists()) {
        callback(snapshot.val() as T)
      }
    } catch (err) {
      console.warn(`Auto-sync fetch failed for dpl6/${path}:`, err)
    }
  }

  // Fast cold-start fetch via get()
  void performFetch()

  // Realtime subscription
  const unsubscribe = onValue(
    dbRef,
    (snapshot) => {
      initialReceived = true
      callback((snapshot.exists() ? snapshot.val() : null) as T)
    },
    (error) => {
      console.error(`Firebase Realtime Database subscription error for dpl6/${path}:`, error)
      onError?.(error)
    },
  )

  // Auto-sync recovery: Re-sync automatically on tab focus, network reconnect, visibility change, and periodic heartbeat
  const handleAutoSync = () => {
    if (document.visibilityState === "visible") {
      void performFetch()
    }
  }

  const handleOnline = () => {
    void performFetch()
  }

  window.addEventListener("focus", handleAutoSync)
  window.addEventListener("visibilitychange", handleAutoSync)
  window.addEventListener("online", handleOnline)

  // Periodic 25s auto-sync heartbeat in background to guarantee zero missing data
  const heartbeat = window.setInterval(() => {
    if (document.visibilityState === "visible" && navigator.onLine) {
      void performFetch()
    }
  }, 25000)

  return () => {
    unsubscribe()
    window.removeEventListener("focus", handleAutoSync)
    window.removeEventListener("visibilitychange", handleAutoSync)
    window.removeEventListener("online", handleOnline)
    window.clearInterval(heartbeat)
  }
}

export const uploadLeagueImage = async (file: File, folder: string) => {
  const user = auth.currentUser
  if (!isLeagueAdmin(user)) throw new Error("DPL 6 administrator access is required.")
  // Compress images to lightweight WebP data (under 20KB) so Realtime Database payloads remain small and fast on all mobile connections.
  const isPlayer = folder.includes("players")
  return optimizeUploadedImage(file, isPlayer ? 280 : 400, isPlayer ? 0.72 : 0.75)
}
