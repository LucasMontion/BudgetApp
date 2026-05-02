import React from 'react'
import { pdf } from '@react-pdf/renderer'
import { BudgetPdfDocument } from './BudgetPdfReport'

export async function exportBudgetPdf(budget, periodTxns, periodLabel, periodOffset, periodOpts) {
  const blob = await pdf(
    React.createElement(BudgetPdfDocument, { budget, periodTxns, periodLabel, periodOffset, periodOpts })
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href    = url
  const safeName  = budget.name.replace(/[^a-z0-9]/gi, '_')
  const datePart  = periodLabel ? periodLabel.replace(/[^a-z0-9]/gi, '_') : new Date().toISOString().slice(0, 10)
  a.download = `${safeName}_${datePart}_report.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
