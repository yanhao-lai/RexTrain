import { isValidDistractors, type Exam, type Question } from './model'

const draftKey = 'rextrain-question-drafts-v1'
const examDraftKey = 'rextrain-exam-drafts-v1'

export interface QuestionBank { questions: Question[]; exams: Exam[] }

export function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== 'object') return false
  const q = value as Partial<Question>
  return typeof q.id === 'string' && q.id.length > 0 &&
    (q.type === 'choice' || q.type === 'order' || q.type === 'audio') &&
    (q.level === 1 || q.level === 2 || q.level === 3) &&
    typeof q.prompt === 'string' && typeof q.answer === 'string' &&
    Array.isArray(q.options) && q.options.every((option) => typeof option === 'string') &&
    (q.type !== 'order' || isValidDistractors(q.answer, q.options)) &&
    typeof q.speechText === 'string' && typeof q.enabled === 'boolean'
}

export function readDrafts(): Question[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(draftKey) || '[]')
    return Array.isArray(value) ? value.filter(isQuestion) : []
  } catch { return [] }
}

export function isExam(value: unknown): value is Exam {
  if (!value || typeof value !== 'object') return false
  const exam = value as Partial<Exam>
  return typeof exam.id === 'string' && exam.id.length > 0 &&
    typeof exam.title === 'string' && exam.title.trim().length > 0 &&
    typeof exam.description === 'string' && typeof exam.enabled === 'boolean' &&
    Array.isArray(exam.questionIds) && exam.questionIds.length > 0 &&
    exam.questionIds.every((id) => typeof id === 'string' && id.length > 0) &&
    new Set(exam.questionIds).size === exam.questionIds.length
}

export function readExamDrafts(): Exam[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(examDraftKey) || '[]')
    return Array.isArray(value) ? value.filter(isExam) : []
  } catch { return [] }
}

export function mergeBank(published: QuestionBank, drafts: Question[], examDrafts: Exam[]): QuestionBank {
  const questionMap = new Map(published.questions.map((question) => [question.id, question]))
  const examMap = new Map(published.exams.map((exam) => [exam.id, exam]))
  drafts.forEach((question) => questionMap.set(question.id, question))
  examDrafts.forEach((exam) => examMap.set(exam.id, exam))
  return { questions: [...questionMap.values()], exams: [...examMap.values()] }
}

export function parsePublishedBank(value: unknown): QuestionBank {
  if (Array.isArray(value) && value.every(isQuestion)) return { questions: value as Question[], exams: [] }
  if (!value || typeof value !== 'object') throw new Error('題庫檔格式錯誤')
  const bank = value as Partial<QuestionBank>
  if (!Array.isArray(bank.questions) || !bank.questions.every(isQuestion) ||
    !Array.isArray(bank.exams) || !bank.exams.every(isExam)) throw new Error('題庫檔格式錯誤')
  return bank as QuestionBank
}

export function subscribeQuestions(onChange: (bank: QuestionBank) => void, onError: (message: string) => void): () => void {
  let active = true
  fetch(`${import.meta.env.BASE_URL}questions.json`, { cache: 'no-cache' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const value: unknown = await response.json()
      return parsePublishedBank(value)
    })
    .then((published) => { if (active) onChange(mergeBank(published, readDrafts(), readExamDrafts())) })
    .catch((error) => {
      if (active) { onChange(mergeBank({ questions: [], exams: [] }, readDrafts(), readExamDrafts())); onError(`公開題庫讀取失敗，仍可使用內建題目：${String(error)}`) }
    })
  return () => { active = false }
}

export function saveQuestion(question: Question): void {
  const drafts = readDrafts()
  localStorage.setItem(draftKey, JSON.stringify([...drafts.filter((item) => item.id !== question.id), question]))
}

export function saveExam(exam: Exam): void {
  const drafts = readExamDrafts()
  localStorage.setItem(examDraftKey, JSON.stringify([...drafts.filter((item) => item.id !== exam.id), exam]))
}

export function clearDrafts(): void {
  localStorage.removeItem(draftKey)
  localStorage.removeItem(examDraftKey)
}
