import { describe, expect, it } from 'vitest'
import { importQuestions, exportQuestions, CSV_EXAMPLE } from './csv'
import { answerTokens, examQuestions, isValidDistractors, orderDistractors, practiceQuestions, starsForScore, type Exam } from './model'
import { seedQuestions } from './seed'
import { isExam, isQuestion, mergeBank, parsePublishedBank } from './questionStore'
import publishedBank from '../public/questions.json'

describe('starter question bank', () => {
  it('provides three modes at every level with valid choices', () => {
    expect(seedQuestions).toHaveLength(66)
    expect(seedQuestions.some((q) => Array.from(q.prompt).length === 4)).toBe(true)
    for (const level of [1, 2, 3]) {
      for (const type of ['choice', 'order', 'audio']) {
        expect(seedQuestions.some((q) => q.level === level && q.type === type)).toBe(true)
      }
    }
    for (const question of seedQuestions) {
      if (question.type === 'order') {
        expect(isValidDistractors(question.answer, question.options)).toBe(true)
        expect(question.options.length).toBeGreaterThan(0)
      } else {
        expect(question.options).toHaveLength(4)
        expect(new Set(question.options).size).toBe(4)
        expect(question.options).toContain(question.answer)
      }
    }
  })

  it('breaks multi syllable answers into tap targets', () => {
    expect(answerTokens('ㄅㄞˊ ㄩㄣˊ')).toEqual(['ㄅ', 'ㄞ', 'ˊ', 'ㄩ', 'ㄣ', 'ˊ'])
    expect(orderDistractors('ㄅㄞˊ ㄩㄣˊ', ['ㄆ', 'ㄤ'])).toEqual(['ㄆ', 'ㄤ', 'ㄇ'])
    expect(isValidDistractors('ㄇㄠ', ['ㄇ'])).toBe(false)
  })

  it('recognizes valid published questions and rejects broken data', () => {
    expect(seedQuestions.every(isQuestion)).toBe(true)
    expect(isQuestion({ ...seedQuestions[0], options: null })).toBe(false)
  })

  it('keeps independent listening rounds audio-only across levels', () => {
    const listening = practiceQuestions(seedQuestions, 1, true, 'listening')
    expect(listening.length).toBeGreaterThan(10)
    expect(listening.every((question) => question.type === 'audio')).toBe(true)
    expect(new Set(listening.map((question) => question.level)).size).toBe(3)
    expect(practiceQuestions(seedQuestions, 1, false, 'listening')).toEqual([])
  })
})

describe('custom exam levels', () => {
  const exam: Exam = { id: 'term-1', title: '第一次段考', description: '第一課', questionIds: [seedQuestions[0].id, seedQuestions[2].id], enabled: true }

  it('selects only assigned speakable questions when a voice is available', () => {
    expect(isExam(exam)).toBe(true)
    expect(examQuestions(seedQuestions, exam, true).map((question) => question.id)).toEqual(exam.questionIds)
    expect(examQuestions(seedQuestions, exam, false)).toEqual([])
    expect(examQuestions([{ ...seedQuestions[0], speechText: '' }], exam, true)).toEqual([])
    expect(isExam({ ...exam, questionIds: [seedQuestions[0].id, seedQuestions[0].id] })).toBe(false)
  })

  it('reads the old question array and the new exam bank, then applies local drafts', () => {
    expect(parsePublishedBank([seedQuestions[0]])).toEqual({ questions: [seedQuestions[0]], exams: [] })
    const published = parsePublishedBank({ questions: [seedQuestions[0]], exams: [exam] })
    const changed = { ...exam, title: '第二次段考' }
    expect(mergeBank(published, [], [changed]).exams).toEqual([changed])
    expect(() => parsePublishedBank({ questions: [], exams: [{ ...exam, questionIds: [] }] })).toThrow()
  })

  it('publishes the requested 14 school exam items without adding them to regular practice', () => {
    const bank = parsePublishedBank(publishedBank)
    expect(bank.questions).toHaveLength(14)
    expect(bank.exams).toHaveLength(1)
    expect(bank.questions.every(isQuestion)).toBe(true)
    expect(bank.questions.every((question) => question.examOnly)).toBe(true)
    expect(bank.questions.every((question) => question.type === 'audio' && question.speechText.trim())).toBe(true)
    expect(bank.questions.every((question) => question.options.length === 4 && new Set(question.options).size === 4 && question.options.includes(question.answer))).toBe(true)
    expect(examQuestions(bank.questions, bank.exams[0], true)).toHaveLength(14)
    expect(examQuestions(bank.questions, bank.exams[0], false)).toEqual([])
    expect(practiceQuestions(bank.questions, 1, true, 'level')).toEqual([])
    expect(practiceQuestions(bank.questions, 1, true, 'listening')).toEqual([])
  })
})

describe('CSV transfer', () => {
  it('accepts the downloadable template', () => {
    const result = importQuestions(CSV_EXAMPLE, [])
    expect(result.errors).toEqual([])
    expect(result.questions).toHaveLength(4)
  })

  it('reports invalid answers and skips duplicate rows', () => {
    const duplicate = importQuestions(CSV_EXAMPLE, seedQuestions)
    expect(duplicate.skipped).toBe(4)
    const invalid = importQuestions(CSV_EXAMPLE.replace('ㄇㄠ|ㄅㄠ|ㄏㄨㄚ|ㄩˊ', 'ㄅㄠ|ㄅㄠ|ㄏㄨㄚ|ㄩˊ'), [])
    expect(invalid.errors).toHaveLength(1)
    expect(invalid.questions).toHaveLength(3)
  })

  it('round trips CSV with quoted content', () => {
    const question = { ...seedQuestions[0], id: 'custom', prompt: '貓,"小貓"', examOnly: true }
    const parsed = importQuestions(exportQuestions([question]), [])
    expect(parsed.errors).toEqual([])
    expect(parsed.questions[0].prompt).toBe(question.prompt)
    expect(parsed.questions[0].examOnly).toBe(true)
  })

  it('still imports older eight-column CSV files', () => {
    const oldCsv = 'id,type,level,prompt,answer,options,speechText,enabled\n,choice,1,貓,ㄇㄠ,ㄇㄠ|ㄅㄠ|ㄏㄨㄚ|ㄩˊ,貓,true\n'
    const result = importQuestions(oldCsv, [])
    expect(result.errors).toEqual([])
    expect(result.questions[0].examOnly).toBe(false)
  })
})

describe('stars', () => {
  it('uses the published score thresholds', () => {
    expect([4, 5, 7, 9].map(starsForScore)).toEqual([0, 1, 2, 3])
  })
})
