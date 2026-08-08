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
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from "firebase/storage"
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
export const storage = getStorage(app)
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
  } catch {
    throw new Error("Online save failed. Re-enable Firebase Realtime Database and deploy the DPL 6 rules.")
  }
}

export const subscribeCloudData = <T,>(
  path: string,
  callback: (value: T) => void,
) => onValue(
  ref(database, `dpl6/${path}`),
  (snapshot) => {
    if (snapshot.exists()) callback(snapshot.val() as T)
  },
  () => undefined,
)

export const uploadLeagueImage = async (file: File, folder: string) => {
  const user = auth.currentUser
  if (!isLeagueAdmin(user)) throw new Error("DPL 6 administrator access is required.")
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-")
  const destination = storageRef(
    storage,
    `dpl6/${folder}/${user.uid}/${crypto.randomUUID()}-${safeName}`,
  )
  try {
    await uploadBytes(destination, file, { contentType: file.type })
    return await getDownloadURL(destination)
  } catch {
    // Firebase Storage is optional: a compressed data URL is saved inside the
    // authenticated Realtime Database record when a bucket is not provisioned.
    return optimizeUploadedImage(file, folder.includes("players") ? 420 : 720)
  }
}
