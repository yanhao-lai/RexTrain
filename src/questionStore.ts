import type { Question } from './model'

const draftKey = 'rextrain-question-drafts-v1'

export function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== 'object') return false
  const q = value as Partial<Question>
  return typeof q.id === 'string' && q.id.length > 0 &&
    (q.type === 'choice' || q.type === 'order' || q.type === 'audio') &&
    (q.level === 1 || q.level === 2 || q.level === 3) &&
    typeof q.prompt === 'string' && typeof q.answer === 'string' &&
    Array.isArray(q.options) && q.options.every((option) => typeof option === 'string') &&
    typeof q.speechText === 'string' && typeof q.enabled === 'boolean'
}

export function readDrafts(): Question[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(draftKey) || '[]')
    return Array.isArray(value) ? value.filter(isQuestion) : []
  } catch { return [] }
}

export function subscribeQuestions(onChange: (questions: Question[]) => void, onError: (message: string) => void): () => void {
  let active = true
  fetch(`${import.meta.env.BASE_URL}questions.json`, { cache: 'no-cache' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const value: unknown = await response.json()
      if (!Array.isArray(value) || !value.every(isQuestion)) throw new Error('題庫檔格式錯誤')
      return value as Question[]
    })
    .then((published) => { if (active) onChange([...published, ...readDrafts()]) })
    .catch((error) => {
      if (active) { onChange(readDrafts()); onError(`公開題庫讀取失敗，仍可使用內建題目：${String(error)}`) }
    })
  return () => { active = false }
}

export function saveQuestion(question: Question): void {
  const drafts = readDrafts()
  localStorage.setItem(draftKey, JSON.stringify([...drafts.filter((item) => item.id !== question.id), question]))
}

export function clearDrafts(): void {
  localStorage.removeItem(draftKey)
}
