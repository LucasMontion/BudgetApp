import { useState } from 'react'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getCardCloseDaysInMonth(card, year, month) {
  const daysInMo = new Date(year, month + 1, 0).getDate()

  if (!card.cycleDays) {
    const closeDay = card.cycleStartDay > 1 ? card.cycleStartDay - 1 : daysInMo
    return [Math.min(closeDay, daysInMo)]
  }

  const cycle = card.cycleDays
  const anchor = new Date(2020, 0, card.cycleStartDay, 0, 0, 0, 0)
  const monthStart = new Date(year, month, 1)
  const monthEnd   = new Date(year, month, daysInMo)

  let cur = new Date(anchor)
  while (cur >= monthStart) cur = new Date(cur.getTime() - cycle * 86400000)

  const days = []
  while (true) {
    const closeDate = new Date(cur.getTime() + (cycle - 1) * 86400000)
    if (closeDate > monthEnd) break
    if (closeDate >= monthStart) days.push(closeDate.getDate())
    cur = new Date(cur.getTime() + cycle * 86400000)
  }
  return days
}

function getDueDaysInMonth(item, year, month, createdAt) {
  const day = parseInt(item.dueDay)
  if (!day) return []
  const daysInMo = new Date(year, month + 1, 0).getDate()

  if (!item.dueCycleDays) {
    return [Math.min(day, daysInMo)]
  }

  const cycle = parseInt(item.dueCycleDays)
  const anchor = createdAt ? new Date(createdAt) : new Date()
  anchor.setHours(0, 0, 0, 0)
  let cur = new Date(anchor.getFullYear(), anchor.getMonth(), day)
  const monthStart = new Date(year, month, 1)
  const monthEnd   = new Date(year, month, daysInMo)

  while (cur > monthEnd)   cur = new Date(cur.getTime() - cycle * 86400000)
  while (cur < monthStart) cur = new Date(cur.getTime() + cycle * 86400000)

  const days = []
  while (cur <= monthEnd) {
    if (cur >= monthStart) days.push(cur.getDate())
    cur = new Date(cur.getTime() + cycle * 86400000)
  }
  return days
}

