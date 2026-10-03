import type { Level, Question, QuestionType } from './model'

interface Entry { level: Level; word: string; zhuyin: string }

// Each entry supplies one question per mode. The spoken prompt is a Chinese word,
// because speech engines do not pronounce isolated Zhuyin symbols consistently.
const entries: Entry[] = [
  { level: 1, word: '貓', zhuyin: 'ㄇㄠ' },
  { level: 1, word: '包', zhuyin: 'ㄅㄠ' },
  { level: 1, word: '花', zhuyin: 'ㄏㄨㄚ' },
  { level: 1, word: '魚', zhuyin: 'ㄩˊ' },
  { level: 1, word: '米', zhuyin: 'ㄇㄧˇ' },
  { level: 1, word: '兔', zhuyin: 'ㄊㄨˋ' },
  { level: 2, word: '白雲', zhuyin: 'ㄅㄞˊ ㄩㄣˊ' },
  { level: 2, word: '小狗', zhuyin: 'ㄒㄧㄠˇ ㄍㄡˇ' },
  { level: 2, word: '大海', zhuyin: 'ㄉㄚˋ ㄏㄞˇ' },
  { level: 2, word: '紅花', zhuyin: 'ㄏㄨㄥˊ ㄏㄨㄚ' },
  { level: 2, word: '雨水', zhuyin: 'ㄩˇ ㄕㄨㄟˇ' },
  { level: 2, word: '月亮', zhuyin: 'ㄩㄝˋ ㄌㄧㄤˋ' },
  { level: 3, word: '火車站', zhuyin: 'ㄏㄨㄛˇ ㄔㄜ ㄓㄢˋ' },
  { level: 3, word: '圖書館', zhuyin: 'ㄊㄨˊ ㄕㄨ ㄍㄨㄢˇ' },
  { level: 3, word: '遊樂園', zhuyin: 'ㄧㄡˊ ㄌㄜˋ ㄩㄢˊ' },
  { level: 3, word: '電風扇', zhuyin: 'ㄉㄧㄢˋ ㄈㄥ ㄕㄢˋ' },
  { level: 3, word: '長頸鹿', zhuyin: 'ㄔㄤˊ ㄐㄧㄥˇ ㄌㄨˋ' },
  { level: 3, word: '彩虹橋', zhuyin: 'ㄘㄞˇ ㄏㄨㄥˊ ㄑㄧㄠˊ' },
]

const types: QuestionType[] = ['choice', 'order', 'audio']

function optionsFor(entry: Entry): string[] {
  const peers = entries.filter((item) => item.level === entry.level && item.word !== entry.word)
  return [entry.zhuyin, ...peers.slice(0, 3).map((item) => item.zhuyin)]
}

export const seedQuestions: Question[] = entries.flatMap((entry, index) =>
  types.map((type) => ({
    id: `starter-${index + 1}-${type}`,
    type,
    level: entry.level,
    prompt: entry.word,
    answer: entry.zhuyin,
    options: type === 'order' ? [] : optionsFor(entry),
    speechText: entry.word,
    enabled: true,
  })),
)
