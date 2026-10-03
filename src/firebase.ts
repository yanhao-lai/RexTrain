import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type Auth, type User } from 'firebase/auth'
import { collection, deleteDoc, doc, getDoc, getFirestore, onSnapshot, setDoc, type Firestore } from 'firebase/firestore'
import type { Question } from './model'

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
export const firebaseConfigured = Boolean(projectId && import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_AUTH_DOMAIN && import.meta.env.VITE_FIREBASE_APP_ID)
const app: FirebaseApp | null = firebaseConfigured ? initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}) : null
const auth: Auth | null = app ? getAuth(app) : null
const db: Firestore | null = app ? getFirestore(app) : null
const demoKey = 'rextrain-local-questions-v1'

export function subscribeQuestions(onChange: (questions: Question[]) => void, onError: (message: string) => void): () => void {
  if (!db) {
    try { onChange(JSON.parse(localStorage.getItem(demoKey) || '[]') as Question[]) }
    catch { onChange([]) }
    return () => undefined
  }
  return onSnapshot(collection(db, 'questions'), (snapshot) => {
    onChange(snapshot.docs.map((item) => item.data() as Question))
  }, (error) => onError(`題庫讀取失敗：${error.message}`))
}

export function subscribeAdmin(onChange: (user: User | null, admin: boolean) => void): () => void {
  if (!auth || !db) { onChange(null, import.meta.env.DEV); return () => undefined }
  return onAuthStateChanged(auth, async (user) => {
    if (!user) { onChange(null, false); return }
    try {
      const allowed = await getDoc(doc(db!, 'admins', user.uid))
      onChange(user, allowed.exists())
    } catch { onChange(user, false) }
  })
}

export async function loginAdmin(): Promise<void> {
  if (!auth) return
  const provider = new GoogleAuthProvider()
  if (/Android|iPad|iPhone|iPod/i.test(navigator.userAgent)) await signInWithRedirect(auth, provider)
  else await signInWithPopup(auth, provider)
}

export async function logoutAdmin(): Promise<void> {
  if (auth) await signOut(auth)
}

export async function saveQuestion(question: Question): Promise<void> {
  if (!db) {
    if (!import.meta.env.DEV) throw new Error('Firebase 尚未設定，無法儲存題目')
    const stored = JSON.parse(localStorage.getItem(demoKey) || '[]') as Question[]
    localStorage.setItem(demoKey, JSON.stringify([...stored.filter((item) => item.id !== question.id), question]))
    return
  }
  await setDoc(doc(db, 'questions', question.id), question)
}

export async function removeQuestion(id: string): Promise<void> {
  if (!db) {
    if (!import.meta.env.DEV) throw new Error('Firebase 尚未設定，無法刪除題目')
    const stored = JSON.parse(localStorage.getItem(demoKey) || '[]') as Question[]
    localStorage.setItem(demoKey, JSON.stringify(stored.filter((item) => item.id !== id)))
    return
  }
  await deleteDoc(doc(db, 'questions', id))
}