function fmtMoney(n) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function DayTransactionsSheet({ budget, day, month, year, transactions, bills, closingCards, filter, onClose }) {
  const dateStr = new Date(year, month, day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
  const getCol = (key, def) => budget.sections?.[key]?.color || def

  const showBills   = !filter || filter === 'bills'
  const showCards   = !filter || filter === 'cards'
  const showTxns    = !filter || filter === 'expense' || filter === 'income' || filter === 'savings'

  const filteredTxns = transactions.filter(txn => {
    if (!filter) return true
    if (filter === 'expense') return txn.sectionKey !== 'income' && txn.sectionKey !== 'savings'
    if (filter === 'income')  return txn.sectionKey === 'income'
    if (filter === 'savings') return txn.sectionKey === 'savings'
    return false
  })

  const hasContent = (showBills && bills.length > 0) || (showCards && closingCards?.length > 0) || (showTxns && filteredTxns.length > 0)

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="edit-txn-sheet" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="edit-txn-sheet__handle" />
        <div className="edit-txn-sheet__header">
          <p className="edit-txn-sheet__title">{dateStr}</p>
          <button className="edit-txn-sheet__close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          {showBills && bills.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>Bills Due</h3>
              <div className="txn-list" style={{ padding: 0 }}>
                {bills.map(b => (
                  <div key={b.id} className="txn-row">
                    <div className="txn-row__dot" style={{ background: getCol('bills', '#EF4444') }} />
                    <div className="txn-row__info">
                      <p className="txn-row__name">{b.name}</p>
                    </div>
                    <span className="txn-row__amount" style={{ color: getCol('bills', '#EF4444') }}>
                      ${parseFloat(b.amount || 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {showCards && closingCards?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>💳 Card Cycle Closes</h3>
              <div className="txn-list" style={{ padding: 0 }}>
                {closingCards.map(c => (
                  <div key={c.id} className="txn-row">
                    <div className="txn-row__dot" style={{ background: c.color }} />
                    <div className="txn-row__info">
                      <p className="txn-row__name">{c.name}</p>
                      {c.limit > 0 && (
                        <p className="txn-row__memo">Limit: ${c.limit.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {showTxns && filteredTxns.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>Transactions</h3>
              <div className="txn-list" style={{ padding: 0 }}>
                {filteredTxns.map(txn => {
                  let color = getCol(txn.sectionKey, '#F97316')
                  if (txn.sectionKey === 'income')  color = getCol('income', '#10B981')
                  if (txn.sectionKey === 'savings') color = getCol('savings', '#8B5CF6')
                  if (txn.sectionKey === 'bills')   color = getCol('bills', '#EF4444')
                  const card = (budget.cards || []).find(c => c.id === txn.cardId)
                  return (
                    <div key={txn.id} className="txn-row">
                      <div className="txn-row__dot" style={{ background: color }} />
                      <div className="txn-row__info">
                        <p className="txn-row__name">{txn.subcategoryName}</p>
                        {(txn.memo || card) && (
                          <p className="txn-row__memo">
                            {txn.memo}
                            {txn.memo && card ? ' • ' : ''}
                            {card ? `💳 ${card.name}` : ''}
                          </p>
                        )}
                      </div>
                      <span className="txn-row__amount" style={{ color }}>
                        ${parseFloat(txn.amount).toFixed(2)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {!hasContent && (
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: 20 }}>
              No {filter ? 'matching ' : ''}entries for this day.
            </p>
          )}
        </div>
      </div>
    </>
  )
}

export function BudgetCalendar({ budget, onBack }) {
  const today = new Date()
  const [year, setYear]     = useState(today.getFullYear())
  const [month, setMonth]   = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(null)
  const [filter, setFilter] = useState(null) // null | 'expense' | 'income' | 'savings' | 'bills' | 'cards'

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function toggleFilter(key) {
    setFilter(f => f === key ? null : key)
  }

  // Bill items with due days
  const billItems = (budget.sections?.bills?.items || []).filter(i => i.name?.trim() && i.dueDay)
  const billsByDay = {}
  for (const item of billItems) {
    for (const d of getDueDaysInMonth(item, year, month, budget.createdAt)) {
      billsByDay[d] = [...(billsByDay[d] || []), item]
    }
  }

  // Credit card cycle close days
  const cards = budget.trackCards ? (budget.cards || []) : []
  const cardsByCloseDay = {}
  for (const card of cards) {
    for (const d of getCardCloseDaysInMonth(card, year, month)) {
      cardsByCloseDay[d] = [...(cardsByCloseDay[d] || []), card]
    }
  }

  // Transaction totals by day
  const expenseByDay = {}
  const incomeByDay  = {}
  const savingsByDay = {}
  for (const txn of budget.transactions || []) {
    const d = new Date(txn.date)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      const amt = parseFloat(txn.amount) || 0
      if (txn.sectionKey === 'income')        incomeByDay[day]  = (incomeByDay[day]  || 0) + amt
      else if (txn.sectionKey === 'savings')  savingsByDay[day] = (savingsByDay[day] || 0) + amt
      else                                    expenseByDay[day] = (expenseByDay[day] || 0) + amt
    }
  }

  const firstDow    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

  const colExp = budget.sections?.variable?.color || '#F97316'
  const colInc = budget.sections?.income?.color   || '#10B981'
  const colSav = budget.sections?.savings?.color  || '#8B5CF6'
  const colBil = budget.sections?.bills?.color    || '#EF4444'

  // Which filter pills to show
  const filterPills = [
    { key: 'expense', label: 'Expenses', color: colExp },
    ...(budget.sections?.income?.enabled  ? [{ key: 'income',  label: 'Income',  color: colInc }] : []),
    ...(budget.sections?.savings?.enabled ? [{ key: 'savings', label: 'Savings', color: colSav }] : []),
    ...(budget.sections?.bills?.enabled   ? [{ key: 'bills',   label: 'Bills',   color: colBil }] : []),
    ...(cards.length > 0                  ? [{ key: 'cards',   label: '💳 Cards', color: null  }] : []),
  ]

  const show = {
    expense: !filter || filter === 'expense',
    income:  !filter || filter === 'income',
    savings: !filter || filter === 'savings',
    bills:   !filter || filter === 'bills',
    cards:   !filter || filter === 'cards',
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <button className="back-btn" onClick={onBack} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="screen-title">Calendar</h1>
        <div style={{ width: 40 }} />
      </header>

      {/* Month navigation */}
      <div className="cal-nav">
        <button className="cal-nav__arrow" onClick={prevMonth} aria-label="Previous month">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="cal-nav__label">{MONTHS[month]} {year}</span>
        <button className="cal-nav__arrow" onClick={nextMonth} aria-label="Next month">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Filter pills */}
      <div className="cal-filters">
        {filterPills.map(pill => {
          const active = filter === pill.key
          return (
            <button
              key={pill.key}
              className={`cal-filter-pill${active ? ' cal-filter-pill--active' : ''}`}
              style={active && pill.color ? { borderColor: pill.color, color: pill.color, background: `${pill.color}18` } : {}}
              onClick={() => toggleFilter(pill.key)}
            >
              {pill.color && (
                <span className="cal-filter-pill__dot" style={{ background: pill.color }} />
              )}
              {pill.label}
            </button>
          )
        })}
      </div>

      <div className="cal-body">
        {/* Weekday headers */}
        <div className="cal-weekdays">
          {WEEKDAYS.map(d => <span key={d} className="cal-weekday">{d}</span>)}
        </div>

        {/* Day grid */}
        <div className="cal-grid">
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} className="cal-day cal-day--empty" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day          = i + 1
            const bills        = billsByDay[day] || []
            const closingCards = cardsByCloseDay[day] || []
            const expense = expenseByDay[day] || 0
            const income  = incomeByDay[day]  || 0
            const savings = savingsByDay[day] || 0
            const isToday = isCurrentMonth && day === today.getDate()

            return (
              <div
                key={day}
                className={`cal-day${isToday ? ' cal-day--today' : ''}`}
                onClick={() => setSelectedDay(day)}
                style={{ cursor: 'pointer' }}
              >
                <span className="cal-day__num">{day}</span>
                {show.expense && expense > 0 && (
                  <span className="cal-day__spend" style={{ color: colExp }}>{fmtMoney(expense)}</span>
                )}
                {show.income && income > 0 && (
                  <span className="cal-day__spend" style={{ color: colInc }}>{fmtMoney(income)}</span>
                )}
                {show.savings && savings > 0 && (
                  <span className="cal-day__spend" style={{ color: colSav }}>{fmtMoney(savings)}</span>
                )}
                {show.bills && bills.length > 0 && (
                  <div className="cal-day__bills">
                    {bills.map(b => {
                      const nameArr = Array.from(b.name || '')
                      const dispName = nameArr.length > 6 ? nameArr.slice(0, 5).join('') + '…' : b.name
                      return (
                        <span key={b.id} className="cal-day__bill-tag" style={{ color: colBil, background: `${colBil}22` }} title={b.name}>
                          {dispName}
                        </span>
                      )
                    })}
                  </div>
                )}
                {show.cards && closingCards.length > 0 && (
                  <div className="cal-day__bills">
                    {closingCards.map(c => {
                      const nameArr = Array.from(c.name || '')
                      const dispName = nameArr.length > 6 ? nameArr.slice(0, 5).join('') + '…' : c.name
                      return (
                        <span key={c.id} className="cal-day__bill-tag" style={{ color: c.color, background: `${c.color}22` }} title={`${c.name} cycle closes`}>
                          💳{dispName}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Today button */}
        {!isCurrentMonth && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0 0' }}>
            <button className="cal-legend__today-btn" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}>
              Today
            </button>
          </div>
        )}
      </div>

      {selectedDay && (
        <DayTransactionsSheet
          budget={budget}
          day={selectedDay}
          month={month}
          year={year}
          filter={filter}
          transactions={(budget.transactions || []).filter(txn => {
            const d = new Date(txn.date)
            return d.getFullYear() === year && d.getMonth() === month && d.getDate() === selectedDay
          })}
          bills={billsByDay[selectedDay] || []}
          closingCards={cardsByCloseDay[selectedDay] || []}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}
