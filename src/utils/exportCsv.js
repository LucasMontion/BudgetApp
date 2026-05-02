const SECTION_LABELS = {
  income: 'Income',
  bills: 'Bills',
  variable: 'Variable',
  savings: 'Savings',
}

function escapeCell(value) {
  const str = value == null ? '' : String(value)
  return str.includes(',') || str.includes('"') || str.includes('\n')
    ? `"${str.replace(/"/g, '""')}"`
    : str
}

export function exportTransactionsCsv(transactions, budget, periodLabel = '') {
  const cards = budget.cards || []
  const cardMap = Object.fromEntries(cards.map(c => [c.id, c.name]))

  const headers = ['Date', 'Section', 'Category', 'Amount', 'Memo', 'Card']
  const rows = [...transactions]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(t => [
      t.date ? new Date(t.date).toLocaleDateString('en-US') : '',
      SECTION_LABELS[t.sectionKey] ?? t.sectionKey,
      t.subcategoryName ?? '',
      t.amount != null ? Number(t.amount).toFixed(2) : '',
      t.memo ?? '',
      t.cardId ? (cardMap[t.cardId] ?? t.cardId) : '',
    ])

  const csvContent = [headers, ...rows].map(r => r.map(escapeCell).join(',')).join('\n')

  const safeName = budget.name.replace(/[^a-z0-9]/gi, '_')
  const datePart = periodLabel
    ? periodLabel.replace(/[^a-z0-9]/gi, '_')
    : new Date().toISOString().slice(0, 10)
  const filename = `${safeName}_${datePart}.csv`

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
