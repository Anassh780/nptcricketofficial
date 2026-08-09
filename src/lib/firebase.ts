import { initializeApp } from "firebase/app"
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth"
import { getDatabase, onValue, ref, set } from "firebase/database"
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
export const isLeagueAdmin = (user: User | null | undefined) =>
  user?.email?.toLowerCase() === ADMIN_EMAIL

const cleanForFirebase = <T,>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T

export const loginWithGoogle = () =>
  signInWithPopup(auth, new GoogleAuthProvider())

export const logoutFirebase = () => signOut(auth)

export const observeFirebaseUser = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback)

export const saveCloudData = async (path: string, value: unknown) => {
  if (!isLeagueAdmin(auth.currentUser)) throw new Error("DPL 6 administrator access is required.")
  try {
    await set(ref(database, `dpl6/${path}`), cleanForFirebase(value))
  } catch (error) {
    console.error("Firebase Realtime Database save failed", error)
    throw new Error("Firebase Database is offline or deactivated. Enable Realtime Database in the Firebase Console, then try again.")
  }
}

export const subscribeCloudData = <T,>(
  path: string,
  callback: (value: T) => void,
) => onValue(
  ref(database, `dpl6/${path}`),
  (snapshot) => {
    callback((snapshot.exists() ? snapshot.val() : null) as T)
  },
  () => undefined,
)

export const uploadLeagueImage = async (file: File, folder: string) => {
  const user = auth.currentUser
  if (!isLeagueAdmin(user)) throw new Error("DPL 6 administrator access is required.")
  // This Firebase project does not currently have a working Storage bucket.
  // Keep profile images small and save them with their Realtime Database record
  // so team logos and player portraits remain available everywhere in the app.
  return optimizeUploadedImage(file, folder.includes("players") ? 480 : 1000, folder.includes("players") ? 0.84 : 0.88)
}
