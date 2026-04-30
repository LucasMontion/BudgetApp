import { useState } from 'react'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

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
  // Anchor occurrence: dueDay of the month the budget was created
  let cur = new Date(anchor.getFullYear(), anchor.getMonth(), day)
  const monthStart = new Date(year, month, 1)
  const monthEnd   = new Date(year, month, daysInMo)

  // Step forward/backward to get near the target month
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

function DayTransactionsSheet({ budget, day, month, year, transactions, bills, onClose }) {
  const dateStr = new Date(year, month, day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
  
  const getCol = (key, def) => budget.sections?.[key]?.color || def

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
          {bills.length > 0 && (
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
          
          {transactions.length > 0 ? (
            <div>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>Transactions</h3>
              <div className="txn-list" style={{ padding: 0 }}>
                {transactions.map(txn => {
                  let color = getCol(txn.sectionKey, '#F97316')
                  if (txn.sectionKey === 'income') color = getCol('income', '#10B981')
                  if (txn.sectionKey === 'savings') color = getCol('savings', '#8B5CF6')
                  if (txn.sectionKey === 'bills') color = getCol('bills', '#EF4444')
                  
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
          ) : (
            bills.length === 0 && <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: 20 }}>No transactions or bills for this day.</p>
          )}
        </div>
      </div>
    </>
  )
}

export function BudgetCalendar({ budget, onBack }) {
  const today = new Date()
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(null)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  // Bill items with due days (bills section only)
  const billItems = (budget.sections?.bills?.items || []).filter(i => i.name?.trim() && i.dueDay)

  // Map: day → [billItem, ...]
  const billsByDay = {}
  for (const item of billItems) {
    for (const d of getDueDaysInMonth(item, year, month, budget.createdAt)) {
      billsByDay[d] = [...(billsByDay[d] || []), item]
    }
  }

  // Maps: day → totals by type
  const expenseByDay = {}
  const incomeByDay  = {}
  const savingsByDay = {}
  for (const txn of budget.transactions || []) {
    const d = new Date(txn.date)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      const amt = parseFloat(txn.amount) || 0
      if (txn.sectionKey === 'income') {
        incomeByDay[day] = (incomeByDay[day] || 0) + amt
      } else if (txn.sectionKey === 'savings') {
        savingsByDay[day] = (savingsByDay[day] || 0) + amt
      } else {
        expenseByDay[day] = (expenseByDay[day] || 0) + amt
      }
    }
  }

  const firstDow   = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()

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
            const day     = i + 1
            const bills   = billsByDay[day] || []
            const expense  = expenseByDay[day] || 0
            const income   = incomeByDay[day]  || 0
            const savings  = savingsByDay[day] || 0
            const isToday  = isCurrentMonth && day === today.getDate()

            const colExp = budget.sections?.variable?.color || '#F97316'
            const colInc = budget.sections?.income?.color || '#10B981'
            const colSav = budget.sections?.savings?.color || '#8B5CF6'
            const colBil = budget.sections?.bills?.color || '#EF4444'

            return (
              <div 
                key={day} 
                className={`cal-day${isToday ? ' cal-day--today' : ''}`} 
                onClick={() => setSelectedDay(day)}
                style={{ cursor: 'pointer' }}
              >
                <span className="cal-day__num">{day}</span>
                {expense > 0 && (
                  <span className="cal-day__spend" style={{ color: colExp }}>{fmtMoney(expense)}</span>
                )}
                {income > 0 && (
                  <span className="cal-day__spend" style={{ color: colInc }}>{fmtMoney(income)}</span>
                )}
                {savings > 0 && (
                  <span className="cal-day__spend" style={{ color: colSav }}>{fmtMoney(savings)}</span>
                )}
                {bills.length > 0 && (
                  <div className="cal-day__bills">
                    {bills.map(b => {
                      const nameArr = Array.from(b.name || '');
                      const dispName = nameArr.length > 6 ? nameArr.slice(0, 5).join('') + '…' : b.name;
                      return (
                        <span key={b.id} className="cal-day__bill-tag" style={{ color: colBil, background: `${colBil}22` }} title={b.name}>
                          {dispName}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="cal-legend" style={{ flexWrap: 'wrap' }}>
          <div className="cal-legend__item">
            <span className="cal-legend__dot" style={{ background: budget.sections?.variable?.color || '#F97316' }} />
            <span>Expenses</span>
          </div>
          <div className="cal-legend__item">
            <span className="cal-legend__dot" style={{ background: budget.sections?.income?.color || '#10B981' }} />
            <span>Income</span>
          </div>
          <div className="cal-legend__item">
            <span className="cal-legend__dot" style={{ background: budget.sections?.savings?.color || '#8B5CF6' }} />
            <span>Savings</span>
          </div>
          <div className="cal-legend__item">
            <span className="cal-legend__dot" style={{ background: budget.sections?.bills?.color || '#EF4444' }} />
            <span>Bill due</span>
          </div>
          {!isCurrentMonth && (
            <button className="cal-legend__today-btn" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()) }}>
              Today
            </button>
          )}
        </div>
      </div>

      {selectedDay && (
        <DayTransactionsSheet
          budget={budget}
          day={selectedDay}
          month={month}
          year={year}
          transactions={(budget.transactions || []).filter(txn => {
            const d = new Date(txn.date)
            return d.getFullYear() === year && d.getMonth() === month && d.getDate() === selectedDay
          })}
          bills={billsByDay[selectedDay] || []}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}
