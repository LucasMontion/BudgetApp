import { useState, useEffect, useRef } from 'react'

const SECTION_COLORS = {
  income:   '#10B981',
  bills:    '#EF4444',
  variable: '#F97316',
  savings:  '#8B5CF6',
}

function fmtMoney(n) {
  if (!n || n === 0) return '0'
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function EditItemSheet({ item, color, onSave, onDelete, onClose }) {
  const [name, setName] = useState(item.name)
  const [amount, setAmount] = useState(item.amount ? String(item.amount) : '')
  const [pendingDelete, setPendingDelete] = useState(false)
  const nameRef = useRef(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  function handleAmountChange(e) {
    let v = e.target.value.replace(/[^0-9.]/g, '')
    const parts = v.split('.')
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('')
    if (parts[1] && parts[1].length > 2) v = parts[0] + '.' + parts[1].slice(0, 2)
    setAmount(v)
  }

  const canSave = name.trim().length > 0

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="edit-txn-sheet">
        <div className="edit-txn-sheet__handle" />
        <div className="edit-txn-sheet__header">
          <p className="edit-txn-sheet__title">Edit Sub-category</p>
          <button className="edit-txn-sheet__close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="edit-txn-sheet__field">
          <p className="edit-txn-sheet__label">Name</p>
          <input
            ref={nameRef}
            className="edit-txn-sheet__input"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Sub-category name"
          />
        </div>

        <div className="edit-txn-sheet__field">
          <p className="edit-txn-sheet__label">Expected amount</p>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color, fontWeight: 700, fontSize: '1rem' }}>$</span>
            <input
              className="edit-txn-sheet__input"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0"
              style={{ paddingLeft: 28 }}
            />
          </div>
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
                  <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                </svg>
                Delete
              </button>
              <button
                className="edit-txn-sheet__btn-save"
                style={{ background: canSave ? color : undefined }}
                onClick={() => onSave({ name: name.trim(), amount })}
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

export function CategoryDetail({ budget, sectionKey, sectionLabel, onBack, onAddTransaction, onAddItem, onUpdateItem, onDeleteItem, onOpenSubcategory }) {
  const [showForm, setShowForm]   = useState(false)
  const [newName, setNewName]     = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [nameErr, setNameErr]     = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  const color    = SECTION_COLORS[sectionKey] ?? '#6366f1'
  const isIncome = sectionKey === 'income'
  const sections = budget.sections || {}
  const rawItems = sections[sectionKey]?.items || []
  const transactions = budget.transactions || []

  const items = rawItems.map(item => {
    const expected = parseFloat(item.amount) || 0
    const actual   = transactions
      .filter(t => t.sectionKey === sectionKey && t.subcategoryName === item.name)
      .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
    const pctDisplay = expected > 0 ? Math.round((actual / expected) * 100) : 0
    const pctFill = Math.min(100, pctDisplay)
    return { ...item, expected, actual, pctDisplay, pctFill }
  })

  const totalExpected = items.reduce((s, i) => s + i.expected, 0)
  const totalActual   = items.reduce((s, i) => s + i.actual,   0)
  const totalPctDisplay = totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0
  const totalPctFill = Math.min(100, totalPctDisplay)

  function handleAddItem() {
    if (!newName.trim()) { setNameErr(true); return }
    onAddItem(sectionKey, { name: newName.trim(), amount: newAmount })
    setNewName('')
    setNewAmount('')
    setShowForm(false)
    setNameErr(false)
  }

  return (
    <div className="screen catdetail">
      {/* Header */}
      <header className="catdetail__header" style={{ background: color }}>
        <button className="ov-back-btn" onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="catdetail__title">{sectionLabel}</h1>
        <div style={{ width: 38 }} />
      </header>

      {/* Summary bar */}
      <div className="catdetail__summary">
        <div className="catdetail__summary-row">
          <div>
            <span className="catdetail__actual">${fmtMoney(totalActual)}</span>
            {totalExpected > 0 && <span className="catdetail__of"> of ${fmtMoney(totalExpected)}</span>}
          </div>
          {totalExpected > 0 && <span className="catdetail__pct" style={{ color }}>{totalPctDisplay}%</span>}
        </div>
        {totalExpected > 0 && (
          <div className="catdetail__track">
            <div className="catdetail__fill" style={{ width: `${totalPctFill}%`, background: color }} />
          </div>
        )}
      </div>

      {/* Sub-category list */}
      <div className="catdetail__list">
        <p className="catdetail__list-label">Sub-categories</p>

        {items.length === 0 && !showForm && (
          <div className="catdetail__empty">
            <p>No sub-categories yet.</p>
            <p>Add one below to start tracking.</p>
          </div>
        )}

        {items.map(item => (
          <div key={item.id} className="catitem-row">
            <button
              className="catitem catitem--tappable"
              style={{ '--color': color }}
              onClick={() => onOpenSubcategory && onOpenSubcategory(item.name)}
            >
              <div className="catitem__top">
                <span className="catitem__name">{item.name}</span>
                {item.expected > 0 && <span className="catitem__pct">{item.pctDisplay}%</span>}
              </div>
              {item.expected > 0 && (
                <div className="catitem__track">
                  <div className="catitem__fill" style={{ width: item.pctFill > 0 ? `${item.pctFill}%` : '3px' }} />
                </div>
              )}
              <div className="catitem__amounts">
                <span className="catitem__actual">${fmtMoney(item.actual)} {isIncome ? 'received' : 'spent'}</span>
                {item.expected > 0 && <span className="catitem__expected">of ${fmtMoney(item.expected)} {isIncome ? 'expected' : 'budgeted'}</span>}
              </div>
            </button>
            <button
              className="catitem-row__edit"
              onClick={() => setEditingItem(item)}
              aria-label={`Edit ${item.name}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>
        ))}

        {/* Add sub-category form */}
        {showForm ? (
          <div className="catdetail__form">
            <p className="catdetail__form-title">New sub-category</p>
            <div className="catdetail__form-fields">
              <input
                className={`catdetail__input${nameErr ? ' catdetail__input--err' : ''}`}
                placeholder="Name (e.g. Rent)"
                value={newName}
                onChange={e => { setNewName(e.target.value); setNameErr(false) }}
                autoFocus
                autoComplete="off"
              />
              <div className="catdetail__amount-wrap">
                <span className="catdetail__currency">$</span>
                <input
                  className="catdetail__input catdetail__input--amount"
                  placeholder="Expected"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="catdetail__form-actions">
              <button className="catdetail__btn-cancel" onClick={() => { setShowForm(false); setNameErr(false) }}>
                Cancel
              </button>
              <button className="catdetail__btn-save" style={{ background: color }} onClick={handleAddItem}>
                Add
              </button>
            </div>
          </div>
        ) : (
          <button className="catdetail__add-btn" onClick={() => setShowForm(true)} style={{ '--color': color }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add sub-category
          </button>
        )}
      </div>

      {/* FAB to add transaction */}
      <button
        className="fab"
        style={{ background: color, boxShadow: `0 6px 24px ${color}55` }}
        onClick={onAddTransaction}
        aria-label="Add transaction"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {editingItem && (
        <EditItemSheet
          item={editingItem}
          color={color}
          onSave={updates => { onUpdateItem(editingItem.id, updates); setEditingItem(null) }}
          onDelete={() => { onDeleteItem(editingItem.id); setEditingItem(null) }}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  )
}
