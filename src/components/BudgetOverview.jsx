import { useState } from 'react'
import { getTheme } from '../themes'
import { CardsPanel } from './CardsList'

function sumItems(items = []) {
  return items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
}

function sumTransactions(transactions = [], sectionKey) {
  return transactions
    .filter(t => t.sectionKey === sectionKey)
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
}

function fmtMoney(n) {
  if (n === 0) return '0'
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ── Period helpers ────────────────────────────────────────────────────
export function getPeriodBounds(recurrence, offset, opts = {}) {
  const now = new Date()

  if (recurrence === 'weekly') {
    const daysToMonday = (now.getDay() + 6) % 7
    const start = new Date(now)
    start.setDate(now.getDate() - daysToMonday + offset * 7)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (recurrence === 'biweekly') {
    const daysToMonday = (now.getDay() + 6) % 7
    const thisMonday = new Date(now)
    thisMonday.setDate(now.getDate() - daysToMonday)
    thisMonday.setHours(0, 0, 0, 0)
    const ref = new Date(2024, 0, 1) // known Monday anchor
    const weeksSinceRef = Math.floor((thisMonday - ref) / (7 * 24 * 3600 * 1000))
    const periodStartWeeks = Math.floor(weeksSinceRef / 2) * 2 + offset * 2
    const start = new Date(ref)
    start.setDate(ref.getDate() + periodStartWeeks * 7)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 13)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (recurrence === 'monthly') {
    const raw = now.getMonth() + offset
    const year = now.getFullYear() + Math.floor(raw / 12)
    const month = ((raw % 12) + 12) % 12
    const start = new Date(year, month, 1, 0, 0, 0, 0)
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999)
    return { start, end }
  }

  if (recurrence === 'quarterly') {
    const rawQ = Math.floor(now.getMonth() / 3) + offset
    const year = now.getFullYear() + Math.floor(rawQ / 4)
    const q = ((rawQ % 4) + 4) % 4
    const start = new Date(year, q * 3, 1, 0, 0, 0, 0)
    const end = new Date(year, q * 3 + 3, 0, 23, 59, 59, 999)
    return { start, end }
  }

  if (recurrence === 'yearly') {
    const year = now.getFullYear() + offset
    const start = new Date(year, 0, 1, 0, 0, 0, 0)
    const end = new Date(year, 11, 31, 23, 59, 59, 999)
    return { start, end }
  }

  if (recurrence === 'custom') {
    const days = opts.customDays || 30
    const anchor = opts.createdAt ? new Date(opts.createdAt) : new Date(2024, 0, 1)
    anchor.setHours(0, 0, 0, 0)
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const elapsed = Math.floor((today - anchor) / (24 * 3600 * 1000))
    const currentPeriod = Math.floor(elapsed / days)
    const targetPeriod = currentPeriod + offset
    const start = new Date(anchor)
    start.setDate(anchor.getDate() + targetPeriod * days)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + days - 1)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  return null
}

export function getPeriodLabel(recurrence, offset, opts = {}) {
  const bounds = getPeriodBounds(recurrence, offset, opts)
  if (!bounds) return ''
  const { start, end } = bounds
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  switch (recurrence) {
    case 'weekly':
    case 'biweekly':
    case 'custom':
      return `${fmt(start)} – ${fmt(end)}`
    case 'monthly':
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    case 'quarterly':
      return `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`
    case 'yearly':
      return `${start.getFullYear()}`
    default:
      return ''
  }
}

// ── Component ────────────────────────────────────────────────────────
export function BudgetOverview({ budget, periodOffset, onPeriodChange, onBack, onOpenCategory, onAddTransaction, onOpenDetail, onOpenCalendar, onOpenCardDetail, onAddCard, onUpdateCard, onDeleteCard }) {
  const [expensesOpen, setExpensesOpen] = useState(false)

  const sections     = budget.sections || {}
  const allTxns      = budget.transactions || []
  const isProject    = budget.type === 'project'
  const isRecurrent  = budget.recurrent && budget.recurrence && !isProject

  const periodOpts = { customDays: budget.recurrenceDays, createdAt: budget.recurrenceStart || budget.createdAt }

  const transactions = isRecurrent
    ? (() => {
        const { start, end } = getPeriodBounds(budget.recurrence, periodOffset, periodOpts)
        return allTxns.filter(t => { const d = new Date(t.date); return d >= start && d <= end })
      })()
    : allTxns

  const incomeTotal    = sumItems(sections.income?.items)
  const billsTotal     = sumItems(sections.bills?.items)
  const variableTotal  = sumItems(sections.variable?.items)
  const savingsTotal   = sumItems(sections.savings?.items)
  const expensesTotal  = billsTotal + variableTotal

  const incomeActual   = sumTransactions(transactions, 'income')
  const billsActual    = sumTransactions(transactions, 'bills')
  const variableActual = sumTransactions(transactions, 'variable')
  const savingsActual  = sumTransactions(transactions, 'savings')
  const expensesActual = billsActual + variableActual

  const secColors = {
    income: sections.income?.color ?? '#10B981',
    bills: sections.bills?.color ?? '#EF4444',
    variable: sections.variable?.color ?? '#F97316',
    savings: sections.savings?.color ?? '#8B5CF6',
  }

  const hasIncome  = sections.income?.enabled
  const hasSavings = sections.savings?.enabled

  return (
    <div className="screen overview-screen">
      <header className="overview-header">
        <button className="ov-back-btn" onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="overview-title-group">
          <h1 className="overview-title">{budget.name}</h1>
          <span className={`overview-type-badge overview-type-badge--${isProject ? 'project' : 'daily'}`}>
            {isProject ? 'Project' : 'Daily Life'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="ov-back-btn" onClick={onOpenCalendar} aria-label="Calendar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
<button className="ov-back-btn" onClick={onOpenDetail} aria-label="Budget details">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {isRecurrent && (
        <div className="period-nav">
          <button
            className="period-nav__arrow"
            onClick={() => onPeriodChange(o => o - 1)}
            aria-label="Previous period"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="period-nav__label">{getPeriodLabel(budget.recurrence, periodOffset, periodOpts)}</span>
          <button
            className="period-nav__arrow"
            onClick={() => onPeriodChange(o => o + 1)}
            aria-label="Next period"
            disabled={periodOffset >= 0}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      <button className="ov-fab" onClick={onAddTransaction} aria-label="Add transaction">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <div className="overview-panels">
        {hasIncome && (
          <CategoryPanel
            label="Income"
            color={secColors.income}
            dashColor={`${secColors.income}80`}
            actual={incomeActual}
            total={incomeTotal}
            onTap={() => onOpenCategory('income', 'Income')}
          />
        )}

        {isProject ? (
          <CategoryPanel
            label="Expenses"
            color={secColors.variable}
            dashColor={`${secColors.variable}80`}
            actual={variableActual}
            total={variableTotal}
            showAlert
            onTap={() => onOpenCategory('variable', 'Expenses')}
          />
        ) : (
          <CategoryPanel
            label="Expenses"
            color={budget.sections?.expenses?.color || "#F43F5E"}
            showAlert
            dashColor={budget.sections?.expenses?.color ? `${budget.sections.expenses.color}80` : "rgba(244,63,94,.5)"}
            actual={expensesActual}
            total={expensesTotal}
            expandable
            expanded={expensesOpen}
            onTap={() => setExpensesOpen(o => !o)}
            onColorChange={(color) => {
              if (onUpdateBudget) {
                onUpdateBudget({
                  sections: {
                    ...(budget.sections || {}),
                    expenses: { ...(budget.sections?.expenses || {}), color }
                  }
                })
              }
            }}
          >
            <SubCard
              label="Bills"
              sublabel="Fixed expenses"
              color={secColors.bills}
              actual={billsActual}
              total={billsTotal}
              onTap={() => onOpenCategory('bills', 'Bills')}
            />
            <SubCard
              label="Variable Expenses"
              sublabel="Day-to-day"
              color={secColors.variable}
              actual={variableActual}
              total={variableTotal}
              onTap={() => onOpenCategory('variable', 'Variable Expenses')}
            />
          </CategoryPanel>
        )}

        {hasSavings && (
          <CategoryPanel
            label="Savings"
            color={secColors.savings}
            dashColor={`${secColors.savings}80`}
            actual={savingsActual}
            total={savingsTotal}
            onTap={() => onOpenCategory('savings', 'Savings')}
          />
        )}

        {!isProject && (budget.trackCards ?? false) && (
          <CardsPanel
            budget={budget}
            onOpenCard={onOpenCardDetail}
            onAddCard={onAddCard}
            onUpdateCard={onUpdateCard}
            onDeleteCard={onDeleteCard}
          />
        )}
      </div>
    </div>
  )
}

function CategoryPanel({ label, color, dashColor, actual, total, onTap, expandable, expanded, onColorChange, showAlert, children }) {
  const pctDisplay = total > 0 ? Math.round((actual / total) * 100) : 0
  const pctFill = Math.min(100, pctDisplay)
  const fillBg = showAlert && pctDisplay >= 100 ? 'rgba(239,68,68,.85)'
    : showAlert && pctDisplay >= 80 ? 'rgba(245,158,11,.85)'
    : undefined

  return (
    <div
      className={`cat-panel${expanded ? ' cat-panel--expanded' : ''}`}
      style={{ '--color': color, '--dash': dashColor }}
    >
      <div className="cat-panel__card" onClick={onTap} aria-expanded={expandable ? expanded : undefined} role="button" tabIndex={0}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <span className="cat-panel__label">{label}</span>
          {onColorChange && (
            <label onClick={e => e.stopPropagation()} style={{ cursor: 'pointer', display: 'flex', color: 'rgba(255,255,255,0.75)' }} aria-label="Edit Color">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <input 
                type="color" 
                value={color}
                onChange={e => onColorChange(e.target.value)}
                style={{ opacity: 0, position: 'absolute', width: 0, height: 0, padding: 0, border: 0 }}
              />
            </label>
          )}
        </div>
        <span className="cat-panel__amount">${fmtMoney(actual)}</span>
        {total > 0 && (
          <div className="cat-panel__track">
            <div className="cat-panel__fill" style={{ width: pctFill > 0 ? `${pctFill}%` : '3px', ...(fillBg && { background: fillBg }) }} />
          </div>
        )}
        <div className="cat-panel__bottom">
          {total > 0 && <span className="cat-panel__pct">{pctDisplay}%</span>}
          {expandable && (
            <svg
              className={`cat-panel__chevron${expanded ? ' cat-panel__chevron--open' : ''}`}
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </div>
      </div>

      {expandable && expanded && (
        <div className="cat-panel__sub">
          {children}
        </div>
      )}
    </div>
  )
}

function SubCard({ label, sublabel, color, actual, total, onTap }) {
  const pctDisplay = total > 0 ? Math.round((actual / total) * 100) : 0
  const pctFill = Math.min(100, pctDisplay)
  const fillBg = pctDisplay >= 100 ? 'rgba(239,68,68,.85)'
    : pctDisplay >= 80 ? 'rgba(245,158,11,.85)'
    : undefined

  return (
    <button
      className="sub-card"
      onClick={e => { e.stopPropagation(); onTap() }}
      style={{ '--color': color }}
    >
      <div className="sub-card__top">
        <span className="sub-card__label">{label}</span>
        <span className="sub-card__sublabel">{sublabel}</span>
      </div>
      <span className="sub-card__amount">${fmtMoney(actual)}</span>
      {total > 0 && (
        <div className="sub-card__track">
          <div className="sub-card__fill" style={{ width: pctFill > 0 ? `${pctFill}%` : '3px', ...(fillBg && { background: fillBg }) }} />
        </div>
      )}
      {total > 0 && <span className="sub-card__pct">{pctDisplay}%</span>}
    </button>
  )
}
