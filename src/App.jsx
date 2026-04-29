import { useState, useEffect } from 'react'
import { Dashboard } from './components/Dashboard'
import { CreateBudget } from './components/CreateBudget'
import { BudgetOverview } from './components/BudgetOverview'
import { CategoryDetail } from './components/CategoryDetail'
import { AddTransaction } from './components/AddTransaction'
import { TransactionList } from './components/TransactionList'
import { BudgetDetail } from './components/BudgetDetail'
import { AuthScreen } from './components/AuthScreen'
import { useBudgets } from './hooks/useBudgets'
import { useAuth } from './contexts/AuthContext'
import './App.css'

export default function App() {
  const { user, authReady, signOut } = useAuth()

  const [screen, setScreen]                           = useState('dashboard')
  const [activeBudgetId, setActiveBudgetId]           = useState(null)
  const [activeSection, setActiveSection]             = useState(null)
  const [addTxnOpen, setAddTxnOpen]                   = useState(false)
  const [addTxnSection, setAddTxnSection]             = useState(null)
  const [addTxnSubcategory, setAddTxnSubcategory]     = useState(null)
  const [activeSubcategory, setActiveSubcategory]     = useState(null)
  const [darkMode, setDarkMode]                       = useState(() => localStorage.getItem('theme') === 'dark')
  const [accountSheetOpen, setAccountSheetOpen]       = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) metaTheme.setAttribute('content', darkMode ? '#0F1117' : '#F8F9FB')
  }, [darkMode])

  // Return to dashboard when login completes
  useEffect(() => {
    if (user && screen === 'auth') setScreen('dashboard')
  }, [user])

  const {
    budgets, syncing, importConflict, resolveImport,
    createBudget, deleteBudget, addTransaction, updateTransaction,
    deleteTransaction, addBudgetItem, updateBudgetItem, deleteBudgetItem,
  } = useBudgets(user)

  const activeBudget = budgets.find(b => b.id === activeBudgetId) ?? null

  function handleCreate(budgetData) {
    if (createBudget(budgetData) === null) return
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

  function handleAccountPress() {
    if (user) {
      setAccountSheetOpen(true)
    } else {
      setScreen('auth')
    }
  }

  async function handleSignOut() {
    setAccountSheetOpen(false)
    await signOut()
  }

  if (!authReady) return null

  return (
    <div className="app">
      {screen === 'auth' && (
        <AuthScreen onContinueAsGuest={() => setScreen('dashboard')} />
      )}

      {screen === 'dashboard' && (
        <Dashboard
          budgets={budgets}
          onCreateNew={() => setScreen('create')}
          onDeleteBudget={deleteBudget}
          onOpenBudget={handleOpenBudget}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(d => !d)}
          user={user}
          syncing={syncing}
          onAccountPress={handleAccountPress}
        />
      )}

      {screen === 'create' && (
        <CreateBudget
          onCreate={handleCreate}
          onCancel={() => setScreen('dashboard')}
          atLimit={budgets.length >= 5}
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

      {importConflict && (
        <ImportConflictModal conflict={importConflict} onResolve={resolveImport} />
      )}

      {accountSheetOpen && user && (
        <AccountSheet
          user={user}
          onClose={() => setAccountSheetOpen(false)}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  )
}

function ImportConflictModal({ conflict, onResolve }) {
  const localCount = conflict.localBudgets.length
  const cloudCount = conflict.cloudBudgets.length
  return (
    <div className="confirm-backdrop">
      <div className="confirm-sheet">
        <div className="confirm-sheet__icon" style={{ background: 'rgba(99,102,241,.12)', color: '#6366F1' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <h2 className="confirm-sheet__title">Import local data?</h2>
        <p className="confirm-sheet__body">
          You have <strong>{localCount} budget{localCount !== 1 ? 's' : ''}</strong> on this device
          and <strong>{cloudCount}</strong> in your cloud account. Which would you like to keep?
        </p>
        <div className="confirm-sheet__actions">
          <button className="confirm-sheet__cancel" onClick={() => onResolve(false)}>
            Keep cloud
          </button>
          <button
            className="confirm-sheet__delete"
            style={{ background: '#6366F1' }}
            onClick={() => onResolve(true)}
          >
            Use local
          </button>
        </div>
      </div>
    </div>
  )
}

function AccountSheet({ user, onClose, onSignOut }) {
  const initial = user.email[0].toUpperCase()
  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div className="confirm-sheet account-sheet" onClick={e => e.stopPropagation()}>
        <div className="account-sheet__user">
          <div className="account-avatar--lg">{initial}</div>
          <div className="account-sheet__info">
            <div className="account-email">{user.email}</div>
            <div className="account-badge">
              <span className="account-badge__dot" />
              Synced to cloud
            </div>
          </div>
        </div>
        <button className="account-sign-out-btn" onClick={onSignOut}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
        <button className="confirm-sheet__cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
