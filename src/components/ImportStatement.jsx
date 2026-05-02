import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function analyzeStatement(pdfBase64, isCard, budgetItems) {
  const { data, error } = await supabase.functions.invoke('anthropic-statement-view', {
    body: { pdfBase64, isCard, budgetItems },
  })
  if (error) throw new Error(error.message)
  if (data.error) throw new Error(data.error)
  return data.transactions
}

const SECTION_LABELS = { income: 'Income', bills: 'Bills', variable: 'Variable', savings: 'Savings' }

function monthKey(dateStr) {
  return dateStr.slice(0, 7) // "YYYY-MM"
}

function monthLabel(key) {
  const [y, m] = key.split('-')
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function isInPeriod(dateStr, bounds) {
  if (!bounds) return true
  const d = new Date(dateStr + 'T12:00:00')
  return d >= bounds.start && d <= bounds.end
}

export function ImportStatement({ budget, periodBounds, onClose, onImport }) {
  const [step, setStep] = useState('config')
  const [isCard, setIsCard] = useState(false)
  const [cardId, setCardId] = useState(() => budget.cards?.[0]?.id ?? null)
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [error, setError] = useState(null)
  const fileRef = useRef()

  const cards = budget.cards || []
  const sections = budget.sections || {}

  const subcatOptions = []
  const budgetItems = []
  for (const [key, sec] of Object.entries(sections)) {
    if (sec?.enabled && Array.isArray(sec.items)) {
      sec.items.forEach(item => {
        subcatOptions.push({ key, name: item.name })
        budgetItems.push({ section: key, name: item.name })
      })
    }
  }

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    if (f.type !== 'application/pdf') { setError('Please select a PDF file.'); return }
    setError(null)
    setFile(f)
  }

  async function handleProcess() {
    if (!file) return
    setStep('processing')
    setError(null)
    try {
      const base64 = await readFileAsBase64(file)
      const extracted = await analyzeStatement(base64, isCard, budgetItems)
      setRows(extracted.map((t, i) => ({
        ...t,
        _id: `${Date.now()}-${i}`,
        _keep: true,
        sectionKey: t.suggestedSection ?? null,
        subcategoryName: t.suggestedSubcategory ?? null,
      })))
      setStep('review')
    } catch (err) {
      setError(err.message)
      setStep('upload')
    }
  }

  function updateRow(id, patch) {
    setRows(rs => rs.map(r => r._id === id ? { ...r, ...patch } : r))
  }

  function handleImport() {
    const kept = rows.filter(r => r._keep)
    const transactions = []
    const cardPayments = []

    for (const r of kept) {
      if (isCard && r.type === 'payment') {
        cardPayments.push({
          cardId,
          amount: r.amount,
          date: r.date + 'T12:00:00',
          memo: r.description,
        })
      } else if (r.sectionKey && r.subcategoryName) {
        transactions.push({
          sectionKey: r.sectionKey,
          subcategoryName: r.subcategoryName,
          amount: r.amount,
          memo: r.description,
          date: r.date + 'T12:00:00',
          cardId: isCard ? (cardId || null) : null,
        })
      }
    }

    onImport(transactions, cardPayments)
  }

  const importableCount = rows.filter(r => {
    if (!r._keep) return false
    if (isCard && r.type === 'payment') return true
    return r.sectionKey && r.subcategoryName
  }).length

  const stepIndex = { config: 0, upload: 1, processing: 2, review: 2 }

  return (
    <div className="import-stmt">
      <div className="import-stmt__header">
        <button className="import-stmt__close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span className="import-stmt__title">Import Statement</span>
        <div className="import-stmt__dots">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`import-stmt__dot ${stepIndex[step] === i ? 'import-stmt__dot--active' : ''} ${stepIndex[step] > i ? 'import-stmt__dot--done' : ''}`}
            />
          ))}
        </div>
      </div>

      {/* ── Step: config ── */}
      {step === 'config' && (
        <div className="import-stmt__body">
          <p className="import-stmt__desc">What type of statement are you importing?</p>

          <div className="import-stmt__type-grid">
            <button
              className={`import-stmt__type-btn ${!isCard ? 'import-stmt__type-btn--active' : ''}`}
              onClick={() => setIsCard(false)}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              <span className="import-stmt__type-name">Bank Statement</span>
              <small className="import-stmt__type-sub">Checking / savings</small>
            </button>

            <button
              className={`import-stmt__type-btn ${isCard ? 'import-stmt__type-btn--active' : ''}`}
              onClick={() => { setIsCard(true); if (!cardId && cards[0]) setCardId(cards[0].id) }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
                <line x1="6" y1="15" x2="10" y2="15" />
              </svg>
              <span className="import-stmt__type-name">Credit Card</span>
              <small className="import-stmt__type-sub">Purchases &amp; payments</small>
            </button>
          </div>

          {isCard && (
            <div className="import-stmt__field">
              <label className="import-stmt__label">Select card</label>
              {cards.length === 0 ? (
                <p className="import-stmt__warn">No cards added to this budget yet. Add a card first.</p>
              ) : (
                <select
                  className="import-stmt__select"
                  value={cardId ?? ''}
                  onChange={e => setCardId(e.target.value)}
                >
                  {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
          )}

          <button
            className="import-stmt__primary-btn"
            disabled={isCard && cards.length === 0}
            onClick={() => setStep('upload')}
          >
            Continue
          </button>
        </div>
      )}

      {/* ── Step: upload ── */}
      {step === 'upload' && (
        <div className="import-stmt__body">
          <p className="import-stmt__desc">Upload your {isCard ? 'credit card' : 'bank'} statement PDF.</p>
          {error && <p className="import-stmt__error">{error}</p>}

          <div
            className={`import-stmt__dropzone ${file ? 'import-stmt__dropzone--ready' : ''}`}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {file ? (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <polyline points="9 15 12 18 15 15" />
                  <line x1="12" y1="12" x2="12" y2="18" />
                </svg>
                <span className="import-stmt__filename">{file.name}</span>
                <small>Tap to change file</small>
              </>
            ) : (
              <>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Select PDF</span>
                <small>Tap to browse</small>
              </>
            )}
          </div>

          <div className="import-stmt__row-btns">
            <button className="import-stmt__ghost-btn" onClick={() => setStep('config')}>Back</button>
            <button className="import-stmt__primary-btn" disabled={!file} onClick={handleProcess}>
              Analyze
            </button>
          </div>
        </div>
      )}

      {/* ── Step: processing ── */}
      {step === 'processing' && (
        <div className="import-stmt__body import-stmt__body--center">
          <div className="import-stmt__spinner" />
          <p className="import-stmt__desc">Analyzing your statement…</p>
          <small className="import-stmt__hint">This may take a few seconds</small>
        </div>
      )}

      {/* ── Step: review ── */}
      {step === 'review' && (
        <>
          <div className="import-stmt__review-bar">
            <span>{rows.length} transaction{rows.length !== 1 ? 's' : ''} found</span>
            <span className="import-stmt__review-count">{importableCount} ready to import</span>
          </div>

          <div className="import-stmt__list">
            {(() => {
              const needsCategory = r => r._keep && r.type !== 'payment' && (!r.sectionKey || !r.subcategoryName)
              const unassigned = rows.filter(needsCategory)

              const groups = []
              const seen = new Map()
              for (const r of [...rows].sort((a, b) => a.date.localeCompare(b.date))) {
                if (needsCategory(r)) continue // shown in the unassigned section above
                const mk = monthKey(r.date)
                if (!seen.has(mk)) { seen.set(mk, []); groups.push({ mk, items: seen.get(mk) }) }
                seen.get(mk).push(r)
              }
              return (
                <>
                  {unassigned.length > 0 && (
                    <div>
                      <div className="import-stmt__month-header">
                        <span className="import-stmt__month-label" style={{ color: '#F97316' }}>
                          Needs category
                        </span>
                      </div>
                      {unassigned.map(r => (
                        <div key={r._id} className="import-stmt__row">
                          <button
                            className="import-stmt__check import-stmt__check--on"
                            onClick={() => updateRow(r._id, { _keep: false })}
                            aria-label="Exclude"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </button>
                          <div className="import-stmt__row-body">
                            <div className="import-stmt__row-top">
                              <span className="import-stmt__row-date">{r.date}</span>
                              <span className={`import-stmt__badge import-stmt__badge--${r.type}`}>{r.type}</span>
                              <span className="import-stmt__row-amt">${r.amount.toFixed(2)}</span>
                            </div>
                            <div className="import-stmt__row-desc">{r.description}</div>
                            <select
                              className="import-stmt__cat-sel"
                              value=""
                              onChange={e => {
                                if (e.target.value) {
                                  const [sk, sn] = e.target.value.split('::')
                                  updateRow(r._id, { sectionKey: sk, subcategoryName: sn })
                                }
                              }}
                            >
                              <option value="">— assign category —</option>
                              {subcatOptions.map(o => (
                                <option key={`${o.key}::${o.name}`} value={`${o.key}::${o.name}`}>
                                  {SECTION_LABELS[o.key] ?? o.key} › {o.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {groups.map(({ mk, items }) => {
                const allOn = items.every(r => r._keep)
                const wholeMonthInPeriod = periodBounds && items.every(r => isInPeriod(r.date, periodBounds))
                return (
                  <div key={mk}>
                    <div className="import-stmt__month-header">
                      <span className="import-stmt__month-label">
                        {monthLabel(mk)}
                        {wholeMonthInPeriod && (
                          <span className="import-stmt__month-badge">current period</span>
                        )}
                      </span>
                      <button
                        className="import-stmt__month-toggle"
                        onClick={() => {
                          const ids = new Set(items.map(r => r._id))
                          setRows(rs => rs.map(r => ids.has(r._id) ? { ...r, _keep: !allOn } : r))
                        }}
                      >
                        {allOn ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>

                    {items.map(r => (
                      <div
                        key={r._id}
                        className={`import-stmt__row ${!r._keep ? 'import-stmt__row--off' : ''}`}
                      >
                        <button
                          className={`import-stmt__check ${r._keep ? 'import-stmt__check--on' : ''}`}
                          onClick={() => updateRow(r._id, { _keep: !r._keep })}
                          aria-label={r._keep ? 'Exclude' : 'Include'}
                        >
                          {r._keep && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>

                        <div className="import-stmt__row-body">
                          <div className="import-stmt__row-top">
                            <span className="import-stmt__row-date">{r.date}</span>
                            <span className={`import-stmt__badge import-stmt__badge--${r.type}`}>{r.type}</span>
                            <span className="import-stmt__row-amt">${r.amount.toFixed(2)}</span>
                          </div>
                          <div className="import-stmt__row-desc">{r.description}</div>

                          {r._keep && r.type !== 'payment' && (
                            <select
                              className="import-stmt__cat-sel"
                              value={r.sectionKey && r.subcategoryName ? `${r.sectionKey}::${r.subcategoryName}` : ''}
                              onChange={e => {
                                if (!e.target.value) {
                                  updateRow(r._id, { sectionKey: null, subcategoryName: null })
                                } else {
                                  const [sk, sn] = e.target.value.split('::')
                                  updateRow(r._id, { sectionKey: sk, subcategoryName: sn })
                                }
                              }}
                            >
                              <option value="">— unassigned (will skip) —</option>
                              {subcatOptions.map(o => (
                                <option key={`${o.key}::${o.name}`} value={`${o.key}::${o.name}`}>
                                  {SECTION_LABELS[o.key] ?? o.key} › {o.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
                </>
              )
            })()}
          </div>

          <div className="import-stmt__footer">
            <button
              className="import-stmt__import-btn"
              disabled={importableCount === 0}
              onClick={handleImport}
            >
              Import {importableCount} transaction{importableCount !== 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
