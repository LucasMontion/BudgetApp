import { useState } from 'react'
import { THEMES } from '../themes'

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function newItem() {
  return { id: createId(), name: '', amount: '' }
}

export function CreateBudget({ onCreate, onCancel }) {
  const [step, setStep] = useState(1)

  // Step 1
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [themeId, setThemeId] = useState(THEMES[0].id)

  // Step 2
  const [includeIncome, setIncludeIncome] = useState(false)
  const [includeSavings, setIncludeSavings] = useState(false)

  // Step 3
  const [items, setItems] = useState({
    income: [newItem()],
    bills: [newItem()],
    variable: [newItem()],
    savings: [newItem()],
  })

  const theme = THEMES.find(t => t.id === themeId)

  // ── item helpers ──────────────────────────────────────────────────
  function addItem(section) {
    setItems(prev => ({ ...prev, [section]: [...prev[section], newItem()] }))
  }

  function removeItem(section, id) {
    setItems(prev => ({
      ...prev,
      [section]: prev[section].length > 1
        ? prev[section].filter(i => i.id !== id)
        : prev[section],
    }))
  }

  function updateItem(section, id, field, value) {
    setItems(prev => ({
      ...prev,
      [section]: prev[section].map(i => i.id === id ? { ...i, [field]: value } : i),
    }))
  }

  // ── navigation ───────────────────────────────────────────────────
  function handleBack() {
    if (step === 1) onCancel()
    else setStep(s => s - 1)
  }

  function handleNext() {
    if (step === 1) {
      if (!name.trim()) { setNameError('Please enter a budget name.'); return }
      setStep(2)
    } else if (step === 2) {
      setStep(3)
    }
  }

  function handleCreate() {
    const filterItems = list => list.filter(i => i.name.trim())

    onCreate({
      name: name.trim(),
      themeId,
      sections: {
        income:   { enabled: includeIncome,  items: includeIncome  ? filterItems(items.income)  : [] },
        bills:    { enabled: true,           items: filterItems(items.bills)   },
        variable: { enabled: true,           items: filterItems(items.variable)},
        savings:  { enabled: includeSavings, items: includeSavings ? filterItems(items.savings) : [] },
      },
    })
  }

  // ── render ───────────────────────────────────────────────────────
  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" onClick={handleBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="screen-title">New Budget</h1>
        <div style={{ width: 40 }} />
      </header>

      <StepBar current={step} total={3} labels={['Details', 'Sections', 'Items']} />

      <div className="wizard-body">
        {step === 1 && (
          <StepDetails
            name={name} setName={n => { setName(n); setNameError('') }} nameError={nameError}
            themeId={themeId} setThemeId={setThemeId}
            theme={theme}
            onNext={handleNext}
          />
        )}
        {step === 2 && (
          <StepSections
            includeIncome={includeIncome} setIncludeIncome={setIncludeIncome}
            includeSavings={includeSavings} setIncludeSavings={setIncludeSavings}
            onNext={handleNext}
          />
        )}
        {step === 3 && (
          <StepItems
            includeIncome={includeIncome} includeSavings={includeSavings}
            items={items}
            addItem={addItem} removeItem={removeItem} updateItem={updateItem}
            theme={theme}
            onCreate={handleCreate}
          />
        )}
      </div>
    </div>
  )
}

