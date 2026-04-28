import { useState } from 'react'
import { getTheme } from '../themes'

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
function getPeriodBounds(recurrence, offset, opts = {}) {
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

function getPeriodLabel(recurrence, offset, opts = {}) {
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
export function BudgetOverview({ budget, onBack, onOpenCategory, onAddTransaction, onOpenDetail }) {
  const [expensesOpen, setExpensesOpen] = useState(false)
  const [periodOffset, setPeriodOffset] = useState(0)

  const sections     = budget.sections || {}
  const allTxns      = budget.transactions || []
  const isProject    = budget.type === 'project'
  const isRecurrent  = budget.recurrent && budget.recurrence && !isProject

  // Filter transactions to the selected period when recurrent
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
        <button className="ov-back-btn" onClick={onOpenDetail} aria-label="Budget details">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
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

      <button className="ov-fab" onClick={onAddTransaction} aria-label="Add transaction">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <div className="overview-panels">
        {hasIncome && (
          <CategoryPanel
            label="Income"
            color="#10B981"
            dashColor="rgba(16,185,129,.5)"
            actual={incomeActual}
            total={incomeTotal}
            onTap={() => onOpenCategory('income', 'Income')}
          />
        )}

        {isProject ? (
          <CategoryPanel
            label="Expenses"
            color="#F97316"
            dashColor="rgba(249,115,22,.5)"
            actual={variableActual}
            total={variableTotal}
            onTap={() => onOpenCategory('variable', 'Expenses')}
          />
        ) : (
          <CategoryPanel
            label="Expenses"
            color="#F43F5E"
            dashColor="rgba(244,63,94,.5)"
            actual={expensesActual}
            total={expensesTotal}
            expandable
            expanded={expensesOpen}
            onTap={() => setExpensesOpen(o => !o)}
          >
            <SubCard
              label="Bills"
              sublabel="Fixed expenses"
              color="#EF4444"
              actual={billsActual}
              total={billsTotal}
              onTap={() => onOpenCategory('bills', 'Bills')}
            />
            <SubCard
              label="Variable Expenses"
              sublabel="Day-to-day"
              color="#F97316"
              actual={variableActual}
              total={variableTotal}
              onTap={() => onOpenCategory('variable', 'Variable Expenses')}
            />
          </CategoryPanel>
        )}

        {hasSavings && (
          <CategoryPanel
            label="Savings"
            color="#8B5CF6"
            dashColor="rgba(139,92,246,.5)"
            actual={savingsActual}
            total={savingsTotal}
            onTap={() => onOpenCategory('savings', 'Savings')}
          />
        )}
      </div>
    </div>
  )
}

function CategoryPanel({ label, color, dashColor, actual, total, onTap, expandable, expanded, children }) {
  const pctDisplay = total > 0 ? Math.round((actual / total) * 100) : 0
  const pctFill = Math.min(100, pctDisplay)

  return (
    <div
      className={`cat-panel${expanded ? ' cat-panel--expanded' : ''}`}
      style={{ '--color': color, '--dash': dashColor }}
    >
      <button className="cat-panel__card" onClick={onTap} aria-expanded={expandable ? expanded : undefined}>
        <span className="cat-panel__label">{label}</span>
        <span className="cat-panel__amount">${fmtMoney(actual)}</span>
        <div className="cat-panel__track">
          <div className="cat-panel__fill" style={{ width: pctFill > 0 ? `${pctFill}%` : '3px' }} />
        </div>
        <div className="cat-panel__bottom">
          <span className="cat-panel__pct">{pctDisplay}%</span>
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
      </button>

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
      <div className="sub-card__track">
        <div className="sub-card__fill" style={{ width: pctFill > 0 ? `${pctFill}%` : '3px' }} />
      </div>
      <span className="sub-card__pct">{pctDisplay}%</span>
    </button>
  )
}
