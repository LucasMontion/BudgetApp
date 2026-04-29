import { useState, useEffect } from 'react'
import { Dashboard } from './components/Dashboard'
import { CreateBudget } from './components/CreateBudget'
import { BudgetOverview } from './components/BudgetOverview'
import { CategoryDetail } from './components/CategoryDetail'
import { AddTransaction } from './components/AddTransaction'
import { TransactionList } from './components/TransactionList'
import { BudgetDetail } from './components/BudgetDetail'
import { useBudgets } from './hooks/useBudgets'
import './App.css'

export default function App() {
  const [screen, setScreen]                 = useState('dashboard')
  const [activeBudgetId, setActiveBudgetId] = useState(null)
  const [activeSection, setActiveSection]   = useState(null) // { key, label }
  const [addTxnOpen, setAddTxnOpen]         = useState(false)
  const [addTxnSection, setAddTxnSection]   = useState(null)
  const [addTxnSubcategory, setAddTxnSubcategory] = useState(null)
  const [activeSubcategory, setActiveSubcategory] = useState(null)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) metaTheme.setAttribute('content', darkMode ? '#0F1117' : '#F8F9FB')
  }, [darkMode])

  const { budgets, createBudget, deleteBudget, addTransaction, updateTransaction, deleteTransaction, addBudgetItem, updateBudgetItem, deleteBudgetItem } = useBudgets()
  const activeBudget = budgets.find(b => b.id === activeBudgetId) ?? null

  function handleCreate(budgetData) {
    createBudget(budgetData)
    setScreen('dashboard')
  }

  function handleOpenBudget(budget) {
    setActiveBudgetId(budget.id)
    setScreen('overview')
  }

  function handleOpenCategory(key, label) {
    setActiveSection({ key, label })
    setScreen('category')
  }

  function handleOpenSubcategory(name) {
    setActiveSubcategory(name)
    setScreen('subcategory')
  }

  function openAddTxn(sectionKey = null, subcategory = null) {
    setAddTxnSection(sectionKey)
    setAddTxnSubcategory(subcategory)
    setAddTxnOpen(true)
  }

  function handleSaveTxn(txnData) {
    if (activeBudgetId) addTransaction(activeBudgetId, txnData)
    setAddTxnOpen(false)
  }

  function handleAddItem(sectionKey, item) {
    if (activeBudgetId) addBudgetItem(activeBudgetId, sectionKey, item)
  }

  return (
    <div className="app">
      {screen === 'dashboard' && (
        <Dashboard
          budgets={budgets}
          onCreateNew={() => setScreen('create')}
          onDeleteBudget={deleteBudget}
          onOpenBudget={handleOpenBudget}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(d => !d)}
        />
      )}

      {screen === 'create' && (
        <CreateBudget
          onCreate={handleCreate}
          onCancel={() => setScreen('dashboard')}
        />
      )}

      {screen === 'overview' && activeBudget && (
        <BudgetOverview
          budget={activeBudget}
          onBack={() => setScreen('dashboard')}
          onOpenCategory={handleOpenCategory}
          onAddTransaction={() => openAddTxn(null)}
          onOpenDetail={() => setScreen('detail')}
        />
      )}

      {screen === 'detail' && activeBudget && (
        <BudgetDetail
          budget={activeBudget}
          onBack={() => setScreen('overview')}
          onUpdateTransaction={(txnId, updates) => updateTransaction(activeBudgetId, txnId, updates)}
          onDeleteTransaction={(txnId) => deleteTransaction(activeBudgetId, txnId)}
        />
      )}

      {screen === 'category' && activeBudget && activeSection && (
        <CategoryDetail
          budget={activeBudget}
          sectionKey={activeSection.key}
          sectionLabel={activeSection.label}
          onBack={() => setScreen('overview')}
          onAddTransaction={() => openAddTxn(activeSection.key)}
          onAddItem={handleAddItem}
          onUpdateItem={(itemId, updates) => updateBudgetItem(activeBudgetId, activeSection.key, itemId, updates)}
          onDeleteItem={(itemId) => deleteBudgetItem(activeBudgetId, activeSection.key, itemId)}
          onOpenSubcategory={handleOpenSubcategory}
        />
      )}

      {screen === 'subcategory' && activeBudget && activeSection && activeSubcategory && (
        <TransactionList
          budget={activeBudget}
          sectionKey={activeSection.key}
          sectionLabel={activeSection.label}
          subcategoryName={activeSubcategory}
          onBack={() => setScreen('category')}
          onAddTransaction={() => openAddTxn(activeSection.key, activeSubcategory)}
          onUpdateTransaction={(txnId, updates) => updateTransaction(activeBudgetId, txnId, updates)}
          onDeleteTransaction={(txnId) => deleteTransaction(activeBudgetId, txnId)}
        />
      )}

      {addTxnOpen && activeBudget && (
        <AddTransaction
          budget={activeBudget}
          initialSectionKey={addTxnSection}
          initialSubcategory={addTxnSubcategory}
          onSave={handleSaveTxn}
          onCancel={() => setAddTxnOpen(false)}
        />
      )}
    </div>
  )
}
