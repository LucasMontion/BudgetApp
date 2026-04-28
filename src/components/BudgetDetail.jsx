import { useState } from 'react'

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

export function BudgetDetail({ budget, onBack, onUpdateTransaction, onDeleteTransaction }) {
  const [editingTxn, setEditingTxn] = useState(null)

  const transactions = [...(budget.transactions || [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const sections  = budget.sections || {}
  const isProject = budget.type === 'project'
  const isRecurrent = budget.recurrent && budget.recurrence && !isProject

  const recurrenceLabel = budget.recurrence === 'custom'
    ? `Every ${budget.recurrenceDays} days`
    : RECURRENCE_LABELS[budget.recurrence] || ''

  const sectionRows = [
    sections.income?.enabled && { key: 'income',   label: 'Income',             total: sumItems(sections.income?.items) },
    !isProject               && { key: 'bills',    label: 'Bills',              total: sumItems(sections.bills?.items) },
    true                     && { key: 'variable', label: isProject ? 'Expenses' : 'Variable Expenses', total: sumItems(sections.variable?.items) },
    sections.savings?.enabled && { key: 'savings', label: 'Savings',            total: sumItems(sections.savings?.items) },
  ].filter(Boolean)

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
          </div>
        </div>

        {/* Budget allocations */}
        <div className="bdetail__group">
          <p className="bdetail__group-label">Budget Allocations</p>
          <div className="bdetail__card">
            {sectionRows.map(({ key, label, total }) => (
              <div key={key} className="bdetail__row">
                <span className="bdetail__key">
                  <span className="bdetail__dot" style={{ background: SECTION_COLORS[key] }} />
                  {label}
                </span>
                <span className="bdetail__val">${fmtMoney(total)}</span>
              </div>
            ))}
          </div>
        </div>
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
