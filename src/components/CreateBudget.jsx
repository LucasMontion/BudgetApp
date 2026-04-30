import { useState } from 'react'
import { THEMES } from '../themes'
import { CARD_COLORS } from './CardsList'

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
  const [budgetType, setBudgetType] = useState(null) // 'daily' | 'project'

  // Step 2
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState('')
  const [themeId, setThemeId] = useState(THEMES[0].id)

  // Step 3
  const [includeIncome, setIncludeIncome] = useState(false)
  const [includeSavings, setIncludeSavings] = useState(false)
  const [trackCards, setTrackCards] = useState(false)
  const [recurrent, setRecurrent] = useState(false)
  const [recurrence, setRecurrence] = useState('monthly')
  const [customDays, setCustomDays] = useState(30)
  const [customStart, setCustomStart] = useState(() => new Date().toISOString().slice(0, 10))

  // Step 4 (cards — only when trackCards)
  const [initCards, setInitCards] = useState([])

  // Step 4 or 5 (items)
  const [items, setItems] = useState({
    income:   [newItem()],
    bills:    [newItem()],
    variable: [newItem()],
    savings:  [newItem()],
  })

  const theme = THEMES.find(t => t.id === themeId)
  const isProject = budgetType === 'project'
  const hasCardsStep = !isProject && trackCards
  const stepLabels = hasCardsStep
    ? ['Type', 'Details', 'Sections', 'Cards', 'Items']
    : ['Type', 'Details', 'Sections', 'Items']
  const itemsStep = hasCardsStep ? 5 : 4

  function addItem(section) {
    setItems(prev => ({ ...prev, [section]: [...prev[section], newItem()] }))
  }
  function removeItem(section, id) {
    setItems(prev => ({
      ...prev,
      [section]: prev[section].length > 1 ? prev[section].filter(i => i.id !== id) : prev[section],
    }))
  }
  function updateItem(section, id, field, value) {
    setItems(prev => ({
      ...prev,
      [section]: prev[section].map(i => i.id === id ? { ...i, [field]: value } : i),
    }))
  }

  function handleBack() {
    if (step === 1) onCancel()
    else setStep(s => s - 1)
  }

  function handleSelectType(type) {
    setBudgetType(type)
    setStep(2)
  }

  function handleNext() {
    if (step === 2) {
      if (!name.trim()) { setNameError('Please enter a budget name.'); return }
      setStep(3)
    } else if (step === 3) {
      setStep(4)
    } else if (step === 4 && hasCardsStep) {
      setStep(5)
    }
  }

  function handleCreate() {
    const filterItems = list => list.filter(i => i.name.trim())
    const isProject = budgetType === 'project'

    onCreate({
      type: budgetType,
      name: name.trim(),
      themeId,
      recurrent: budgetType === 'daily' ? recurrent : false,
      recurrence: budgetType === 'daily' && recurrent ? recurrence : null,
      recurrenceDays: budgetType === 'daily' && recurrent && recurrence === 'custom' ? Math.max(1, customDays) : null,
      recurrenceStart: budgetType === 'daily' && recurrent && recurrence === 'custom' ? customStart : null,
      trackCards: !isProject && trackCards,
      cards: !isProject && trackCards ? initCards : [],
      sections: {
        income:   { enabled: includeIncome,                    items: includeIncome  ? filterItems(items.income)   : [] },
        bills:    { enabled: !isProject,                       items: !isProject     ? filterItems(items.bills)    : [] },
        variable: { enabled: true,                             items: filterItems(items.variable) },
        savings:  { enabled: !isProject && includeSavings,     items: (!isProject && includeSavings) ? filterItems(items.savings) : [] },
      },
    })
  }

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

      <StepBar current={step} total={stepLabels.length} labels={stepLabels} />

      <div className="wizard-body">
        {step === 1 && <StepType onSelect={handleSelectType} />}
        {step === 2 && (
          <StepDetails
            name={name} setName={n => { setName(n); setNameError('') }} nameError={nameError}
            themeId={themeId} setThemeId={setThemeId}
            theme={theme}
            onNext={handleNext}
          />
        )}
        {step === 3 && (
          <StepSections
            isProject={isProject}
            includeIncome={includeIncome} setIncludeIncome={setIncludeIncome}
            includeSavings={includeSavings} setIncludeSavings={setIncludeSavings}
            trackCards={trackCards} setTrackCards={setTrackCards}
            recurrent={recurrent} setRecurrent={setRecurrent}
            recurrence={recurrence} setRecurrence={setRecurrence}
            customDays={customDays} setCustomDays={setCustomDays}
            customStart={customStart} setCustomStart={setCustomStart}
            onNext={handleNext}
          />
        )}
        {step === 4 && hasCardsStep && (
          <StepCards
            cards={initCards}
            setCards={setInitCards}
            onNext={handleNext}
          />
        )}
        {step === itemsStep && (
          <StepItems
            isProject={isProject}
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

// ── Step 1: Budget Type ───────────────────────────────────────────────
function StepType({ onSelect }) {
  return (
    <div className="step-content">
      <div className="step-intro">
        <h2 className="step-heading">What kind of budget?</h2>
        <p className="step-sub">Choose the type that best fits your goal.</p>
      </div>

      <div className="type-cards">
        <button className="type-card" onClick={() => onSelect('daily')}>
          <div className="type-card__icon type-card__icon--daily">
            <DailyLifeIcon />
          </div>
          <div className="type-card__text">
            <p className="type-card__title">Daily Life</p>
            <p className="type-card__desc">Regular income, fixed bills, variable expenses, and savings goals.</p>
          </div>
          <svg className="type-card__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <button className="type-card" onClick={() => onSelect('project')}>
          <div className="type-card__icon type-card__icon--project">
            <ProjectIcon />
          </div>
          <div className="type-card__text">
            <p className="type-card__title">Project</p>
            <p className="type-card__desc">Income and simple expenses for a specific project or goal. No fixed bills.</p>
          </div>
          <svg className="type-card__arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Name & Theme ─────────────────────────────────────────────
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

const RECURRENCE_OPTIONS = [
  { value: 'weekly',    label: 'Weekly' },
  { value: 'biweekly',  label: 'Bi-weekly' },
  { value: 'monthly',   label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly',    label: 'Yearly' },
  { value: 'custom',    label: 'Custom' },
]

// ── Step 3: Sections ────────────────────────────────────────────────
function StepSections({ isProject, includeIncome, setIncludeIncome, includeSavings, setIncludeSavings, trackCards, setTrackCards, recurrent, setRecurrent, recurrence, setRecurrence, customDays, setCustomDays, customStart, setCustomStart, onNext }) {
  return (
    <div className="step-content">
      <div className="step-intro">
        <h2 className="step-heading">Set up sections</h2>
        <p className="step-sub">
          {isProject
            ? 'Expenses are always included. Optionally track income too.'
            : 'Spendings are always included. Choose which other sections you need.'}
        </p>
      </div>

      <div className="section-cards">
        <SectionToggleCard
          icon={<IncomeIcon />}
          color="#22C55E"
          title="Income"
          description={isProject ? 'Track revenue or funding for this project.' : 'Track your salary, freelance, and other earnings.'}
          checked={includeIncome}
          onChange={setIncludeIncome}
        />

        {isProject ? (
          <div className="section-card section-card--always-on">
            <div className="section-card__icon" style={{ background: 'rgba(249,115,22,.12)', color: '#F97316' }}>
              <SpendingsIcon />
            </div>
            <div className="section-card__text">
              <p className="section-card__title">Expenses</p>
              <p className="section-card__desc">Simple expenses — no fixed bills.</p>
            </div>
            <div className="section-card__badge">Always on</div>
          </div>
        ) : (
          <>
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

            <div className="recurrence-section">
              <SectionToggleCard
                icon={<RecurrenceIcon />}
                color="#3B82F6"
                title="Recurring budget"
                description="Resets each period — keeps structure, clears actuals."
                checked={recurrent}
                onChange={setRecurrent}
              />
              {recurrent && (
                <div className="recurrence-pills">
                  {RECURRENCE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`recurrence-pill${recurrence === opt.value ? ' recurrence-pill--active' : ''}`}
                      onClick={() => setRecurrence(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                  {recurrence === 'custom' && (
                    <div className="recurrence-custom-fields">
                      <div className="recurrence-custom-days">
                        <span className="recurrence-custom-label">Every</span>
                        <input
                          className="recurrence-custom-input"
                          type="number"
                          min="1"
                          value={customDays}
                          onChange={e => setCustomDays(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <span className="recurrence-custom-label">days</span>
                      </div>
                      <div className="recurrence-custom-days">
                        <span className="recurrence-custom-label">Starting</span>
                        <input
                          className="recurrence-custom-input recurrence-custom-input--date"
                          type="date"
                          value={customStart}
                          onChange={e => setCustomStart(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <SectionToggleCard
              icon={<CreditCardIcon />}
              color="#6366F1"
              title="Credit card tracker"
              description="Track card cycles, statement balances, and payments."
              checked={trackCards}
              onChange={setTrackCards}
            />
          </>
        )}
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

// ── Step 4: Items ────────────────────────────────────────────────────
function StepItems({ isProject, includeIncome, includeSavings, items, addItem, removeItem, updateItem, theme, onCreate }) {
  return (
    <div className="step-content step-content--items">
      <div className="step-intro">
        <h2 className="step-heading">Add your entries</h2>
        <p className="step-sub">Enter the <strong>expected</strong> amount for each item — what you plan to earn or spend.</p>
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

      {isProject ? (
        <ItemSection
          label="Expenses"
          accent="#F97316"
          items={items.variable}
          onAdd={() => addItem('variable')}
          onRemove={id => removeItem('variable', id)}
          onUpdate={(id, f, v) => updateItem('variable', id, f, v)}
          addLabel="Add expense"
        />
      ) : (
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
      )}

      {!isProject && includeSavings && (
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

// ── Step 4: Cards ────────────────────────────────────────────────────
function StepCards({ cards, setCards, onNext }) {
  const [formOpen, setFormOpen] = useState(true)
  const [name, setName]               = useState('')
  const [limit, setLimit]             = useState('')
  const [cycleDay, setCycleDay]       = useState(1)
  const [color, setColor]             = useState(CARD_COLORS[0].hex)
  const [error, setError]             = useState(null)

  function addCard() {
    if (!name.trim()) { setError('Card name is required'); return }
    setCards(prev => [...prev, {
      id: createId(),
      name: name.trim(),
      limit: parseFloat(limit) || 0,
      cycleStartDay: Math.min(28, Math.max(1, parseInt(cycleDay) || 1)),
      color,
    }])
    setName(''); setLimit(''); setCycleDay(1); setColor(CARD_COLORS[0].hex)
    setError(null)
    setFormOpen(false)
  }

  function removeCard(id) {
    setCards(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="step-content">
      <div className="step-intro">
        <h2 className="step-heading">Add your cards</h2>
        <p className="step-sub">Set up the credit cards you want to track. You can add more later.</p>
      </div>

      {cards.length > 0 && (
        <div className="step-cards-list">
          {cards.map(card => (
            <div key={card.id} className="step-card-row">
              <div className="step-card-row__dot" style={{ background: card.color }} />
              <div className="step-card-row__info">
                <span className="step-card-row__name">{card.name}</span>
                <span className="step-card-row__meta">
                  {card.limit > 0 ? `$${card.limit.toLocaleString()} · ` : ''}
                  Cycle day {card.cycleStartDay} · Due in {card.dueDays}d
                </span>
              </div>
              <button className="step-card-row__del" onClick={() => removeCard(card.id)} aria-label="Remove card">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {!formOpen ? (
        <button className="add-item-btn" onClick={() => setFormOpen(true)} style={{ '--accent': '#6366F1' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add another card
        </button>
      ) : (
        <div className="step-card-form">
          <div className="field">
            <label className="field-label">Card name</label>
            <input
              className={`field-input${error ? ' field-input--error' : ''}`}
              placeholder="e.g. Visa Gold"
              value={name}
              onChange={e => { setName(e.target.value); setError(null) }}
              autoFocus
            />
            {error && <p className="field-error">{error}</p>}
          </div>

          <div className="field">
            <label className="field-label">Credit limit (optional)</label>
            <div className="catdetail__amount-wrap" style={{ width: '100%' }}>
              <span className="catdetail__currency">$</span>
              <input
                className="catdetail__input catdetail__input--amount"
                type="text" inputMode="decimal"
                placeholder="5,000"
                value={limit}
                onChange={e => setLimit(e.target.value.replace(/[^0-9.]/g, ''))}
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Billing cycle start day</label>
            <input className="field-input" type="number" min="1" max="28" value={cycleDay} onChange={e => setCycleDay(e.target.value)} />
          </div>

          <div className="field">
            <label className="field-label">Color</label>
            <div className="card-color-picker">
              {CARD_COLORS.map(c => (
                <button
                  key={c.id}
                  className={`card-color-swatch${color === c.hex ? ' card-color-swatch--active' : ''}`}
                  style={{ background: c.hex }}
                  onClick={() => setColor(c.hex)}
                  aria-label={c.id}
                />
              ))}
            </div>
          </div>

          <div className="step-card-form__actions">
            {cards.length > 0 && (
              <button className="confirm-sheet__cancel" onClick={() => setFormOpen(false)}>Cancel</button>
            )}
            <button
              className="confirm-sheet__delete"
              style={{ background: color, flex: 1 }}
              onClick={addCard}
            >
              Add Card
            </button>
          </div>
        </div>
      )}

      <button className="btn-primary" style={{ marginTop: 8 }} onClick={onNext}>
        {cards.length === 0 ? 'Skip for now' : 'Continue'}
      </button>
    </div>
  )
}

// ── Icons ────────────────────────────────────────────────────────────
function DailyLifeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function ProjectIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

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

function RecurrenceIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
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

function CreditCardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}
