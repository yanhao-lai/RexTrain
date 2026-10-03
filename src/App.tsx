import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Download, FileUp, LockKeyhole, Pencil, Play, Plus, RotateCcw, Settings, Sparkles, Star, Trash2, Volume2, X } from 'lucide-react'
import { CSV_EXAMPLE, exportQuestions, importQuestions, type ImportResult } from './csv'
import { clearDrafts, readDrafts, saveQuestion, subscribeQuestions } from './questionStore'
import { answerTokens, LEVELS, normalizeAnswer, readProgress, saveProgress, shuffle, starsForScore, TYPE_LABELS, type Level, type Progress, type Question, type QuestionType } from './model'
import { seedQuestions } from './seed'

type Screen = 'home' | 'play' | 'result' | 'admin'
const emptyQuestion = (): Question => ({ id: crypto.randomUUID(), type: 'choice', level: 1, prompt: '', answer: '', options: ['', '', '', ''], speechText: '', enabled: true })

function download(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function downloadPublishedBank(questions: Question[]): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(questions, null, 2) + '\n'], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'questions.json'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function makeRound(questions: Question[]): Question[] {
  const groups: Record<QuestionType, Question[]> = {
    choice: shuffle(questions.filter((q) => q.type === 'choice')),
    order: shuffle(questions.filter((q) => q.type === 'order')),
    audio: shuffle(questions.filter((q) => q.type === 'audio')),
  }
  const result: Question[] = []
  const types: QuestionType[] = ['choice', 'order', 'audio']
  while (result.length < 10 && types.some((type) => groups[type].length)) {
    for (const type of types) {
      const next = groups[type].shift()
      if (next && result.length < 10) result.push(next)
    }
  }
  return result
}

function getVoice(): SpeechSynthesisVoice | undefined {
  if (!('speechSynthesis' in window)) return undefined
  return window.speechSynthesis.getVoices().find((voice) => /^zh[-_]TW$/i.test(voice.lang))
}

function speak(text: string): void {
  const voice = getVoice()
  if (!voice) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = 'zh-TW'
  utterance.rate = 0.78
  window.speechSynthesis.speak(utterance)
}

