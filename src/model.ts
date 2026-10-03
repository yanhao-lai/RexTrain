export type QuestionType = 'choice' | 'order' | 'audio'
export type Level = 1 | 2 | 3

export interface Question {
  id: string
  type: QuestionType
  level: Level
  prompt: string
  answer: string
  options: string[]
  speechText: string
  enabled: boolean
}

export interface Progress {
  stars: Record<string, number>
  attempts: number
  correct: number
}

export const LEVELS = [
  { id: 1 as Level, title: '森林起點', subtitle: '認識注音與聲調', icon: '🌿', color: 'green' },
  { id: 2 as Level, title: '沙漠探險', subtitle: '讀出生活中的詞語', icon: '🌵', color: 'sand' },
  { id: 3 as Level, title: '星空城堡', subtitle: '挑戰更長的詞語', icon: '🏰', color: 'purple' },
]

export const TYPE_LABELS: Record<QuestionType, string> = {
  choice: '看字選注音',
  order: '注音拼拼看',
  audio: '聽聲音選注音',
}

export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function answerTokens(answer: string): string[] {
  return Array.from(answer.replace(/\s+/g, ''))
}

const extraSymbols = Array.from('ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦˊˇˋ˙')

export function orderDistractors(answer: string, options: string[], count = 3): string[] {
  const used = new Set(answerTokens(answer))
  const supplied = options.filter((symbol) => Array.from(symbol).length === 1 && extraSymbols.includes(symbol) && !used.has(symbol))
  const pool = [...new Set([...supplied, ...extraSymbols.filter((symbol) => !used.has(symbol))])]
  return pool.slice(0, count)
}

export function isValidDistractors(answer: string, options: string[]): boolean {
  const used = new Set(answerTokens(answer))
  return options.length <= 6 && new Set(options).size === options.length &&
    options.every((symbol) => Array.from(symbol).length === 1 && extraSymbols.includes(symbol) && !used.has(symbol))
}

export function practiceQuestions(questions: Question[], level: Level, voiceAvailable: boolean, mode: 'level' | 'multi' | 'listening'): Question[] {
  return questions.filter((question) => question.enabled &&
    (mode === 'listening' ? question.type === 'audio' : mode === 'multi' ? Array.from(question.prompt).length >= 2 : question.level === level) &&
    (question.type !== 'audio' || voiceAvailable))
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const progressKey = 'rextrain-progress-v1'

export function readProgress(): Progress {
  try {
    const parsed = JSON.parse(localStorage.getItem(progressKey) || 'null') as Progress | null
    if (parsed && typeof parsed.attempts === 'number' && typeof parsed.correct === 'number' && parsed.stars && typeof parsed.stars === 'object') return parsed
  } catch { /* An older or damaged value should not prevent practice. */ }
  return { stars: {}, attempts: 0, correct: 0 }
}

export function saveProgress(progress: Progress): void {
  localStorage.setItem(progressKey, JSON.stringify(progress))
}

export function starsForScore(score: number): number {
  if (score >= 9) return 3
  if (score >= 7) return 2
  if (score >= 5) return 1
  return 0
}
