import { useState } from 'react'
import { getTheme } from '../themes'

export function Dashboard({ budgets, onCreateNew, onDeleteBudget, onOpenBudget, darkMode, onToggleDark, user, syncing, onAccountPress }) {
  const [pendingDelete, setPendingDelete] = useState(null)
  const limit = user ? 5 : 3
  const atLimit = budgets.length >= limit

  function handleConfirmDelete() {
    onDeleteBudget(pendingDelete.id)
    setPendingDelete(null)
  }

  return (
    <div className="screen">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">My Budgets</h1>
          {atLimit && <p className="dashboard-limit-note">{limit} / {limit} — limit reached</p>}
        </div>
        <div className="dashboard-header__actions">
          {syncing && <span className="sync-dot" title="Syncing…" />}
          <button
            className="avatar theme-toggle"
            onClick={onToggleDark}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button
            className={`avatar account-btn${user ? ' account-btn--signed-in' : ''}`}
            onClick={onAccountPress}
            aria-label={user ? 'Account' : 'Sign in'}
          >
            {user ? (
              <span className="account-btn__initial">{user.email[0].toUpperCase()}</span>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <div className="dashboard-body">
        {budgets.length === 0 ? (
          syncing ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <p className="loading-state__label">Loading your budgets…</p>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state__icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>
              <h2 className="empty-state__title">No budgets yet</h2>
              <p className="empty-state__body">Create your first budget to start tracking your spending.</p>
            </div>
          )
        ) : (
          <div className="budget-list">
            {budgets.map(budget => {
              const theme = getTheme(budget.themeId)
              return (
                <BudgetCard
                  key={budget.id}
                  budget={budget}
                  theme={theme}
                  onOpen={() => onOpenBudget(budget)}
                  onRequestDelete={() => setPendingDelete(budget)}
                />
              )
            })}
          </div>
        )}
      </div>

      {!atLimit && (
        <button className="fab" onClick={onCreateNew} aria-label="Create new budget">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {pendingDelete && (
        <DeleteConfirmModal
          budget={pendingDelete}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}

function BudgetCard({ budget, theme, onOpen, onRequestDelete }) {
  const date = new Date(budget.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const isProject = budget.type === 'project'

  return (
    <div className="budget-card" style={{ background: theme.gradient }} onClick={onOpen} role="button" tabIndex={0}>
      <div className="budget-card__body">
        <div className="budget-card__title-row">
          <span className="budget-card__name">{budget.name}</span>
          <span className="budget-card__type-badge">{isProject ? 'Project' : 'Daily Life'}</span>
        </div>
        <span className="budget-card__date">Created {date}</span>
      </div>
      <button
        className="budget-card__delete"
        onClick={e => { e.stopPropagation(); onRequestDelete() }}
        aria-label={`Delete ${budget.name}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </button>
    </div>
  )
}

function DeleteConfirmModal({ budget, onCancel, onConfirm }) {
  return (
    <div className="confirm-backdrop" onClick={onCancel}>
      <div className="confirm-sheet" onClick={e => e.stopPropagation()}>
        <div className="confirm-sheet__icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
        </div>
        <h2 className="confirm-sheet__title">Delete budget?</h2>
        <p className="confirm-sheet__body">
          <strong>"{budget.name}"</strong> and all its transactions will be permanently removed.
        </p>
        <div className="confirm-sheet__actions">
          <button className="confirm-sheet__cancel" onClick={onCancel}>Cancel</button>
          <button className="confirm-sheet__delete" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  )
}
