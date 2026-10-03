import { describe, expect, it } from 'vitest'
import { importQuestions, exportQuestions, CSV_EXAMPLE } from './csv'
import { answerTokens, starsForScore } from './model'
import { seedQuestions } from './seed'

describe('starter question bank', () => {
  it('provides three modes at every level with valid choices', () => {
    expect(seedQuestions).toHaveLength(54)
    for (const level of [1, 2, 3]) {
      for (const type of ['choice', 'order', 'audio']) {
        expect(seedQuestions.some((q) => q.level === level && q.type === type)).toBe(true)
      }
    }
    for (const question of seedQuestions) {
      if (question.type !== 'order') {
        expect(question.options).toHaveLength(4)
        expect(new Set(question.options).size).toBe(4)
        expect(question.options).toContain(question.answer)
      }
    }
  })

  it('breaks multi syllable answers into tap targets', () => {
    expect(answerTokens('ㄅㄞˊ ㄩㄣˊ')).toEqual(['ㄅ', 'ㄞ', 'ˊ', 'ㄩ', 'ㄣ', 'ˊ'])
  })
})

describe('CSV transfer', () => {
  it('accepts the downloadable template', () => {
    const result = importQuestions(CSV_EXAMPLE, [])
    expect(result.errors).toEqual([])
    expect(result.questions).toHaveLength(3)
  })

  it('reports invalid answers and skips duplicate rows', () => {
    const duplicate = importQuestions(CSV_EXAMPLE, seedQuestions)
    expect(duplicate.skipped).toBe(3)
    const invalid = importQuestions(CSV_EXAMPLE.replace('ㄇㄠ|ㄅㄠ|ㄏㄨㄚ|ㄩˊ', 'ㄅㄠ|ㄅㄠ|ㄏㄨㄚ|ㄩˊ'), [])
    expect(invalid.errors).toHaveLength(1)
    expect(invalid.questions).toHaveLength(2)
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
