import { useState } from 'react'

const SECTION_COLORS = {
  income:   '#10B981',
  bills:    '#EF4444',
  variable: '#F97316',
  savings:  '#8B5CF6',
}

function EditSheet({ txn, budget, sectionKey, color, onSave, onDelete, onClose }) {
  const [digits, setDigits] = useState(String(parseFloat(txn.amount)))
  const [memo, setMemo] = useState(txn.memo || '')
  const [dateStr, setDateStr] = useState(new Date(txn.date).toISOString().slice(0, 10))
  const [selectedSub, setSelectedSub] = useState(txn.subcategoryName)
  const [selectedCardId, setSelectedCardId] = useState(txn.cardId ?? null)
  const [pendingDelete, setPendingDelete] = useState(false)

  const sectionItems = budget.sections?.[sectionKey]?.items?.filter(i => i.name.trim()) || []
  const cards = (budget.trackCards ?? false) ? (budget.cards || []) : []

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
    onSave({ amount, memo: memo.trim(), date: new Date(dateStr + 'T12:00:00').toISOString(), subcategoryName: selectedSub, cardId: selectedCardId })
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

        {cards.length > 0 && (
          <div className="edit-txn-sheet__field">
            <p className="edit-txn-sheet__label">Charged to card</p>
            <div className="edit-txn-sheet__chips">
              {cards.map(card => (
                <button
                  key={card.id}
                  className={`atxn-chip${selectedCardId === card.id ? ' atxn-chip--active' : ''}`}
                  style={{ '--chip-color': card.color }}
                  onClick={() => setSelectedCardId(id => id === card.id ? null : card.id)}
                >
                  <span className="atxn-chip__dot" style={{ background: card.color, opacity: selectedCardId === card.id ? 0 : 1 }} />
                  {card.name}
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
              <button className="edit-txn-sheet__btn-save" style={{ background: canSave ? color : undefined }} onClick={handleSave} disabled={!canSave}>
                Save
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'highest', label: 'Highest $' },
  { key: 'lowest', label: 'Lowest $' },
]

export function TransactionList({ budget, transactions: txnsProp, sectionKey, sectionLabel, subcategoryName, onBack, onAddTransaction, onUpdateTransaction, onDeleteTransaction }) {
  const [editingTxn, setEditingTxn] = useState(null)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState('newest')
  const [filterSub, setFilterSub] = useState(null)

  const title = subcategoryName ?? sectionLabel
  const color = budget.sections?.[sectionKey]?.color ?? SECTION_COLORS[sectionKey] ?? '#6366f1'

  const allTransactions = (txnsProp ?? budget.transactions ?? [])
    .filter(t => t.sectionKey === sectionKey && (!subcategoryName || t.subcategoryName === subcategoryName))

  const subcategories = subcategoryName
    ? []
    : [...new Set(allTransactions.map(t => t.subcategoryName).filter(Boolean))]

  const transactions = allTransactions
    .filter(t => {
      if (filterSub && t.subcategoryName !== filterSub) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        return (t.memo || '').toLowerCase().includes(q) || (t.subcategoryName || '').toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      if (sortKey === 'oldest') return new Date(a.date) - new Date(b.date)
      if (sortKey === 'highest') return b.amount - a.amount
      if (sortKey === 'lowest') return a.amount - b.amount
      return new Date(b.date) - new Date(a.date)
    })

  const hasFilters = query.trim() || filterSub

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
        <h1 className="screen-title">{title}</h1>
        <div style={{ width: 40 }} />
      </header>

      <div className="txn-search-bar">
        <div className="txn-search-bar__wrap">
          <svg className="txn-search-bar__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="txn-search-bar__input"
            type="text"
            placeholder="Search transactions…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="txn-search-bar__clear" onClick={() => setQuery('')} aria-label="Clear search">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="txn-filter-row">
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            className={`atxn-chip${sortKey === opt.key ? ' atxn-chip--active' : ''}`}
            style={{ '--chip-color': color }}
            onClick={() => setSortKey(opt.key)}
          >
            {opt.label}
          </button>
        ))}
        {subcategories.length > 1 && (
          <>
            <span className="txn-filter-divider" />
            {subcategories.map(sub => (
              <button
                key={sub}
                className={`atxn-chip${filterSub === sub ? ' atxn-chip--active' : ''}`}
                style={{ '--chip-color': color }}
                onClick={() => setFilterSub(s => s === sub ? null : sub)}
              >
                {sub}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="txn-list">
        {transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              {hasFilters ? (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              ) : (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              )}
            </div>
            {hasFilters ? (
              <>
                <h2 className="empty-state__title">No results</h2>
                <p className="empty-state__body">Try adjusting your search or filters.</p>
              </>
            ) : (
              <>
                <h2 className="empty-state__title">No transactions yet</h2>
                <p className="empty-state__body">Tap + to record your first {title.toLowerCase()} entry.</p>
              </>
            )}
          </div>
        ) : (
          transactions.map(txn => (
            <button key={txn.id} className="txn-row txn-row--tappable" onClick={() => setEditingTxn(txn)}>
              <div className="txn-row__dot" style={{ background: color }} />
              <div className="txn-row__info">
                <p className="txn-row__name">{txn.subcategoryName}</p>
                {txn.memo && <p className="txn-row__memo">{txn.memo}</p>}
                <p className="txn-row__date">
                  {new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <span className="txn-row__amount" style={{ color }}>
                ${parseFloat(txn.amount).toFixed(2)}
              </span>
            </button>
          ))
        )}
      </div>

      <button className="fab" style={{ background: color, boxShadow: `0 6px 24px ${color}66` }} onClick={onAddTransaction} aria-label="Add transaction">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {editingTxn && (
        <EditSheet
          txn={editingTxn}
          budget={budget}
          sectionKey={sectionKey}
          color={color}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditingTxn(null)}
        />
      )}
    </div>
  )
}