function Stars({ count, small = false }: { count: number; small?: boolean }) {
  return <span className={`stars ${small ? 'stars-small' : ''}`} aria-label={`${count} 顆星`}>
    {[0, 1, 2].map((i) => <Star key={i} size={small ? 16 : 26} fill={i < count ? 'currentColor' : 'none'} className={i < count ? 'earned' : 'unearned'} />)}
  </span>
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [overrides, setOverrides] = useState<Question[]>([])
  const [progress, setProgress] = useState<Progress>(readProgress)
  const [voiceAvailable, setVoiceAvailable] = useState(false)
  const [dataError, setDataError] = useState('')
  const [level, setLevel] = useState<Level>(1)
  const [round, setRound] = useState<Question[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [selectedTokens, setSelectedTokens] = useState<number[]>([])
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [resultStars, setResultStars] = useState(0)

  useEffect(() => subscribeQuestions(setOverrides, setDataError), [])
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const update = () => setVoiceAvailable(Boolean(getVoice()))
    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  const questions = useMemo(() => {
    const map = new Map(seedQuestions.map((q) => [q.id, q]))
    overrides.forEach((q) => map.set(q.id, q))
    return [...map.values()]
  }, [overrides])
  const current = round[questionIndex]
  const tokenChoices = useMemo(() => {
    if (!current || current.type !== 'order') return []
    const tokens = answerTokens(current.answer).map((value, index) => ({ value, index }))
    const mixed = shuffle(tokens)
    if (mixed.every((token, index) => token.index === index) && mixed.length > 1) mixed.reverse()
    return mixed
  }, [current])

  function start(nextLevel: Level): void {
    const pool = questions.filter((q) => q.enabled && q.level === nextLevel && (q.type !== 'audio' || voiceAvailable))
    const chosen = makeRound(pool)
    if (!chosen.length) return
    setLevel(nextLevel)
    setRound(chosen)
    setQuestionIndex(0)
    setScore(0)
    setSelectedAnswer(null)
    setSelectedTokens([])
    setFeedback(null)
    setScreen('play')
  }

  function submit(answer: string): void {
    if (!current || feedback) return
    const right = current.type === 'order'
      ? answer.replace(/\s+/g, '') === current.answer.replace(/\s+/g, '')
      : normalizeAnswer(answer) === normalizeAnswer(current.answer)
    setFeedback(right ? 'correct' : 'wrong')
    if (right) setScore((value) => value + 1)
  }

  function nextQuestion(): void {
    if (questionIndex + 1 < round.length) {
      setQuestionIndex((value) => value + 1)
      setSelectedAnswer(null)
      setSelectedTokens([])
      setFeedback(null)
      return
    }
    // Short custom banks still use the same success percentages as a ten-question round.
    const normalizedScore = Math.round((score / round.length) * 10)
    const earned = starsForScore(normalizedScore)
    setResultStars(earned)
    const next = {
      stars: { ...progress.stars, [level]: Math.max(progress.stars[level] || 0, earned) },
      attempts: progress.attempts + round.length,
      correct: progress.correct + score,
    }
    setProgress(next)
    saveProgress(next)
    setScreen('result')
  }

  function selectToken(index: number): void {
    if (feedback || selectedTokens.includes(index)) return
    setSelectedTokens((previous) => [...previous, index])
  }

  const accessibleLevels = LEVELS.filter((item) => item.id === 1 || (progress.stars[item.id - 1] || 0) > 0).length

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={() => setScreen('home')} aria-label="回到首頁"><span className="brand-cube">◆</span><span>REX<span className="brand-accent">TRAIN</span><small>注音方塊冒險</small></span></button>
      <nav className="topnav" aria-label="主選單">
        <button className={screen === 'home' ? 'active' : ''} onClick={() => setScreen('home')}>冒險地圖</button>
        <button className={screen === 'admin' ? 'active' : ''} onClick={() => setScreen('admin')}><Settings size={16} /> 題庫管理</button>
      </nav>
    </header>

    {screen === 'home' && <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={16} /> 為小小冒險家打造的注音樂園</div>
          <h1>一塊一塊，<br /><em>拼出注音的魔法！</em></h1>
          <p>選一座島嶼出發，邊玩邊認識注音。每答對一題，就離新的冒險更近一步！</p>
          <button className="primary-button" onClick={() => start(1)}><Play size={19} fill="currentColor" /> 開始冒險 <ArrowRight size={19} /></button>
          <div className="hero-stats"><span><strong>{accessibleLevels}</strong> / 3 已解鎖關卡</span><i /><span><strong>{progress.correct}</strong> 題答對</span></div>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="sun" /><div className="cloud cloud-one" /><div className="cloud cloud-two" /><div className="floating-island"><div className="island-grass" /><div className="island-dirt" /><div className="tree trunk" /><div className="tree leaves" /><div className="hero-tile tile-a">ㄅ</div><div className="hero-tile tile-b">ㄆ</div><div className="hero-tile tile-c">ㄇ</div><div className="hero-tile tile-d">ㄈ</div></div><span className="spark spark-a">✦</span><span className="spark spark-b">✦</span></div>
      </section>

      <section className="map-section"><div className="section-head"><div><span className="section-kicker">CHOOSE YOUR ADVENTURE</span><h2>冒險地圖 <span>🗺️</span></h2><p>從森林出發，收集星星，開啟下一段旅程。</p></div><span className="map-counter">已完成 {Object.values(progress.stars).filter((count) => count > 0).length} / 3 關</span></div>
        <div className="level-grid">{LEVELS.map((item, index) => {
          const unlocked = item.id === 1 || (progress.stars[item.id - 1] || 0) > 0
          const count = questions.filter((q) => q.enabled && q.level === item.id && (q.type !== 'audio' || voiceAvailable)).length
          return <article className={`level-card level-${item.color} ${!unlocked ? 'locked' : ''}`} key={item.id}>
            <div className="level-scene"><span className="scene-stars">✦ ✧</span><span className="scene-icon">{item.icon}</span><span className="scene-block block-one" /><span className="scene-block block-two" /></div>
            <div className="level-body"><div className="level-meta"><span>關卡 0{index + 1}</span>{!unlocked ? <LockKeyhole size={17} /> : <Stars count={progress.stars[item.id] || 0} small />}</div><h3>{item.title}</h3><p>{item.subtitle}</p><button className="level-button" disabled={!unlocked || !count} onClick={() => start(item.id)}>{!unlocked ? '收集上一關星星解鎖' : count ? '進入關卡' : '尚無題目'} <ChevronRight size={18} /></button></div>
          </article>
        })}</div>
      </section>
      <section className="how-section"><div className="section-head"><div><span className="section-kicker">HOW TO PLAY</span><h2>三種方式，玩出好注音</h2></div></div><div className="how-grid"><div><span className="how-icon green"><BookOpen /></span><h3>看字選注音</h3><p>看看字卡，選出正確的注音。</p></div><div><span className="how-icon gold"><Sparkles /></span><h3>注音拼拼看</h3><p>點擊方塊，把注音排成答案。</p></div><div><span className="how-icon blue"><Volume2 /></span><h3>聽聲音選注音</h3><p>聽聽看，找出聽到的注音。</p></div></div></section>
      {!voiceAvailable && <p className="notice">這台裝置目前沒有可用的繁體中文語音；聽音題會暫時略過。可在裝置設定中加入繁體中文語音後重試。</p>}
    </main>}

    {screen === 'play' && current && <main className="play-main">
      <div className="play-top"><button className="back-button" onClick={() => { window.speechSynthesis?.cancel(); setScreen('home') }}><ArrowLeft size={18} /> 返回地圖</button><div className="play-level">{LEVELS[level - 1].icon} {LEVELS[level - 1].title}</div><span>{questionIndex + 1} / {round.length}</span></div>
      <div className="progress-track"><div style={{ width: `${((questionIndex + 1) / round.length) * 100}%` }} /></div>
      <section className="question-card"><span className="question-tag">{TYPE_LABELS[current.type]}</span><h2>{current.type === 'audio' ? '聽一聽，選出正確的注音！' : current.type === 'order' ? '把注音方塊排成正確答案！' : '這個字怎麼讀？'}</h2>
        {current.type === 'audio' ? <button className="speak-button" onClick={() => speak(current.speechText)}><Volume2 size={35} /> <span>點我聽發音</span></button> : <div className="word-card">{current.prompt}</div>}
        {current.type === 'order' ? <><div className="answer-tiles" aria-label="已選的注音">{answerTokens(current.answer).map((_, position) => <button key={position} className={selectedTokens[position] === undefined ? 'empty-tile' : 'filled-tile'} onClick={() => setSelectedTokens((previous) => previous.slice(0, position))} disabled={feedback !== null}>{selectedTokens[position] === undefined ? '?' : tokenChoices[selectedTokens[position]].value}</button>)}</div><div className="token-bank">{tokenChoices.map((token, index) => <button key={`${token.index}-${index}`} disabled={selectedTokens.includes(index) || feedback !== null} onClick={() => selectToken(index)}>{token.value}</button>)}</div><button className="check-button" disabled={selectedTokens.length !== tokenChoices.length || feedback !== null} onClick={() => submit(selectedTokens.map((index) => tokenChoices[index].value).join(''))}>檢查答案 <Check size={19} /></button></> : <div className="option-grid">{shuffleStable(current.options, current.id).map((option) => <button key={option} className={`option-button ${feedback && option === current.answer ? 'right' : ''} ${feedback === 'wrong' && option === selectedAnswer ? 'wrong' : ''}`} disabled={feedback !== null} onClick={() => { setSelectedAnswer(option); submit(option) }}>{option}</button>)}</div>}
        {feedback && <div className={`feedback ${feedback}`} role="status"><span>{feedback === 'correct' ? '答對了！太棒了 🌟' : `再加油！正確答案是 ${current.answer}`}</span><button onClick={nextQuestion}>{questionIndex + 1 === round.length ? '看結果' : '下一題'} <ArrowRight size={18} /></button></div>}
      </section>
    </main>}

    {screen === 'result' && <main className="result-main"><div className="result-card"><div className="result-emoji">{resultStars ? '🏆' : '💪'}</div><span className="section-kicker">ADVENTURE COMPLETE</span><h1>{resultStars ? '關卡完成！' : '再挑戰一次！'}</h1><p>你在 {round.length} 題中答對了 <strong>{score}</strong> 題</p><Stars count={resultStars} /><p className="result-hint">{resultStars ? '星星已經收進你的冒險背包！' : '答對一半以上就能拿到第一顆星。'}</p><div className="result-actions"><button className="secondary-button" onClick={() => setScreen('home')}><ArrowLeft size={18} /> 回地圖</button><button className="primary-button" onClick={() => start(level)}><RotateCcw size={18} /> 再玩一次</button></div></div></main>}

    {screen === 'admin' && <AdminPanel questions={questions} overrides={overrides} setOverrides={setOverrides} onBack={() => setScreen('home')} />}
    <footer>REXTRAIN · 在遊戲裡，開心學注音 <span>✦</span> 使用原創方塊視覺</footer>
    {dataError && <div className="error-toast" role="alert">{dataError}<button onClick={() => setDataError('')} aria-label="關閉"><X size={16} /></button></div>}
  </div>
}

function shuffleStable(options: string[], seed: string): string[] {
  // Keep options in place while React rerenders the question after selection.
  return [...options].sort((a, b) => hash(`${seed}-${a}`) - hash(`${seed}-${b}`))
}
function hash(value: string): number { let result = 0; for (const char of value) result = (result * 31 + char.charCodeAt(0)) | 0; return result }

function AdminPanel({ questions, overrides, setOverrides, onBack }: { questions: Question[]; overrides: Question[]; setOverrides: (value: Question[]) => void; onBack: () => void }) {
  const [editing, setEditing] = useState<Question | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [filter, setFilter] = useState<'all' | QuestionType>('all')
  const [draftCount, setDraftCount] = useState(() => readDrafts().length)
  const shown = questions.filter((q) => filter === 'all' || q.type === filter)

  async function persist(q: Question): Promise<void> {
    saveQuestion(q)
    setOverrides([...overrides.filter((item) => item.id !== q.id), q])
    setDraftCount(readDrafts().length)
  }
  async function handleSave(): Promise<void> {
    if (!editing) return
    const q = { ...editing, prompt: editing.prompt.trim(), answer: normalizeAnswer(editing.answer), options: editing.options.map(normalizeAnswer), speechText: editing.speechText.trim() }
    if (!q.prompt || !q.answer) { setMessage('請填寫題目與正確注音。'); return }
    if (q.type === 'audio' && !q.speechText) { setMessage('聽音題需要填寫朗讀文字。'); return }
    if (q.type !== 'order' && (q.options.length !== 4 || new Set(q.options).size !== 4 || !q.options.includes(q.answer))) { setMessage('選擇題需要 4 個不重複選項，且包含正確答案。'); return }
    if (q.type === 'order') q.options = []
    setBusy(true)
    try { await persist(q); setEditing(null); setMessage('已存為本機草稿。下載發佈檔並提交到 GitHub 後才會公開。') }
    catch (error) { setMessage(`儲存失敗：${String(error)}`) }
    finally { setBusy(false) }
  }
  async function handleDisable(q: Question): Promise<void> {
    if (!window.confirm(`確定要停用「${q.prompt}」嗎？下載並提交發佈檔後，其他人將不再看到這題。`)) return
    setBusy(true)
    try {
      await persist({ ...q, enabled: false })
      setMessage('已在本機草稿停用這題；提交到 GitHub 後才會公開生效。')
    } catch (error) { setMessage(`停用失敗：${String(error)}`) }
    finally { setBusy(false) }
  }
  async function readFile(file?: File): Promise<void> {
    if (!file) return
    try { setImportResult(importQuestions(await file.text(), questions)); setMessage('') }
    catch (error) { setImportResult(null); setMessage(String(error)) }
  }
  async function commitImport(): Promise<void> {
    if (!importResult || importResult.errors.length || !importResult.questions.length) return
    setBusy(true)
    try {
      for (const q of importResult.questions) saveQuestion(q)
      setOverrides([...overrides, ...importResult.questions])
      setDraftCount(readDrafts().length)
      setMessage(`已匯入 ${importResult.questions.length} 題到本機草稿。下載發佈檔並提交到 GitHub 後才會公開。`)
      setImportResult(null); setShowImport(false)
    } catch (error) { setMessage(`匯入中斷，已寫入的草稿會保留；重新匯入時會跳過重複題。${String(error)}`) }
    finally { setBusy(false) }
  }

  return <main className="admin-main"><div className="admin-heading"><button className="back-button" onClick={onBack}><ArrowLeft size={18} /> 回地圖</button><span className="section-kicker">QUESTION STUDIO</span><h1>題庫管理</h1><p>創造新的練習，把更多注音方塊加進冒險世界。</p></div>
    <div className="notice">這裡是本機出題工具。修改只保存在這台裝置；只有將下載的 <strong>questions.json</strong> 提交到 GitHub，題目才會公開更新。任何訪客都能在自己的瀏覽器試編輯，但只有擁有此倉庫寫入權限的人能發佈。</div>
      <div className="publish-panel"><div><strong>{draftCount ? `${draftCount} 題本機草稿尚未發佈` : '目前沒有本機草稿'}</strong><p>完成新增或匯入後，下載發佈檔並取代倉庫的 <code>public/questions.json</code>。</p></div><div className="publish-actions"><button className="primary-button" onClick={() => downloadPublishedBank(questions)}><Download size={18} /> 下載發佈檔</button><button className="secondary-button" disabled={!draftCount} onClick={() => { if (window.confirm('確定要清除這台裝置的草稿，重新載入 GitHub 上的題庫嗎？')) { clearDrafts(); window.location.reload() } }}>清除本機草稿</button></div></div>
      <div className="admin-toolbar"><div className="admin-title"><h2>所有題目 <span>{questions.length}</span></h2><p>內建 {seedQuestions.length} 題；可編輯或停用。</p></div><div className="admin-actions"><button className="secondary-button" onClick={() => download('rextrain-template.csv', CSV_EXAMPLE)}><Download size={17} /> 下載範本</button><button className="secondary-button" onClick={() => download('rextrain-questions.csv', exportQuestions(questions))}><Download size={17} /> 匯出 CSV</button><button className="secondary-button" onClick={() => setShowImport((value) => !value)}><FileUp size={17} /> 匯入 CSV</button><button className="primary-button" onClick={() => { setEditing(emptyQuestion()); setMessage('') }}><Plus size={18} /> 新增題目</button></div></div>
      {showImport && <div className="import-panel"><h3>匯入 CSV 題目</h3><p>請使用 UTF-8 CSV，選項以直線符號 | 分隔。先預覽檢查，再正式匯入。</p><input type="file" accept=".csv,text/csv" onChange={(event) => void readFile(event.target.files?.[0])} />{importResult && <div className="import-preview"><strong>可匯入 {importResult.questions.length} 題 · 跳過重複 {importResult.skipped} 題 · 錯誤 {importResult.errors.length} 列</strong>{importResult.errors.map((error, index) => <p className="field-error" key={index}>{error}</p>)}<button className="primary-button" disabled={busy || importResult.errors.length > 0 || importResult.questions.length === 0} onClick={() => void commitImport()}>確認匯入</button></div>}</div>}
      {message && <p className="admin-message" role="status">{message}</p>}
      <div className="filter-tabs">{(['all', 'choice', 'order', 'audio'] as const).map((type) => <button key={type} className={filter === type ? 'active' : ''} onClick={() => setFilter(type)}>{type === 'all' ? '全部' : TYPE_LABELS[type]}</button>)}</div>
      <div className="question-list">{shown.map((q) => <article className={`question-row ${!q.enabled ? 'disabled' : ''}`} key={q.id}><div className="question-row-icon">{q.type === 'audio' ? <Volume2 /> : q.type === 'order' ? <Sparkles /> : <BookOpen />}</div><div className="question-row-copy"><div><strong>{q.prompt}</strong><span className="pill">{TYPE_LABELS[q.type]}</span><span className="pill faint">第 {q.level} 關</span>{!q.enabled && <span className="pill off">已停用</span>}</div><p>答案：{q.answer}</p></div><div className="row-actions"><button aria-label={`編輯 ${q.prompt}`} onClick={() => { setEditing({ ...q, options: q.type === 'order' ? ['', '', '', ''] : [...q.options] }); setMessage('') }}><Pencil size={17} /></button><button aria-label={`停用 ${q.prompt}`} disabled={busy || !q.enabled} onClick={() => void handleDisable(q)}><Trash2 size={17} /></button></div></article>)}</div>
      {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null) }}><div className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title"><div className="modal-header"><h2 id="edit-title">{questions.some((q) => q.id === editing.id) ? '編輯題目' : '新增題目'}</h2><button aria-label="關閉" onClick={() => setEditing(null)}><X /></button></div><div className="form-grid"><label>題型<select value={editing.type} onChange={(event) => setEditing({ ...editing, type: event.target.value as QuestionType, options: event.target.value === 'order' ? [] : editing.options.length === 4 ? editing.options : ['', '', '', ''] })}><option value="choice">看字選注音</option><option value="order">注音拼拼看</option><option value="audio">聽聲音選注音</option></select></label><label>關卡<select value={editing.level} onChange={(event) => setEditing({ ...editing, level: Number(event.target.value) as Level })}><option value="1">森林起點</option><option value="2">沙漠探險</option><option value="3">星空城堡</option></select></label><label>題目文字<input value={editing.prompt} onChange={(event) => setEditing({ ...editing, prompt: event.target.value })} placeholder="例如：貓" /></label><label>正確注音<input value={editing.answer} onChange={(event) => setEditing({ ...editing, answer: event.target.value })} placeholder="例如：ㄇㄠ" /></label>{editing.type !== 'order' && <label className="wide">四個選項，以 | 分隔<input value={editing.options.join('|')} onChange={(event) => setEditing({ ...editing, options: event.target.value.split('|') })} placeholder="ㄇㄠ|ㄅㄠ|ㄏㄨㄚ|ㄩˊ" /></label>}<label className="wide">朗讀文字{editing.type === 'audio' ? '（必填）' : '（選填）'}<input value={editing.speechText} onChange={(event) => setEditing({ ...editing, speechText: event.target.value })} placeholder="例如：貓" /></label><label className="checkbox-label"><input type="checkbox" checked={editing.enabled} onChange={(event) => setEditing({ ...editing, enabled: event.target.checked })} /> 啟用此題</label></div>{message && <p className="field-error">{message}</p>}<div className="modal-actions"><button className="secondary-button" onClick={() => setEditing(null)}>取消</button><button className="primary-button" disabled={busy} onClick={() => void handleSave()}><Check size={18} /> 儲存題目</button></div></div></div>}
  </main>
}
