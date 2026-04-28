import { useEffect, useState } from 'react'

const CATEGORY_META = {
  income: { label: 'Income', color: '#10B981' },
  bills: { label: 'Bills', color: '#EF4444' },
  variable: { label: 'Expenses', color: '#F97316' },
  savings: { label: 'Savings', color: '#8B5CF6' },
}

function buildAvailableCategories(sections) {
  const cats = []
  if (sections.income?.enabled) cats.push('income')
  cats.push('bills')
  cats.push('variable')
  if (sections.savings?.enabled) cats.push('savings')
  return cats
}

export function AddTransaction({ budget, initialSectionKey, onSave, onCancel }) {
  const sections = budget.sections || {}
  const available = buildAvailableCategories(sections)
  const defaultKey = available.includes(initialSectionKey) ? initialSectionKey : available[0] ?? 'bills'

  const [catKey, setCatKey] = useState(defaultKey)
  const [selectedSub, setSelectedSub] = useState(null)
  const [digits, setDigits] = useState('')
  const [memo, setMemo] = useState('')
  const [kbHeight, setKbHeight] = useState(0)
  const [kbOpen, setKbOpen] = useState(false)

  const category = CATEGORY_META[catKey]
  const sectionItems = sections[catKey]?.items?.filter(i => i.name.trim()) || []

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function updateKeyboard() {
      const height = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKbHeight(height)
      setKbOpen(height > 80)
    }

    updateKeyboard()
    vv.addEventListener('resize', updateKeyboard)
    vv.addEventListener('scroll', updateKeyboard)
    return () => {
      vv.removeEventListener('resize', updateKeyboard)
      vv.removeEventListener('scroll', updateKeyboard)
    }
  }, [])

  // Logic for the native input listener
  const handleInputChange = (e) => {
    let value = e.target.value;

    // Remove non-numeric/dot characters
    value = value.replace(/[^0-9.]/g, '');

    // Ensure only one decimal point
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      value = parts[0] + '.' + parts[1].substring(0, 2);
    }

    // Limit total length to match your original pressDigit logic (8 chars)
    if (value.replace('.', '').length > 8) return;

    setDigits(value);
  };

  function changeCategory(key) {
    setCatKey(key)
    setSelectedSub(null)
  }

  function handleConfirm() {
    const amount = parseFloat(digits)
    if (!amount || amount <= 0 || !selectedSub) return
    onSave({ sectionKey: catKey, subcategoryName: selectedSub, amount, memo: memo.trim() })
  }

  const canConfirm = parseFloat(digits) > 0 && !!selectedSub
  const displayStr = digits ? `$${digits}` : '$0'

  return (
    <div
      className={`add-txn${kbOpen ? ' add-txn--keyboard' : ''}`}
      style={{ '--kb': `${kbHeight}px` }}
    >

      <button className="add-txn__close" onClick={onCancel} aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div className="add-txn__top">
        {/* We wrap the display in a label so clicking the "Card" opens the keyboard */}
        <label className="add-txn__amount-card" style={{ background: category.color, cursor: 'text' }}>
          <span className="add-txn__amount-text">{displayStr}</span>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*"
            className="add-txn__hidden-input" 
            value={digits}
            onChange={handleInputChange}
            autoFocus
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
          />
        </label>
        
        <input
          className="add-txn__memo"
          placeholder="Write a memo..."
          value={memo}
          onChange={e => setMemo(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="add-txn__bottom">

        <div className="add-txn__section">
          <p className="add-txn__section-label">Category</p>
          <div className="cat-selector">
            {available.map(key => {
              const m = CATEGORY_META[key]
              const active = catKey === key
              return (
                <button
                  key={key}
                  className={`cat-selector__item${active ? ' cat-selector__item--active' : ''}`}
                  style={active ? { background: m.color, borderColor: m.color } : {}}
                  onClick={() => changeCategory(key)}
                >
                  <span className="cat-selector__dot" style={{ background: m.color }} />
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="add-txn__section">
          <p className="add-txn__section-label">
            <span style={{ color: category.color }}>{category.label}</span>
            {' — sub-category'}
          </p>
          <div className="add-txn__chips">
            {sectionItems.length === 0 && (
              <span className="add-txn__no-items">No sub-categories — add one from the category detail.</span>
            )}
            {sectionItems.map(item => (
              <button
                key={item.id}
                className={`atxn-chip${selectedSub === item.name ? ' atxn-chip--active' : ''}`}
                style={{ '--chip-color': category.color }}
                onClick={() => setSelectedSub(item.name)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
        <div className="add-txn__action">
          <button
            className="add-txn__btn"
            style={{ background: canConfirm ? category.color : undefined }}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            Add Transaction
          </button>
        </div>

      </div>
    </div>
  )
}
