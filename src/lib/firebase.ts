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

const cleanForFirebase = <T,>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T

export const loginWithGoogle = () =>
  signInWithPopup(auth, new GoogleAuthProvider())

export const logoutFirebase = () => signOut(auth)

export const observeFirebaseUser = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback)

export const saveCloudData = async (path: string, value: unknown) => {
  if (!auth.currentUser) throw new Error("Sign in with Google to save online.")
  await set(ref(database, `dpl6/${path}`), cleanForFirebase(value))
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
  if (!user) throw new Error("Sign in with Google before uploading a picture.")
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-")
  const destination = storageRef(
    storage,
    `dpl6/${folder}/${user.uid}/${crypto.randomUUID()}-${safeName}`,
  )
  await uploadBytes(destination, file, { contentType: file.type })
  return getDownloadURL(destination)
}
