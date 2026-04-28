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

export function BudgetOverview({ budget, onBack, onOpenCategory, onAddTransaction }) {
  const [expensesOpen, setExpensesOpen] = useState(false)
  const theme = getTheme(budget.themeId)
  const sections = budget.sections || {}
  const transactions = budget.transactions || []

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
  const isProject  = budget.type === 'project'

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
        <div style={{ width: 40 }} />
      </header>

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
