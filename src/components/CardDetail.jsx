import { useState } from 'react'
import { getCardCycleBounds, cardCycleLabel, ManageCardSheet } from './CardsList'

function fmtMoney(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(date) {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return Math.ceil((date - todayStart) / (1000 * 60 * 60 * 24))
}

export function CardDetail({ budget, cardId, onBack, onAddPayment, onDeletePayment, onUpdateCard, onDeleteCard }) {
  const card = (budget.cards || []).find(c => c.id === cardId)
  const [addPaymentOpen, setAddPaymentOpen]   = useState(false)
  const [editOpen, setEditOpen]               = useState(false)
  const [confirmDelete, setConfirmDelete]     = useState(false)
  const [pendingDelPayment, setPendingDelPay] = useState(null)

  if (!card) return null

  const { currentStart, currentEnd } = getCardCycleBounds(card.cycleStartDay)
  const allTxns     = budget.transactions || []
  const allPayments = budget.cardPayments || []

  const cardTxns     = allTxns.filter(t => t.cardId === cardId)
  const cardPayments = allPayments.filter(p => p.cardId === cardId)

  // Current cycle
  const currentCharges = cardTxns
    .filter(t => { const d = new Date(t.date); return d >= currentStart && d <= currentEnd })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  const currentTotal = currentCharges.reduce((s, t) => s + t.amount, 0)

  const cyclePayments = cardPayments
    .filter(p => { const d = new Date(p.date); return d >= currentStart && d <= currentEnd })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
  const totalPaid = cyclePayments.reduce((s, p) => s + p.amount, 0)

  // Carried balance: all charges before this cycle minus all payments before this cycle
  const prevCharged  = cardTxns.filter(t => new Date(t.date) < currentStart).reduce((s, t) => s + t.amount, 0)
  const prevPaid     = cardPayments.filter(p => new Date(p.date) < currentStart).reduce((s, p) => s + p.amount, 0)
  const carriedBalance = Math.max(0, prevCharged - prevPaid)

  const totalOwed  = Math.max(0, carriedBalance + currentTotal - totalPaid)
  const totalBase  = carriedBalance + currentTotal
  const paidPct    = totalBase > 0 ? Math.min(100, Math.round((totalPaid / totalBase) * 100)) : 0

  const daysClose  = daysUntil(currentEnd)
  const isUrgent   = daysClose <= 3 && totalOwed > 0
  const utilPct    = card.limit > 0 ? Math.min(100, Math.round((currentTotal / card.limit) * 100)) : 0
  const utilColor  = utilPct >= 90 ? '#F43F5E' : utilPct >= 70 ? '#F59E0B' : card.color

  return (
    <div className="screen">
      {/* Header */}
      <header className="screen-header">
        <button className="back-btn" onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="card-header-dot" style={{ background: card.color }} />
          <h1 className="screen-title">{card.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="back-btn" onClick={() => setEditOpen(true)} aria-label="Edit card">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="card-detail-scroll">

        {/* Current Cycle */}
        <section className="card-section">
          <p className="card-section__label">Current Cycle · {cardCycleLabel(currentStart, currentEnd)}</p>
          <div className="card-cycle-card" style={{ '--card-color': card.color }}>

            {/* Still owed — primary number */}
            <div className="card-cycle-card__top">
              <span className="card-cycle-card__amount" style={{ color: totalOwed > 0 ? (isUrgent ? '#F43F5E' : 'inherit') : '#22C55E' }}>
                ${fmtMoney(totalOwed)}
              </span>
              <span className="card-cycle-card__limit">still owed</span>
            </div>

            {/* Payment progress bar */}
            {totalBase > 0 && (
              <div className="card-cycle-card__track">
                <div className="card-cycle-card__fill" style={{ width: `${paidPct}%`, background: '#22C55E' }} />
              </div>
            )}

            {/* Breakdown rows */}
            <div style={{ marginTop: 10 }}>
              {carriedBalance > 0 && (
                <div className="card-statement-card__row">
                  <span className="card-statement-card__key" style={{ color: '#F59E0B' }}>Carried from before</span>
                  <span className="card-statement-card__val" style={{ color: '#F59E0B' }}>${fmtMoney(carriedBalance)}</span>
                </div>
              )}
              <div className="card-statement-card__row">
                <span className="card-statement-card__key">Charged this cycle</span>
                <span className="card-statement-card__val">${fmtMoney(currentTotal)}</span>
              </div>
              <div className="card-statement-card__row">
                <span className="card-statement-card__key">Paid this cycle</span>
                <span className="card-statement-card__val card-statement-card__val--paid">−${fmtMoney(totalPaid)}</span>
              </div>
            </div>

            {/* Limit utilisation (if set) */}
            {card.limit > 0 && (
              <div className="card-cycle-card__dates" style={{ marginTop: 6 }}>
                <span style={{ color: utilColor }}>{utilPct}% of ${fmtMoney(card.limit)} limit used</span>
              </div>
            )}

            <div className="card-cycle-card__dates">
              <span style={{ color: isUrgent ? '#F43F5E' : undefined }}>
                {daysClose > 0
                  ? `Closes in ${daysClose} day${daysClose !== 1 ? 's' : ''}`
                  : 'Closing today'}
              </span>
            </div>
          </div>

          <button className="card-add-payment-btn" style={{ '--card-color': card.color }} onClick={() => setAddPaymentOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Record Payment
          </button>
        </section>

        {/* Payments this cycle */}
        {cyclePayments.length > 0 && (
          <section className="card-section">
            <p className="card-section__label">Payments This Cycle</p>
            <div className="card-txn-list">
              {cyclePayments.map(p => (
                <div key={p.id} className="card-txn-row">
                  <div className="card-txn-row__dot" style={{ background: '#22C55E' }} />
                  <div className="card-txn-row__info">
                    <span className="card-txn-row__name">{p.memo || 'Payment'}</span>
                    <span className="card-txn-row__date">{fmtDate(p.date)}</span>
                  </div>
                  <span className="card-txn-row__amount card-txn-row__amount--payment">−${fmtMoney(p.amount)}</span>
                  <button className="card-txn-row__del" onClick={() => setPendingDelPay(p)} aria-label="Delete payment">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* This cycle's charges */}
        {currentCharges.length > 0 && (
          <section className="card-section">
            <p className="card-section__label">This Cycle's Charges</p>
            <div className="card-txn-list">
              {currentCharges.map(t => (
                <div key={t.id} className="card-txn-row">
                  <div className="card-txn-row__dot" style={{ background: card.color }} />
                  <div className="card-txn-row__info">
                    <span className="card-txn-row__name">{t.subcategoryName}</span>
                    <span className="card-txn-row__date">{fmtDate(t.date)}{t.memo ? ` · ${t.memo}` : ''}</span>
                  </div>
                  <span className="card-txn-row__amount">${fmtMoney(t.amount)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {currentCharges.length === 0 && (
          <p className="card-empty-note">No charges on this card this cycle.</p>
        )}

        {/* Delete card */}
        <button className="card-delete-btn" onClick={() => setConfirmDelete(true)}>
          Delete card
        </button>

      </div>

      {/* Add payment sheet */}
      {addPaymentOpen && (
        <AddPaymentSheet
          card={card}
          onSave={payment => { onAddPayment(payment); setAddPaymentOpen(false) }}
          onClose={() => setAddPaymentOpen(false)}
        />
      )}

      {/* Edit card sheet */}
      {editOpen && (
        <ManageCardSheet
          existing={card}
          onSave={updates => { onUpdateCard(updates); setEditOpen(false) }}
          onClose={() => setEditOpen(false)}
        />
      )}

      {/* Confirm delete payment */}
      {pendingDelPayment && (
        <div className="confirm-backdrop" onClick={() => setPendingDelPay(null)}>
          <div className="confirm-sheet" onClick={e => e.stopPropagation()}>
            <h2 className="confirm-sheet__title">Delete payment?</h2>
            <p className="confirm-sheet__body">
              <strong>${fmtMoney(pendingDelPayment.amount)}</strong> on {fmtDate(pendingDelPayment.date)} will be removed.
            </p>
            <div className="confirm-sheet__actions">
              <button className="confirm-sheet__cancel" onClick={() => setPendingDelPay(null)}>Cancel</button>
              <button className="confirm-sheet__delete" onClick={() => { onDeletePayment(pendingDelPayment.id); setPendingDelPay(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete card */}
      {confirmDelete && (
        <div className="confirm-backdrop" onClick={() => setConfirmDelete(false)}>
          <div className="confirm-sheet" onClick={e => e.stopPropagation()}>
            <div className="confirm-sheet__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </div>
            <h2 className="confirm-sheet__title">Delete "{card.name}"?</h2>
            <p className="confirm-sheet__body">All payment records for this card will be removed. Transactions will remain in your budget.</p>
            <div className="confirm-sheet__actions">
              <button className="confirm-sheet__cancel" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="confirm-sheet__delete" onClick={onDeleteCard}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Add Payment Sheet ─────────────────────────────────────────────────

function AddPaymentSheet({ card, onSave, onClose }) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const [amount, setAmount]   = useState('')
  const [memo, setMemo]       = useState('')
  const [date, setDate]       = useState(todayStr)
  const [error, setError]     = useState(null)

  function handleSave() {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) { setError('Enter a valid amount'); return }
    onSave({
      cardId: card.id,
      amount: parsed,
      memo: memo.trim(),
      date: new Date(date + 'T12:00:00').toISOString(),
    })
  }

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div className="confirm-sheet manage-card-sheet" onClick={e => e.stopPropagation()}>
        <div className="manage-card-sheet__handle" />
        <h2 className="manage-card-sheet__title">Record Payment</h2>

        <div className="field">
          <label className="field-label">Amount paid</label>
          <div className="catdetail__amount-wrap" style={{ width: '100%' }}>
            <span className="catdetail__currency">$</span>
            <input
              className="catdetail__input catdetail__input--amount"
              type="text" inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={e => { setAmount(e.target.value.replace(/[^0-9.]/g, '')); setError(null) }}
              autoFocus
            />
          </div>
          {error && <p className="field-error">{error}</p>}
        </div>

        <div className="field">
          <label className="field-label">Date</label>
          <input className="field-input" type="date" value={date} max={todayStr} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="field">
          <label className="field-label">Memo (optional)</label>
          <input className="field-input" placeholder="e.g. April payment" value={memo} onChange={e => setMemo(e.target.value)} />
        </div>

        <div className="confirm-sheet__actions" style={{ marginTop: 4 }}>
          <button className="confirm-sheet__cancel" onClick={onClose}>Cancel</button>
          <button className="confirm-sheet__delete" style={{ background: '#22C55E' }} onClick={handleSave}>
            Save Payment
          </button>
        </div>
      </div>
    </div>
  )
}
