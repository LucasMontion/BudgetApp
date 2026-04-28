const SECTION_COLORS = {
  income:   '#10B981',
  bills:    '#EF4444',
  variable: '#F97316',
  savings:  '#8B5CF6',
}

export function TransactionList({ budget, sectionKey, sectionLabel, subcategoryName, onBack, onAddTransaction }) {
  const transactions = (budget.transactions || [])
    .filter(t => t.sectionKey === sectionKey && (!subcategoryName || t.subcategoryName === subcategoryName))
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const title = subcategoryName ?? sectionLabel

  const color = SECTION_COLORS[sectionKey] ?? '#6366f1'

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

      <div className="txn-list">
        {transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h2 className="empty-state__title">No transactions yet</h2>
            <p className="empty-state__body">Tap + to record your first {title.toLowerCase()} entry.</p>
          </div>
        ) : (
          transactions.map(txn => (
            <div key={txn.id} className="txn-row">
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
            </div>
          ))
        )}
      </div>

      <button className="fab" style={{ background: color, boxShadow: `0 6px 24px ${color}66` }} onClick={onAddTransaction} aria-label="Add transaction">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  )
}
