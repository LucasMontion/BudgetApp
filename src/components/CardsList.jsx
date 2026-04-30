import { useState } from 'react'

export const CARD_COLORS = [
  { id: 'indigo', hex: '#6366F1' },
  { id: 'blue',   hex: '#3B82F6' },
  { id: 'teal',   hex: '#14B8A6' },
  { id: 'rose',   hex: '#F43F5E' },
  { id: 'amber',  hex: '#F59E0B' },
  { id: 'violet', hex: '#8B5CF6' },
]

// ── Cycle helpers ─────────────────────────────────────────────────────

export function getCardCycleBounds(cycleStartDay, cycleDays = null) {
  const today = new Date()
  const day   = today.getDate()
  const month = today.getMonth()
  const year  = today.getFullYear()

  const startMonth = day >= cycleStartDay ? month : (month === 0 ? 11 : month - 1)
  const startYear  = day >= cycleStartDay ? year  : (month === 0 ? year - 1 : year)

  const currentStart = new Date(startYear, startMonth, cycleStartDay, 0, 0, 0, 0)

  let currentEnd
  if (cycleDays) {
    currentEnd = new Date(currentStart)
    currentEnd.setDate(currentStart.getDate() + cycleDays)
    currentEnd.setMilliseconds(-1)
  } else {
    const nextMonth = (startMonth + 1) % 12
    const nextYear  = startMonth === 11 ? startYear + 1 : startYear
    currentEnd = new Date(nextYear, nextMonth, cycleStartDay, 0, 0, 0, 0)
    currentEnd.setMilliseconds(-1)
  }

  const prevMonth = startMonth === 0 ? 11 : startMonth - 1
  const prevYear  = startMonth === 0 ? startYear - 1 : startYear
  const previousStart = new Date(prevYear, prevMonth, cycleStartDay, 0, 0, 0, 0)
  const previousEnd   = new Date(currentStart)
  previousEnd.setMilliseconds(-1)

  return { currentStart, currentEnd, previousStart, previousEnd }
}

