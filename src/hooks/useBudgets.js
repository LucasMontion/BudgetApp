import { useState, useEffect } from 'react'

const STORAGE_KEY = 'budgets_v1'

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function useBudgets() {
  const [budgets, setBudgets] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(budgets))
  }, [budgets])

  function createBudget({ type, name, themeId, sections, recurrent, recurrence, recurrenceDays, recurrenceStart }) {
    const budget = {
      id: createId(),
      type: type ?? 'daily',
      name,
      themeId,
      sections,
      recurrent: recurrent ?? false,
      recurrence: recurrence ?? null,
      recurrenceDays: recurrenceDays ?? null,
      recurrenceStart: recurrenceStart ?? null,
      createdAt: new Date().toISOString(),
    }
    setBudgets(prev => [budget, ...prev])
    return budget
  }

  function deleteBudget(id) {
    setBudgets(prev => prev.filter(b => b.id !== id))
  }

  function updateTransaction(budgetId, txnId, updates) {
    setBudgets(prev => prev.map(b =>
      b.id !== budgetId ? b : {
        ...b,
        transactions: (b.transactions || []).map(t =>
          t.id === txnId ? { ...t, ...updates } : t
        ),
      }
    ))
  }

  function deleteTransaction(budgetId, txnId) {
    setBudgets(prev => prev.map(b =>
      b.id !== budgetId ? b : {
        ...b,
        transactions: (b.transactions || []).filter(t => t.id !== txnId),
      }
    ))
  }

  function addTransaction(budgetId, { sectionKey, subcategoryName, amount, memo, date }) {
    const txn = {
      id: createId(),
      sectionKey,
      subcategoryName,
      amount,
      memo,
      date: date || new Date().toISOString(),
    }
    setBudgets(prev => prev.map(b =>
      b.id === budgetId
        ? { ...b, transactions: [...(b.transactions || []), txn] }
        : b
    ))
  }

  function addBudgetItem(budgetId, sectionKey, { name, amount }) {
    const newItem = { id: createId(), name, amount: amount || '' }
    setBudgets(prev => prev.map(b => {
      if (b.id !== budgetId) return b
      const section = b.sections?.[sectionKey] ?? { enabled: true, items: [] }
      return {
        ...b,
        sections: {
          ...b.sections,
          [sectionKey]: { ...section, items: [...(section.items || []), newItem] },
        },
      }
    }))
  }

  return { budgets, createBudget, deleteBudget, addTransaction, updateTransaction, deleteTransaction, addBudgetItem }
}
