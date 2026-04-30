import { useState, useRef } from 'react'
import { getPeriodBounds, getPeriodLabel } from './BudgetOverview'

const SECTION_COLORS = {
  income:   '#10B981',
  bills:    '#EF4444',
  variable: '#F97316',
  savings:  '#8B5CF6',
}

const RECURRENCE_LABELS = {
  weekly:    'Weekly',
  biweekly:  'Bi-weekly',
  monthly:   'Monthly',
  quarterly: 'Quarterly',
  yearly:    'Yearly',
}

function fmtMoney(n) {
  const num = parseFloat(n) || 0
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function sumItems(items = []) {
  return items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
}

const PIE_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
]

function MiniDonut({ title, total, items = [], actualsMap = null }) {
  if (total === 0 || items.length === 0) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ fontSize: '0.8rem', color: '#9CA3AF', marginBottom: 8 }}>{title}</span>
      <div style={{ width: 80, height: 80, borderRadius: '50%', border: '4px solid var(--border)' }} />
      <span style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: 8 }}>$0</span>
    </div>
  )

  let currentPct = 0
  const gradientStops = []
  
  items.forEach((item, idx) => {
    const val = actualsMap ? (actualsMap[item.name] || 0) : (parseFloat(item.amount) || 0)
    if (val <= 0) return
    const pct = val / total
    const start = currentPct * 100
    const end = (currentPct + pct) * 100
    const itemColor = PIE_COLORS[idx % PIE_COLORS.length]
    gradientStops.push(`${itemColor} ${start}% ${end}%`)
    currentPct += pct
  })

  const gradient = gradientStops.length > 0 ? `conic-gradient(${gradientStops.join(', ')})` : 'none'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span style={{ fontSize: '0.8rem', color: '#9CA3AF', marginBottom: 8 }}>{title}</span>
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: gradient !== 'none' ? gradient : 'var(--border)', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 12, background: 'var(--card)', borderRadius: '50%' }} />
      </div>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: 8 }}>${fmtMoney(total)}</span>
    </div>
  )
}

