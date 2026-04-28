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

  function createBudget({ name, themeId, sections }) {
    const budget = {
      id: createId(),
      name,
      themeId,
      sections,
      createdAt: new Date().toISOString(),
    }
    setBudgets(prev => [budget, ...prev])
    return budget
  }

  function deleteBudget(id) {
    setBudgets(prev => prev.filter(b => b.id !== id))
  }

  function addTransaction(budgetId, { sectionKey, subcategoryName, amount, memo }) {
    const txn = {
      id: createId(),
      sectionKey,
      subcategoryName,
      amount,
      memo,
      date: new Date().toISOString(),
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

  return { budgets, createBudget, deleteBudget, addTransaction, addBudgetItem }
}
