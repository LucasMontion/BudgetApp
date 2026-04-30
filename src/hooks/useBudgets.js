import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'budgets_v1'
const BUDGET_LIMIT = 5

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function localLoad() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch { return [] }
}

async function cloudLoad(userId) {
  const { data } = await supabase
    .from('user_budgets')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.data ?? []
}

function cloudSave(userId, budgets) {
  supabase
    .from('user_budgets')
    .upsert({ user_id: userId, data: budgets, updated_at: new Date().toISOString() })
    .then()
}

export function useBudgets(user) {
  const [budgets, setBudgets] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [ready, setReady] = useState(false)
  const [importConflict, setImportConflict] = useState(null)

  useEffect(() => {
    setReady(false)
    setImportConflict(null)

    if (!user) {
      setBudgets(localLoad())
      setReady(true)
      return
    }

    let cancelled = false
    setSyncing(true)

    cloudLoad(user.id)
      .then(cloudBudgets => {
        if (cancelled) return
        const localBudgets = localLoad()

        if (localBudgets.length > 0 && cloudBudgets.length > 0) {
          // Both exist — let user choose
          setImportConflict({ localBudgets, cloudBudgets })
          setBudgets(cloudBudgets)
        } else if (localBudgets.length > 0) {
          // Auto-import guest data into new cloud account
          setBudgets(localBudgets)
          localStorage.removeItem(STORAGE_KEY)
        } else {
          setBudgets(cloudBudgets)
        }
      })
      .catch(() => {
        if (cancelled) return
        // Supabase unreachable — fall back to local cache
        setBudgets(localLoad())
      })
      .finally(() => {
        if (cancelled) return
        setSyncing(false)
        setReady(true)
      })

    return () => { cancelled = true }
  }, [user?.id])

  // Persist whenever budgets change (gated on ready so initial load doesn't double-write)
  useEffect(() => {
    if (!ready) return
    if (user) {
      cloudSave(user.id, budgets)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(budgets))
    }
  }, [budgets, ready, user?.id])

  function resolveImport(useLocal) {
    if (!importConflict) return
    setBudgets(useLocal ? importConflict.localBudgets : importConflict.cloudBudgets)
    localStorage.removeItem(STORAGE_KEY)
    setImportConflict(null)
  }

  function createBudget({ type, name, themeId, sections, recurrent, recurrence, recurrenceDays, recurrenceStart, trackCards, cards }) {
    if (budgets.length >= BUDGET_LIMIT) return null
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
      trackCards: trackCards ?? false,
      cards: cards ?? [],
      createdAt: new Date().toISOString(),
    }
    setBudgets(prev => [budget, ...prev])
    return budget
  }

  function deleteBudget(id) {
    setBudgets(prev => prev.filter(b => b.id !== id))
  }

  function updateBudget(id, updates) {
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
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

  function addTransaction(budgetId, { sectionKey, subcategoryName, amount, memo, date, cardId }) {
    const txn = {
      id: createId(),
      sectionKey,
      subcategoryName,
      amount,
      memo,
      date: date || new Date().toISOString(),
      cardId: cardId || null,
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

  function updateBudgetItem(budgetId, sectionKey, itemId, { name, amount }) {
    setBudgets(prev => prev.map(b => {
      if (b.id !== budgetId) return b
      const section = b.sections?.[sectionKey] ?? { enabled: true, items: [] }
      const oldItem = section.items.find(i => i.id === itemId)
      const oldName = oldItem?.name
      const newName = name ?? oldName
      return {
        ...b,
        sections: {
          ...b.sections,
          [sectionKey]: {
            ...section,
            items: section.items.map(i =>
              i.id === itemId ? { ...i, name: newName, amount: amount ?? i.amount } : i
            ),
          },
        },
        transactions: (b.transactions || []).map(t =>
          t.sectionKey === sectionKey && t.subcategoryName === oldName
            ? { ...t, subcategoryName: newName }
            : t
        ),
      }
    }))
  }

  function addCard(budgetId, { name, limit, cycleStartDay, cycleDays, color }) {
    const card = { id: createId(), name, limit: parseFloat(limit) || 0, cycleStartDay: parseInt(cycleStartDay), cycleDays: cycleDays || null, color }
    setBudgets(prev => prev.map(b =>
      b.id !== budgetId ? b : { ...b, cards: [...(b.cards || []), card] }
    ))
  }

  function updateCard(budgetId, cardId, updates) {
    setBudgets(prev => prev.map(b =>
      b.id !== budgetId ? b : {
        ...b,
        cards: (b.cards || []).map(c => c.id === cardId ? { ...c, ...updates } : c),
      }
    ))
  }

  function deleteCard(budgetId, cardId) {
    setBudgets(prev => prev.map(b =>
      b.id !== budgetId ? b : {
        ...b,
        cards: (b.cards || []).filter(c => c.id !== cardId),
        cardPayments: (b.cardPayments || []).filter(p => p.cardId !== cardId),
      }
    ))
  }

  function addCardPayment(budgetId, { cardId, amount, date, memo }) {
    const payment = { id: createId(), cardId, amount: parseFloat(amount), date: date || new Date().toISOString(), memo: memo || '' }
    setBudgets(prev => prev.map(b =>
      b.id !== budgetId ? b : { ...b, cardPayments: [...(b.cardPayments || []), payment] }
    ))
  }

  function deleteCardPayment(budgetId, paymentId) {
    setBudgets(prev => prev.map(b =>
      b.id !== budgetId ? b : {
        ...b,
        cardPayments: (b.cardPayments || []).filter(p => p.id !== paymentId),
      }
    ))
  }

  function deleteBudgetItem(budgetId, sectionKey, itemId) {
    setBudgets(prev => prev.map(b => {
      if (b.id !== budgetId) return b
      const section = b.sections?.[sectionKey] ?? { enabled: true, items: [] }
      return {
        ...b,
        sections: {
          ...b.sections,
          [sectionKey]: {
            ...section,
            items: section.items.filter(i => i.id !== itemId),
          },
        },
      }
    }))
  }

  return {
    budgets,
    syncing,
    importConflict,
    resolveImport,
    createBudget,
    deleteBudget,
    updateBudget,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addBudgetItem,
    updateBudgetItem,
    deleteBudgetItem,
    addCard,
    updateCard,
    deleteCard,
    addCardPayment,
    deleteCardPayment,
  }
}