function CategoryBreakdownTabs({ sectionRows, sections, transactions, incomeTotal, incomeActual }) {
  const scrollRef = useRef(null)
  const [activeTab, setActiveTab] = useState(sectionRows[0]?.key)

  if (!sectionRows.length) return null

  const handleScroll = (e) => {
    const el = e.target
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    if (sectionRows[idx] && sectionRows[idx].key !== activeTab) {
      setActiveTab(sectionRows[idx].key)
    }
  }

  const scrollToTab = (idx) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: idx * scrollRef.current.clientWidth, behavior: 'smooth' })
      setActiveTab(sectionRows[idx].key)
    }
  }

  return (
    <div className="bdetail__group" style={{ overflow: 'hidden' }}>
      <p className="bdetail__group-label">Category Breakdown</p>
      
      {/* Tabs Header */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 8, scrollbarWidth: 'none' }}>
        {sectionRows.map((r, idx) => (
          <button
            key={r.key}
            onClick={() => scrollToTab(idx)}
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              border: 'none',
              background: activeTab === r.key ? SECTION_COLORS[r.key] : 'var(--border)',
              color: activeTab === r.key ? '#fff' : 'var(--text)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Tab Content container */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollBehavior: 'smooth', scrollbarWidth: 'none', gap: 16 }}
      >
        {sectionRows.map(r => {
          const items = sections[r.key]?.items || []
          const actualsMap = {}
          transactions.filter(t => t.sectionKey === r.key).forEach(t => {
            const name = t.subcategoryName || 'Uncategorized'
            actualsMap[name] = (actualsMap[name] || 0) + (parseFloat(t.amount) || 0)
          })

          const incPctExpected = incomeTotal > 0 ? ((r.total / incomeTotal) * 100).toFixed(1) : 0
          const incPctActual = incomeActual > 0 ? ((r.actual / incomeActual) * 100).toFixed(1) : 0

          // Calculate max val for bar charts
          const maxVal = Math.max(...items.map(i => Math.max(parseFloat(i.amount) || 0, actualsMap[i.name] || 0)), 1)

          return (
            <div key={r.key} className="bdetail__card" style={{ flex: '0 0 100%', minWidth: 0, scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
                <MiniDonut title="Expected" total={r.total} items={items} />
                <MiniDonut title="Actual" total={r.actual} items={items} actualsMap={actualsMap} />
              </div>

              {r.key !== 'income' && (
                <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.8rem', padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: 16, textAlign: 'center' }}>
                  <div>
                    <div style={{ color: '#9CA3AF', marginBottom: 4 }}>% of Exp. Income</div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{incPctExpected}%</div>
                  </div>
                  <div>
                    <div style={{ color: '#9CA3AF', marginBottom: 4 }}>% of Act. Income</div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{incPctActual}%</div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {items.map((item, idx) => {
                  const exp = parseFloat(item.amount) || 0
                  const act = actualsMap[item.name] || 0
                  const color = PIE_COLORS[idx % PIE_COLORS.length]
                  
                  const incPctExpectedSub = incomeTotal > 0 ? ((exp / incomeTotal) * 100).toFixed(1) : 0
                  const incPctActualSub = incomeActual > 0 ? ((act / incomeActual) * 100).toFixed(1) : 0

                  return (
                    <div key={item.id || item.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 6 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                          {item.name}
                        </span>
                        <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem' }}>
                          <span style={{ color: '#9CA3AF' }}>Exp: ${fmtMoney(exp)} {r.key !== 'income' && `(${incPctExpectedSub}%)`}</span>
                          <span style={{ fontWeight: 600 }}>Act: ${fmtMoney(act)} {r.key !== 'income' && <span style={{ color: '#9CA3AF', fontWeight: 'normal' }}>({incPctActualSub}%)</span>}</span>
                        </div>
                      </div>
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, marginBottom: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${(exp / maxVal) * 100}%`, height: '100%', background: color, opacity: 0.4, borderRadius: 3 }} />
                      </div>
                      <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${(act / maxVal) * 100}%`, height: '100%', background: color, borderRadius: 3 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SpendingLineChart({ budget, periodOffset = 0 }) {
  const [activeIdx, setActiveIdx] = useState(null)
  const svgRef = useRef(null)

  let transactions = budget.transactions || []
  const isProject = budget.type === 'project'
  const isRecurrent = budget.recurrent && budget.recurrence && !isProject

  let periodStart = null
  let periodEnd = null

  if (isRecurrent) {
    const periodOpts = { customDays: budget.recurrenceDays, createdAt: budget.recurrenceStart || budget.createdAt }
    const bounds = getPeriodBounds(budget.recurrence, periodOffset, periodOpts)
    if (bounds) {
      periodStart = bounds.start
      periodEnd = bounds.end
      transactions = transactions.filter(t => {
        const d = new Date(t.date)
        return d >= bounds.start && d <= bounds.end
      })
    }
  }

  // Filter to only expenses (bills and variable)
  const spending = transactions.filter(t => t.sectionKey === 'bills' || t.sectionKey === 'variable')
  if (spending.length === 0) return null

  const grouped = {}
  spending.forEach(t => {
    const dateKey = t.date.slice(0, 10) // Group by ISO date (YYYY-MM-DD)
    grouped[dateKey] = (grouped[dateKey] || 0) + (parseFloat(t.amount) || 0)
  })

  const sortedDates = Object.keys(grouped).sort()
  if (sortedDates.length === 0) return null
  
  if (sortedDates.length === 1 && !periodStart && !budget.createdAt) {
    // Add a zero-point the day before to make it draw a flat line
    const d = new Date(sortedDates[0] + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    const prev = d.toISOString().slice(0, 10)
    grouped[prev] = 0
    sortedDates.unshift(prev)
  }

  let minDate = new Date(sortedDates[0] + 'T12:00:00')
  let maxDate = new Date(sortedDates[sortedDates.length - 1] + 'T12:00:00')

  if (isRecurrent && periodStart) {
    const pStart = new Date(periodStart)
    pStart.setHours(12, 0, 0, 0)
    if (pStart < minDate) minDate = pStart
    
    // Optional: extend to today if we are within the period
    const today = new Date()
    today.setHours(12, 0, 0, 0)
    if (today > maxDate && today <= periodEnd) {
      maxDate = today
    }
  } else if (!isRecurrent && budget.createdAt) {
    const created = new Date(budget.createdAt)
    created.setHours(12, 0, 0, 0)
    if (created < minDate) minDate = created
  }
  
  const filledData = []
  for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    filledData.push({ time: d.getTime(), total: grouped[iso] || 0 })
  }

  const minTime = filledData[0].time
  const maxTime = filledData[filledData.length - 1].time
  const timeRange = maxTime - minTime || 1

  const width = 100 // Scale to 100% via viewBox
  const height = 40
  const maxTotal = Math.max(...filledData.map(d => d.total))
  const yPad = maxTotal === 0 ? 1 : maxTotal * 1.15 // Prevent clipping at top

  const pointsData = filledData.map(d => {
    const x = ((d.time - minTime) / timeRange) * width
    const y = height - (d.total / yPad) * height
    return { x, y, time: d.time, total: d.total }
  })

  const linePoints = pointsData.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
  const areaPoints = `0,${height} ${linePoints} ${width},${height}`

  const startLabel = minDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const handlePointerMove = (e) => {
    if (!svgRef.current || pointsData.length === 0) return
    const rect = svgRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    let x = (clientX - rect.left) / rect.width
    x = Math.max(0, Math.min(1, x))
    const index = Math.round(x * (pointsData.length - 1))
    setActiveIdx(index)
  }

  const handlePointerLeave = () => setActiveIdx(null)

  const activePoint = activeIdx !== null ? pointsData[activeIdx] : null

  return (
    <div className="bdetail__group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 }}>
        <p className="bdetail__group-label" style={{ color: '#F97316', margin: 0 }}>Spending Trend</p>
        {activePoint && (
          <div style={{ fontSize: '0.85rem', color: 'var(--text)', textAlign: 'right', lineHeight: 1.2 }}>
            <div style={{ fontWeight: 600 }}>${activePoint.total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>{new Date(activePoint.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
          </div>
        )}
      </div>
      <div className="bdetail__card bdetail__line-card" style={{ position: 'relative' }}>
        <svg 
          ref={svgRef}
          viewBox="0 0 100 40" 
          preserveAspectRatio="none" 
          className="bdetail__line-svg"
          onMouseMove={handlePointerMove}
          onTouchMove={handlePointerMove}
          onMouseLeave={handlePointerLeave}
          onTouchEnd={handlePointerLeave}
          style={{ touchAction: 'pan-y' }}
        >
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F97316" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill="url(#lineGrad)" />
          <polyline points={linePoints} fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {activePoint && (
            <>
              <line x1={activePoint.x} y1={0} x2={activePoint.x} y2={height} stroke="#F97316" strokeWidth="0.5" strokeDasharray="2" vectorEffect="non-scaling-stroke" />
              <circle cx={activePoint.x} cy={activePoint.y} r="1.5" fill="var(--card)" stroke="#F97316" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        <div className="bdetail__line-labels">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      </div>
    </div>
  )
}

function EditSheet({ txn, budget, onSave, onDelete, onClose }) {
  const color = SECTION_COLORS[txn.sectionKey] ?? '#6366F1'
  const sectionItems = budget.sections?.[txn.sectionKey]?.items?.filter(i => i.name.trim()) || []

  const [digits, setDigits] = useState(String(parseFloat(txn.amount)))
  const [memo, setMemo] = useState(txn.memo || '')
  const [dateStr, setDateStr] = useState(new Date(txn.date).toISOString().slice(0, 10))
  const [selectedSub, setSelectedSub] = useState(txn.subcategoryName)
  const [pendingDelete, setPendingDelete] = useState(false)

  function handleAmountChange(e) {
    let v = e.target.value.replace(/[^0-9.]/g, '')
    const parts = v.split('.')
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('')
    if (parts[1] && parts[1].length > 2) v = parts[0] + '.' + parts[1].slice(0, 2)
    if (v.replace('.', '').length > 8) return
    setDigits(v)
  }

  function handleSave() {
    const amount = parseFloat(digits)
    if (!amount || amount <= 0 || !selectedSub) return
    onSave({ amount, memo: memo.trim(), date: new Date(dateStr + 'T12:00:00').toISOString(), subcategoryName: selectedSub })
  }

  const canSave = parseFloat(digits) > 0 && !!selectedSub

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="edit-txn-sheet">
        <div className="edit-txn-sheet__handle" />
        <div className="edit-txn-sheet__header">
          <p className="edit-txn-sheet__title">Edit Transaction</p>
          <button className="edit-txn-sheet__close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="edit-txn-sheet__amount-row">
          <span className="edit-txn-sheet__currency" style={{ color }}>$</span>
          <input
            className="edit-txn-sheet__amount-input"
            type="text"
            inputMode="decimal"
            value={digits}
            onChange={handleAmountChange}
            style={{ color }}
          />
        </div>

        {sectionItems.length > 0 && (
          <div className="edit-txn-sheet__field">
            <p className="edit-txn-sheet__label">Sub-category</p>
            <div className="edit-txn-sheet__chips">
              {sectionItems.map(item => (
                <button
                  key={item.id}
                  className={`atxn-chip${selectedSub === item.name ? ' atxn-chip--active' : ''}`}
                  style={{ '--chip-color': color }}
                  onClick={() => setSelectedSub(item.name)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="edit-txn-sheet__field">
          <p className="edit-txn-sheet__label">Memo</p>
          <input
            className="edit-txn-sheet__input"
            type="text"
            placeholder="Add a memo…"
            value={memo}
            onChange={e => setMemo(e.target.value)}
          />
        </div>

        <div className="edit-txn-sheet__field">
          <p className="edit-txn-sheet__label">Date</p>
          <input
            className="edit-txn-sheet__input"
            type="date"
            value={dateStr}
            onChange={e => setDateStr(e.target.value)}
          />
        </div>

        <div className="edit-txn-sheet__actions">
          {pendingDelete ? (
            <>
              <button className="edit-txn-sheet__btn-cancel" onClick={() => setPendingDelete(false)}>Cancel</button>
              <button className="edit-txn-sheet__btn-confirm-delete" onClick={onDelete}>Delete</button>
            </>
          ) : (
            <>
              <button className="edit-txn-sheet__btn-delete" onClick={() => setPendingDelete(true)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4h6v2" />
                </svg>
                Delete
              </button>
              <button
                className="edit-txn-sheet__btn-save"
                style={{ background: canSave ? color : undefined }}
                onClick={handleSave}
                disabled={!canSave}
              >
                Save
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export function BudgetDetail({ budget, onBack, onUpdateBudget, onUpdateTransaction, onDeleteTransaction }) {
  const [editingTxn, setEditingTxn] = useState(null)
  const [periodOffset, setPeriodOffset] = useState(0)

  const transactions = [...(budget.transactions || [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const sections  = budget.sections || {}
  const isProject = budget.type === 'project'
  const isRecurrent = budget.recurrent && budget.recurrence && !isProject

  const recurrenceLabel = budget.recurrence === 'custom'
    ? `Every ${budget.recurrenceDays} days`
    : RECURRENCE_LABELS[budget.recurrence] || ''

  const periodOpts = { customDays: budget.recurrenceDays, createdAt: budget.recurrenceStart || budget.createdAt }

  let currentPeriodTxns = transactions
  if (isRecurrent) {
    const bounds = getPeriodBounds(budget.recurrence, periodOffset, periodOpts)
    if (bounds) {
      currentPeriodTxns = transactions.filter(t => {
        const d = new Date(t.date)
        return d >= bounds.start && d <= bounds.end
      })
    }
  }

  const getActual = (key) => currentPeriodTxns
    .filter(t => t.sectionKey === key)
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)

  const sectionRows = [
    sections.income?.enabled && { key: 'income',   label: 'Income',             total: sumItems(sections.income?.items), actual: getActual('income') },
    !isProject               && { key: 'bills',    label: 'Bills',              total: sumItems(sections.bills?.items), actual: getActual('bills') },
    true                     && { key: 'variable', label: isProject ? 'Expenses' : 'Variable Expenses', total: sumItems(sections.variable?.items), actual: getActual('variable') },
    sections.savings?.enabled && { key: 'savings', label: 'Savings',            total: sumItems(sections.savings?.items), actual: getActual('savings') },
  ].filter(Boolean)

  const incomeTotal = sectionRows.find(r => r.key === 'income')?.total || 0
  const expensesTotal = sectionRows.filter(r => r.key !== 'income').reduce((s, r) => s + r.total, 0)
  const extraTotal = incomeTotal - expensesTotal

  const incomeActual = sectionRows.find(r => r.key === 'income')?.actual || 0
  const expensesActual = sectionRows.filter(r => r.key !== 'income').reduce((s, r) => s + r.actual, 0)
  const extraActual = incomeActual - expensesActual

  function handleSave(updates) {
    onUpdateTransaction(editingTxn.id, updates)
    setEditingTxn(null)
  }

  function handleDelete() {
    onDeleteTransaction(editingTxn.id)
    setEditingTxn(null)
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="screen-title">Details</h1>
        <div style={{ width: 40 }} />
      </header>

      {isRecurrent && (
        <div className="period-nav">
          <button
            className="period-nav__arrow"
            onClick={() => setPeriodOffset(o => o - 1)}
            aria-label="Previous period"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="period-nav__label">{getPeriodLabel(budget.recurrence, periodOffset, periodOpts)}</span>
          <button
            className="period-nav__arrow"
            onClick={() => setPeriodOffset(o => o + 1)}
            aria-label="Next period"
            disabled={periodOffset >= 0}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      <div className="bdetail__scroll">
        {/* Budget info */}
        <div className="bdetail__group">
          <p className="bdetail__group-label">Budget Info</p>
          <div className="bdetail__card">
            <div className="bdetail__row">
              <span className="bdetail__key">Name</span>
              <span className="bdetail__val">{budget.name}</span>
            </div>
            <div className="bdetail__row">
              <span className="bdetail__key">Type</span>
              <span className="bdetail__val">{isProject ? 'Project' : 'Daily Life'}</span>
            </div>
            <div className="bdetail__row">
              <span className="bdetail__key">Created</span>
              <span className="bdetail__val">
                {new Date(budget.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            {isRecurrent && (
              <div className="bdetail__row">
                <span className="bdetail__key">Recurrence</span>
                <span className="bdetail__val">{recurrenceLabel}</span>
              </div>
            )}
            {!isProject && (
              <div className="bdetail__row" style={{ alignItems: 'center' }}>
                <span className="bdetail__key">Credit card tracker</span>
                <button
                  className={`toggle${budget.trackCards ? ' toggle--on' : ''}`}
                  style={{ '--toggle-color': '#6366F1' }}
                  onClick={() => onUpdateBudget(budget.id, { trackCards: !budget.trackCards })}
                  aria-pressed={!!budget.trackCards}
                >
                  <div className="toggle__thumb" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Budget allocations */}
        <div className="bdetail__group">
          <p className="bdetail__group-label">Budget Allocations</p>
          <div className="bdetail__card">
            <div className="bdetail__row" style={{ paddingBottom: '8px', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', color: '#9CA3AF' }}>
              <span className="bdetail__key" style={{ flex: 1 }}>Category</span>
              <div style={{ display: 'flex', gap: '16px', textAlign: 'right' }}>
                <span style={{ width: '70px' }}>Expected</span>
                <span style={{ width: '70px' }}>Actual</span>
              </div>
            </div>
            {sectionRows.map(({ key, label, total, actual }) => (
              <div key={key} className="bdetail__row" style={{ paddingTop: '12px' }}>
                <span className="bdetail__key" style={{ flex: 1 }}>
                  <span className="bdetail__dot" style={{ background: SECTION_COLORS[key] }} />
                  {label}
                </span>
                <div style={{ display: 'flex', gap: '16px', textAlign: 'right' }}>
                  <span className="bdetail__val" style={{ width: '70px', color: '#9CA3AF', fontWeight: 'normal' }}>${fmtMoney(total)}</span>
                  <span className="bdetail__val" style={{ width: '70px' }}>${fmtMoney(actual)}</span>
                </div>
              </div>
            ))}
            {sections.income?.enabled && (
              <div className="bdetail__row" style={{ borderTop: '2px solid var(--border)', paddingTop: '12px', marginTop: '4px' }}>
                <span className="bdetail__key" style={{ fontWeight: 600, color: 'var(--text)', flex: 1 }}>
                  <span className="bdetail__dot" style={{ background: '#9CA3AF' }} />
                  Leftover
                </span>
                <div style={{ display: 'flex', gap: '16px', textAlign: 'right' }}>
                  <span className="bdetail__val" style={{ width: '70px', color: '#9CA3AF', fontWeight: 'normal' }}>
                    {extraTotal < 0 ? '-' : ''}${fmtMoney(Math.abs(extraTotal))}
                  </span>
                  <span className="bdetail__val" style={{ width: '70px', color: extraActual >= 0 ? 'var(--text)' : '#F43F5E' }}>
                    {extraActual < 0 ? '-' : ''}${fmtMoney(Math.abs(extraActual))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Spending Trend */}
        <SpendingLineChart budget={budget} periodOffset={periodOffset} />

        {/* Breakdown charts */}
        <CategoryBreakdownTabs 
          sectionRows={sectionRows}
          sections={sections}
          transactions={currentPeriodTxns}
          incomeTotal={incomeTotal}
          incomeActual={incomeActual}
        />
          
      </div>

      {editingTxn && (
        <EditSheet
          txn={editingTxn}
          budget={budget}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditingTxn(null)}
        />
      )}
    </div>
  )
}
