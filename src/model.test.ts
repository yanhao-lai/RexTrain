import { describe, expect, it } from 'vitest'
import { importQuestions, exportQuestions, CSV_EXAMPLE } from './csv'
import { answerTokens, isValidDistractors, orderDistractors, practiceQuestions, starsForScore } from './model'
import { seedQuestions } from './seed'
import { isQuestion } from './questionStore'

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
    const question = { ...seedQuestions[0], id: 'custom', prompt: '貓,"小貓"' }
    const parsed = importQuestions(exportQuestions([question]), [])
    expect(parsed.errors).toEqual([])
    expect(parsed.questions[0].prompt).toBe(question.prompt)
  })
})

describe('stars', () => {
  it('uses the published score thresholds', () => {
    expect([4, 5, 7, 9].map(starsForScore)).toEqual([0, 1, 2, 3])
  })
})