export function cardCycleLabel(start, end) {
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

function daysUntil(date) {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return Math.ceil((date - todayStart) / (1000 * 60 * 60 * 24))
}

// ── CardsPanel (embedded in BudgetOverview) ───────────────────────────

export function CardsPanel({ budget, onOpenCard, onAddCard, onUpdateCard, onDeleteCard }) {
  const [addOpen, setAddOpen] = useState(false)
  const cards = budget.cards || []

  return (
    <div className="cards-panel">
      <div className="cards-panel__header">
        <div className="cards-panel__title-row">
          <CreditCardIcon />
          <span className="cards-panel__title">Credit Cards</span>
        </div>
      </div>

      {cards.length === 0 ? (
        <button className="cards-panel__add-first" onClick={() => setAddOpen(true)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add your first card
        </button>
      ) : (
        <>
          <div className="cards-panel__list">
            {cards.map(card => (
              <CardSummaryRow key={card.id} card={card} budget={budget} onOpen={() => onOpenCard(card.id)} />
            ))}
          </div>
          <button className="cards-panel__add-another" onClick={() => setAddOpen(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add card
          </button>
        </>
      )}

      {addOpen && (
        <ManageCardSheet
          onSave={card => { onAddCard(card); setAddOpen(false) }}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  )
}

function CardSummaryRow({ card, budget, onOpen }) {
  const { currentStart, currentEnd } = getCardCycleBounds(card.cycleStartDay, card.cycleDays || null)

  const cardTxns     = (budget.transactions || []).filter(t => t.cardId === card.id)
  const cardPayments = (budget.cardPayments || []).filter(p => p.cardId === card.id)

  const currentTotal = cardTxns
    .filter(t => { const d = new Date(t.date); return d >= currentStart && d <= currentEnd })
    .reduce((s, t) => s + t.amount, 0)

  const totalPaid = cardPayments
    .filter(p => { const d = new Date(p.date); return d >= currentStart && d <= currentEnd })
    .reduce((s, p) => s + p.amount, 0)

  const prevCharged = cardTxns.filter(t => new Date(t.date) < currentStart).reduce((s, t) => s + t.amount, 0)
  const prevPaid    = cardPayments.filter(p => new Date(p.date) < currentStart).reduce((s, p) => s + p.amount, 0)
  const prevNet     = prevCharged - prevPaid

  const totalBase = Math.max(0, prevNet) + currentTotal
  const stillOwed = Math.max(0, prevNet + currentTotal - totalPaid)
  const paidPct   = totalBase > 0 ? Math.min(100, Math.round(((totalPaid - Math.min(0, prevNet)) / totalBase) * 100)) : 0
  const daysClose = daysUntil(currentEnd)
  const isUrgent  = daysClose <= 3 && stillOwed > 0

  return (
    <button className="card-summary-row" onClick={onOpen}>
      <div className="card-summary-row__indicator" style={{ background: card.color }} />
      <div className="card-summary-row__info">
        <div className="card-summary-row__name">{card.name}</div>
        {currentTotal > 0 && (
          <div className="card-summary-row__track">
            <div className="card-summary-row__fill" style={{ width: `${paidPct}%`, background: '#22C55E' }} />
          </div>
        )}
        <div className="card-summary-row__meta" style={{ color: isUrgent ? '#F43F5E' : undefined }}>
          ${fmtMoney(stillOwed)} owed{' · '}{daysClose > 0 ? `${daysClose}d until close` : 'Cycle closing today'}
        </div>
      </div>
      <svg className="card-summary-row__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  )
}

// ── ManageCardSheet (add / edit a card) ───────────────────────────────

export function ManageCardSheet({ existing, onSave, onClose }) {
  const [name, setName]               = useState(existing?.name ?? '')
  const [limit, setLimit]             = useState(existing?.limit ? String(existing.limit) : '')
  const [cycleStartDay, setCycleDay]  = useState(existing?.cycleStartDay ?? 1)
  const [cycleDays, setCycleDays]     = useState(existing?.cycleDays ? String(existing.cycleDays) : '')
  const [color, setColor]             = useState(existing?.color ?? CARD_COLORS[0].hex)
  const [error, setError]             = useState(null)

  function handleSave() {
    if (!name.trim()) { setError('Card name is required'); return }
    const parsedCycleDays = parseInt(cycleDays) || null
    onSave({ name: name.trim(), limit, cycleStartDay, cycleDays: parsedCycleDays, color })
  }

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div className="confirm-sheet manage-card-sheet" onClick={e => e.stopPropagation()}>
        <div className="manage-card-sheet__handle" />
        <h2 className="manage-card-sheet__title">{existing ? 'Edit Card' : 'Add Credit Card'}</h2>

        <div className="field">
          <label className="field-label">Card name</label>
          <input className={`field-input${error ? ' field-input--error' : ''}`} placeholder="e.g. Visa Gold" value={name} onChange={e => { setName(e.target.value); setError(null) }} />
          {error && <p className="field-error">{error}</p>}
        </div>

        <div className="field">
          <label className="field-label">Credit limit (optional)</label>
          <div className="catdetail__amount-wrap" style={{ width: '100%' }}>
            <span className="catdetail__currency">$</span>
            <input className="catdetail__input catdetail__input--amount" type="text" inputMode="decimal" placeholder="5,000" value={limit} onChange={e => setLimit(e.target.value.replace(/[^0-9.]/g, ''))} />
          </div>
        </div>

        <div className="manage-card-sheet__row">
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">Cycle start day</label>
            <input className="field-input" type="number" min="1" max="28" value={cycleStartDay} onChange={e => setCycleDay(Number(e.target.value))} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label className="field-label">Cycle length (days)</label>
            <input
              className="field-input"
              type="number"
              min="1"
              max="365"
              placeholder="Monthly"
              value={cycleDays}
              onChange={e => setCycleDays(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label">Color</label>
          <div className="card-color-picker">
            {CARD_COLORS.map(c => (
              <button
                key={c.id}
                className={`card-color-swatch${color.toLowerCase() === c.hex.toLowerCase() ? ' card-color-swatch--active' : ''}`}
                style={{ background: c.hex }}
                onClick={() => setColor(c.hex)}
                aria-label={c.id}
              />
            ))}
            <label 
              className={`card-color-swatch${!CARD_COLORS.find(c => c.hex.toLowerCase() === color.toLowerCase()) ? ' card-color-swatch--active' : ''}`}
              style={{ background: !CARD_COLORS.find(c => c.hex.toLowerCase() === color.toLowerCase()) ? color : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={!CARD_COLORS.find(c => c.hex.toLowerCase() === color.toLowerCase()) ? '#fff' : '#6b7280'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <input 
                type="color" 
                value={color}
                onChange={e => setColor(e.target.value)}
                style={{ opacity: 0, position: 'absolute', width: 0, height: 0, padding: 0, border: 0 }}
              />
            </label>
          </div>
        </div>

        <div className="confirm-sheet__actions" style={{ marginTop: 4 }}>
          <button className="confirm-sheet__cancel" onClick={onClose}>Cancel</button>
          <button className="confirm-sheet__delete" style={{ background: color }} onClick={handleSave}>
            {existing ? 'Save' : 'Add Card'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────

function fmtMoney(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function CreditCardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}
