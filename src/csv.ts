import { normalizeAnswer, type Level, type Question, type QuestionType } from './model'

export const CSV_HEADER = ['id', 'type', 'level', 'prompt', 'answer', 'options', 'speechText', 'enabled']
export const CSV_EXAMPLE = `id,type,level,prompt,answer,options,speechText,enabled\n,choice,1,貓,ㄇㄠ,ㄇㄠ|ㄅㄠ|ㄏㄨㄚ|ㄩˊ,貓,true\n,order,1,貓,ㄇㄠ,,貓,true\n,audio,1,貓,ㄇㄠ,ㄇㄠ|ㄅㄠ|ㄏㄨㄚ|ㄩˊ,貓,true\n`

function parseRows(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const input = csv.replace(/^\uFEFF/, '')
  for (let i = 0; i < input.length; i++) {
    const char = input[i]
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++ }
      else if (!quoted && cell !== '') throw new Error(`第 ${rows.length + 1} 列的引號位置不正確`)
      else quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell); cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((part) => part.trim())) rows.push(row)
      row = []
    } else cell += char
  }
  if (quoted) throw new Error('CSV 有未關閉的引號')
  row.push(cell)
  if (row.some((part) => part.trim())) rows.push(row)
  return rows
}

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function exportQuestions(questions: Question[]): string {
  return [CSV_HEADER.join(','), ...questions.map((q) =>
    [q.id, q.type, q.level, q.prompt, q.answer, q.options.join('|'), q.speechText, q.enabled].map((value) => escapeCell(String(value))).join(','),
  )].join('\r\n') + '\r\n'
}

export interface ImportResult { questions: Question[]; errors: string[]; skipped: number }

export function importQuestions(csv: string, existing: Question[]): ImportResult {
  const rows = parseRows(csv)
  if (!rows.length || CSV_HEADER.some((header, index) => rows[0][index]?.trim() !== header) || rows[0].length !== CSV_HEADER.length) {
    return { questions: [], errors: [`標題列必須是：${CSV_HEADER.join(',')}`], skipped: 0 }
  }
  const errors: string[] = []
  const questions: Question[] = []
  let skipped = 0
  const known = new Set(existing.map((q) => `${q.type}|${q.level}|${q.prompt}|${normalizeAnswer(q.answer)}`))
  const knownIds = new Set(existing.map((q) => q.id))
  rows.slice(1).forEach((cells, index) => {
    const line = index + 2
    if (cells.length !== CSV_HEADER.length) { errors.push(`第 ${line} 列：欄位數量不正確`); return }
    const [rawId, rawType, rawLevel, rawPrompt, rawAnswer, rawOptions, rawSpeech, rawEnabled] = cells.map((cell) => cell.trim())
    const type = rawType as QuestionType
    const level = Number(rawLevel) as Level
    const answer = normalizeAnswer(rawAnswer)
    const options = rawOptions ? rawOptions.split('|').map(normalizeAnswer) : []
    const enabled = rawEnabled === 'true'
    const issues: string[] = []
    if (!['choice', 'order', 'audio'].includes(type)) issues.push('type 必須是 choice、order 或 audio')
    if (![1, 2, 3].includes(level)) issues.push('level 必須是 1、2 或 3')
    if (!rawPrompt || !answer) issues.push('prompt 與 answer 不可空白')
    if (rawEnabled !== 'true' && rawEnabled !== 'false') issues.push('enabled 必須是 true 或 false')
    if (type !== 'order' && (options.length !== 4 || new Set(options).size !== 4 || !options.includes(answer))) issues.push('選擇題需 4 個不重複選項，並包含正確答案')
    if (type === 'order' && options.length) issues.push('排序題的 options 必須留空')
    if (type === 'audio' && !rawSpeech) issues.push('聽音題需填 speechText')
    if (rawId && !/^[a-zA-Z0-9_-]+$/.test(rawId)) issues.push('id 只能包含英數、-、_')
    const signature = `${type}|${level}|${rawPrompt}|${answer}`
    if (rawId && knownIds.has(rawId) && !known.has(signature)) issues.push('id 已存在；請留空以新增題目')
    if (issues.length) { errors.push(`第 ${line} 列：${issues.join('；')}`); return }
    if (known.has(signature)) { skipped++; return }
    const id = rawId || crypto.randomUUID()
    questions.push({ id, type, level, prompt: rawPrompt, answer, options, speechText: rawSpeech, enabled })
    known.add(signature)
    knownIds.add(id)
  })
  return { questions, errors, skipped }
}