// ── Step progress bar ────────────────────────────────────────────────
function StepBar({ current, total, labels }) {
  return (
    <div className="step-bar">
      {labels.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={n} className={`step-bar__item${active ? ' step-bar__item--active' : done ? ' step-bar__item--done' : ''}`}>
            <div className="step-bar__dot">
              {done ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : n}
            </div>
            <span className="step-bar__label">{label}</span>
            {i < total - 1 && <div className={`step-bar__line${done ? ' step-bar__line--done' : ''}`} />}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Name & Theme ─────────────────────────────────────────────
function StepDetails({ name, setName, nameError, themeId, setThemeId, theme, onNext }) {
  return (
    <div className="step-content">
      <div className="step-intro">
        <h2 className="step-heading">Name your budget</h2>
        <p className="step-sub">Give it a name and pick a colour theme.</p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="budget-name">Budget name</label>
        <input
          id="budget-name"
          className={`field-input${nameError ? ' field-input--error' : ''}`}
          type="text"
          placeholder="e.g. Monthly Budget"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          maxLength={40}
          autoComplete="off"
        />
        {nameError && <p className="field-error">{nameError}</p>}
      </div>

      <div className="field">
        <label className="field-label">Theme</label>
        <div className="theme-grid">
          {THEMES.map(t => (
            <button
              key={t.id}
              type="button"
              className={`theme-swatch${themeId === t.id ? ' theme-swatch--active' : ''}`}
              onClick={() => setThemeId(t.id)}
              aria-pressed={themeId === t.id}
              aria-label={t.name}
            >
              <span className="theme-swatch__color" style={{ background: t.gradient }} />
              <span className="theme-swatch__name">{t.name}</span>
              {themeId === t.id && (
                <span className="theme-swatch__check">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <p className="field-label">Preview</p>
        <div className="budget-card budget-card--preview" style={{ background: theme.gradient }}>
          <span className="budget-card__name">{name.trim() || 'Budget Name'}</span>
          <span className="budget-card__date">Created today</span>
        </div>
      </div>

      <button className="btn-primary" style={{ background: theme.gradient }} onClick={onNext}>
        Continue
      </button>
    </div>
  )
}

// ── Step 2: Sections ────────────────────────────────────────────────
function StepSections({ includeIncome, setIncludeIncome, includeSavings, setIncludeSavings, onNext }) {
  return (
    <div className="step-content">
      <div className="step-intro">
        <h2 className="step-heading">Set up sections</h2>
        <p className="step-sub">Spendings is always included. Choose which other sections you need.</p>
      </div>

      <div className="section-cards">
        <SectionToggleCard
          icon={<IncomeIcon />}
          color="#22C55E"
          title="Income"
          description="Track your salary, freelance, and other earnings."
          checked={includeIncome}
          onChange={setIncludeIncome}
        />

        <div className="section-card section-card--always-on">
          <div className="section-card__icon" style={{ background: 'rgba(239,68,68,.12)', color: '#EF4444' }}>
            <SpendingsIcon />
          </div>
          <div className="section-card__text">
            <p className="section-card__title">Spendings</p>
            <p className="section-card__desc">Bills (fixed) and Variable Expenses.</p>
          </div>
          <div className="section-card__badge">Always on</div>
        </div>

        <SectionToggleCard
          icon={<SavingsIcon />}
          color="#8B5CF6"
          title="Savings"
          description="Set savings goals and track contributions."
          checked={includeSavings}
          onChange={setIncludeSavings}
        />
      </div>

      <button className="btn-primary" onClick={onNext}>
        Continue
      </button>
    </div>
  )
}

function SectionToggleCard({ icon, color, title, description, checked, onChange }) {
  return (
    <button
      type="button"
      className={`section-card${checked ? ' section-card--on' : ''}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <div className="section-card__icon" style={{ background: `${color}1a`, color }}>
        {icon}
      </div>
      <div className="section-card__text">
        <p className="section-card__title">{title}</p>
        <p className="section-card__desc">{description}</p>
      </div>
      <div className={`toggle${checked ? ' toggle--on' : ''}`} aria-hidden="true">
        <div className="toggle__thumb" />
      </div>
    </button>
  )
}

// ── Step 3: Items ────────────────────────────────────────────────────
function StepItems({ includeIncome, includeSavings, items, addItem, removeItem, updateItem, theme, onCreate }) {
  return (
    <div className="step-content step-content--items">
      <div className="step-intro">
        <h2 className="step-heading">Add your entries</h2>
        <p className="step-sub">Enter the <strong>expected</strong> amount for each item — what you plan to earn, spend, or save.</p>
      </div>

      {includeIncome && (
        <ItemSection
          label="Income"
          accent="#22C55E"
          items={items.income}
          onAdd={() => addItem('income')}
          onRemove={id => removeItem('income', id)}
          onUpdate={(id, f, v) => updateItem('income', id, f, v)}
          addLabel="Add income source"
        />
      )}

      <div className="items-group">
        <div className="items-group__header">
          <div className="items-group__dot" style={{ background: '#EF4444' }} />
          <p className="items-group__title">Spendings</p>
        </div>

        <ItemSection
          label="Bills"
          sublabel="Fixed expenses"
          accent="#EF4444"
          items={items.bills}
          onAdd={() => addItem('bills')}
          onRemove={id => removeItem('bills', id)}
          onUpdate={(id, f, v) => updateItem('bills', id, f, v)}
          addLabel="Add bill"
          nested
        />

        <ItemSection
          label="Variable Expenses"
          sublabel="Day-to-day spending"
          accent="#F97316"
          items={items.variable}
          onAdd={() => addItem('variable')}
          onRemove={id => removeItem('variable', id)}
          onUpdate={(id, f, v) => updateItem('variable', id, f, v)}
          addLabel="Add expense"
          nested
        />
      </div>

      {includeSavings && (
        <ItemSection
          label="Savings"
          accent="#8B5CF6"
          items={items.savings}
          onAdd={() => addItem('savings')}
          onRemove={id => removeItem('savings', id)}
          onUpdate={(id, f, v) => updateItem('savings', id, f, v)}
          addLabel="Add savings goal"
        />
      )}

      <button className="btn-primary" style={{ background: theme.gradient }} onClick={onCreate}>
        Create Budget
      </button>
    </div>
  )
}

function ItemSection({ label, sublabel, accent, items, onAdd, onRemove, onUpdate, addLabel, nested }) {
  return (
    <div className={`items-section${nested ? ' items-section--nested' : ''}`}>
      <div className="items-section__header">
        <div className="items-section__dot" style={{ background: accent }} />
        <div>
          <p className="items-section__label">{label}</p>
          {sublabel && <p className="items-section__sublabel">{sublabel}</p>}
        </div>
      </div>

      <div className="items-section__rows">
        {items.map((item, idx) => (
          <div key={item.id} className="item-row">
            <input
              className="item-row__name"
              type="text"
              placeholder={`Item ${idx + 1}`}
              value={item.name}
              onChange={e => onUpdate(item.id, 'name', e.target.value)}
              autoComplete="off"
            />
            <div className="item-row__amount-wrap">
              <span className="item-row__currency">$</span>
              <input
                className="item-row__amount"
                type="text"
                inputMode="decimal"
                placeholder="Expected"
                value={item.amount}
                onChange={e => onUpdate(item.id, 'amount', e.target.value)}
              />
            </div>
            <button
              className="item-row__remove"
              onClick={() => onRemove(item.id)}
              aria-label="Remove"
              disabled={items.length === 1}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button className="add-item-btn" onClick={onAdd} style={{ '--accent': accent }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {addLabel}
      </button>
    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────────────
function IncomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

function SpendingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  )
}

function SavingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.8 1.7-1.8 2-3h1v-4h-1c0-.7-.1-1.4-.2-2H19z" />
      <path d="M2 9V7c0-1.1.9-2 2-2h3" /><circle cx="16" cy="11" r="1" />
    </svg>
  )
}
