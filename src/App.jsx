import { useState, useEffect } from 'react'
import { Dashboard } from './components/Dashboard'
import { CreateBudget } from './components/CreateBudget'
import { BudgetOverview, getPeriodBounds } from './components/BudgetOverview'
import { CategoryDetail } from './components/CategoryDetail'
import { AddTransaction } from './components/AddTransaction'
import { TransactionList } from './components/TransactionList'
import { BudgetDetail } from './components/BudgetDetail'
import { AuthScreen } from './components/AuthScreen'
import { CardDetail } from './components/CardDetail'
import { BudgetCalendar } from './components/BudgetCalendar'
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
  const [activeCardId, setActiveCardId]               = useState(null)
  const [periodOffset, setPeriodOffset]               = useState(0)

  // Reset period when switching budgets
  useEffect(() => { setPeriodOffset(0) }, [activeBudgetId])

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
    createBudget, deleteBudget, updateBudget, addTransaction, updateTransaction,
    deleteTransaction, addBudgetItem, updateBudgetItem, deleteBudgetItem,
    addCard, updateCard, deleteCard, addCardPayment, deleteCardPayment,
  } = useBudgets(user)

  const activeBudget = budgets.find(b => b.id === activeBudgetId) ?? null

  // Transactions filtered to the active period (for recurrent budgets)
  const periodTransactions = (() => {
    if (!activeBudget) return []
    const allTxns = activeBudget.transactions || []
    const isRecurrent = activeBudget.recurrent && activeBudget.recurrence && activeBudget.type !== 'project'
    if (!isRecurrent) return allTxns
    const opts = { customDays: activeBudget.recurrenceDays, createdAt: activeBudget.recurrenceStart || activeBudget.createdAt }
    const { start, end } = getPeriodBounds(activeBudget.recurrence, periodOffset, opts)
    return allTxns.filter(t => { const d = new Date(t.date); return d >= start && d <= end })
  })()

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
          atLimit={budgets.length >= (user ? 5 : 3)}
        />
      )}

      {screen === 'overview' && activeBudget && (
        <BudgetOverview
          budget={activeBudget}
          periodOffset={periodOffset}
          onPeriodChange={setPeriodOffset}
          onUpdateBudget={(updates) => updateBudget(activeBudgetId, updates)}
          onBack={() => setScreen('dashboard')}
          onOpenCategory={handleOpenCategory}
          onAddTransaction={() => openAddTxn(null)}
          onOpenDetail={() => setScreen('detail')}
          onOpenCalendar={() => setScreen('calendar')}
          onOpenCardDetail={cardId => { setActiveCardId(cardId); setScreen('cardDetail') }}
          onAddCard={card => addCard(activeBudgetId, card)}
          onUpdateCard={(cardId, updates) => updateCard(activeBudgetId, cardId, updates)}
          onDeleteCard={cardId => deleteCard(activeBudgetId, cardId)}
        />
      )}

      {screen === 'cardDetail' && activeBudget && activeCardId && (
        <CardDetail
          budget={activeBudget}
          cardId={activeCardId}
          onBack={() => setScreen('overview')}
          onAddPayment={payment => addCardPayment(activeBudgetId, payment)}
          onDeletePayment={paymentId => deleteCardPayment(activeBudgetId, paymentId)}
          onUpdateCard={updates => updateCard(activeBudgetId, activeCardId, updates)}
          onDeleteCard={() => { deleteCard(activeBudgetId, activeCardId); setScreen('overview') }}
        />
      )}

      {screen === 'calendar' && activeBudget && (
        <BudgetCalendar
          budget={activeBudget}
          onBack={() => setScreen('overview')}
        />
      )}

      {screen === 'detail' && activeBudget && (
        <BudgetDetail
          budget={activeBudget}
          onBack={() => setScreen('overview')}
          onUpdateBudget={(budgetId, updates) => updateBudget(budgetId, updates)}
          onUpdateTransaction={(txnId, updates) => updateTransaction(activeBudgetId, txnId, updates)}
          onDeleteTransaction={(txnId) => deleteTransaction(activeBudgetId, txnId)}
        />
      )}

      {screen === 'category' && activeBudget && activeSection && (
        <CategoryDetail
          budget={activeBudget}
          transactions={periodTransactions}
          sectionKey={activeSection.key}
          sectionLabel={activeSection.label}
          onBack={() => setScreen('overview')}
          onUpdateBudget={(updates) => updateBudget(activeBudgetId, updates)}
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
          transactions={periodTransactions}
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
        <h2 className="confirm-sheet__title">You have local budgets</h2>
        <p className="confirm-sheet__body">
          You have <strong>{localCount} budget{localCount !== 1 ? 's' : ''}</strong> on this device
          and <strong>{cloudCount} budget{cloudCount !== 1 ? 's' : ''}</strong> in your cloud account.
          What would you like to do?
        </p>
        <div className="confirm-sheet__actions" style={{ flexDirection: 'column', gap: 8 }}>
          <button
            className="confirm-sheet__delete"
            style={{ background: '#6366F1' }}
            onClick={() => onResolve('merge')}
          >
            Add local to cloud ({localCount + cloudCount} total)
          </button>
          <button className="confirm-sheet__cancel" onClick={() => onResolve('cloud')}>
            Keep cloud only
          </button>
          <button className="confirm-sheet__cancel" onClick={() => onResolve('local')}>
            Use local only
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
