import React from 'react'
import { Document, Page, Text, View, StyleSheet, Svg, Path } from '@react-pdf/renderer'
import { getTheme } from '../themes'
import { getPeriodBounds, getPeriodLabel } from '../components/BudgetOverview'

// ── Utilities ────────────────────────────────────────────────────────
const SECTION_LABELS = { income: 'Income', bills: 'Bills', variable: 'Variable', savings: 'Savings' }
const SECTION_COLORS = { income: '#10B981', bills: '#EF4444', variable: '#F97316', savings: '#8B5CF6' }
const SECTION_ORDER  = ['income', 'bills', 'variable', 'savings']
const DOW_LABELS     = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function sumItems(items = []) {
  return items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
}
function sumTxns(txns, key) {
  return txns.filter(t => t.sectionKey === key).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
}
function fmt(n) {
  const v = parseFloat(n) || 0
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtShortDate(s) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function pct(val, max) { return max > 0 ? Math.min(100, Math.max(0, (val / max) * 100)) : 0 }
function getSectionColor(budget, key) {
  return budget?.sections?.[key]?.color ?? SECTION_COLORS[key] ?? '#6366F1'
}

// SVG arc path for the savings gauge (semicircle, left→right = 0%→100%)
function arcPath(cx, cy, r, pct100) {
  if (pct100 <= 0) return null
  if (pct100 >= 99.9) return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`
  const angle = Math.PI - (pct100 / 100) * Math.PI
  const ex = (cx + r * Math.cos(angle)).toFixed(2)
  const ey = (cy - r * Math.sin(angle)).toFixed(2)
  const la = pct100 > 50 ? 1 : 0
  return `M ${cx - r} ${cy} A ${r} ${r} 0 ${la} 1 ${ex} ${ey}`
}

// Derived data helpers
function computePrevActuals(budget, periodOffset, periodOpts) {
  if (!budget.recurrent || !budget.recurrence || budget.type === 'project') return null
  const bounds = getPeriodBounds(budget.recurrence, periodOffset - 1, periodOpts)
  if (!bounds) return null
  const txns = (budget.transactions || []).filter(t => {
    const d = new Date(t.date); return d >= bounds.start && d <= bounds.end
  })
  return {
    income:   txns.filter(t => t.sectionKey === 'income').reduce((s, t) => s + t.amount, 0),
    bills:    txns.filter(t => t.sectionKey === 'bills').reduce((s, t) => s + t.amount, 0),
    variable: txns.filter(t => t.sectionKey === 'variable').reduce((s, t) => s + t.amount, 0),
    savings:  txns.filter(t => t.sectionKey === 'savings').reduce((s, t) => s + t.amount, 0),
  }
}

function computeForecast(budget, periodTxns, periodOffset, periodOpts) {
  if (!budget.recurrent || !budget.recurrence || budget.type === 'project') return null
  const bounds = getPeriodBounds(budget.recurrence, periodOffset, periodOpts)
  if (!bounds) return null
  const now = new Date()
  if (now >= bounds.end || now <= bounds.start) return null
  const daysElapsed  = Math.max(0.5, (now - bounds.start) / 864e5)
  const totalDays    = (bounds.end - bounds.start) / 864e5
  const daysRemaining = totalDays - daysElapsed
  const pctComplete  = (daysElapsed / totalDays) * 100
  const secs = budget.sections || {}
  const cats = [
    { key: 'bills',    label: 'Bills',    items: secs.bills?.items    || [] },
    { key: 'variable', label: 'Variable', items: secs.variable?.items || [] },
  ]
  return {
    daysElapsed, totalDays, daysRemaining, pctComplete,
    cats: cats.map(c => {
      const actual   = sumTxns(periodTxns, c.key)
      const budgeted = sumItems(c.items)
      const projected = (actual / daysElapsed) * totalDays
      return { ...c, actual, budgeted, projected, willOvershoot: budgeted > 0 && projected > budgeted, overBy: Math.max(0, projected - budgeted) }
    }),
  }
}

function computeDowData(periodTxns) {
  const totals = new Array(7).fill(0)
  const counts = new Array(7).fill(0)
  periodTxns.filter(t => t.sectionKey !== 'income' && t.sectionKey !== 'savings').forEach(t => {
    const dow = new Date(t.date).getDay()
    totals[dow] += parseFloat(t.amount) || 0
    counts[dow]++
  })
  const max = Math.max(...totals, 1)
  return DOW_LABELS.map((day, i) => ({ day, total: totals[i], count: counts[i], pct: (totals[i] / max) * 100 }))
}

function computeTopMerchants(periodTxns, limit = 8) {
  const map = {}
  periodTxns.filter(t => t.sectionKey !== 'income' && t.sectionKey !== 'savings').forEach(t => {
    const k = t.subcategoryName || 'Uncategorized'
    if (!map[k]) map[k] = { name: k, total: 0, count: 0, sectionKey: t.sectionKey }
    map[k].total += parseFloat(t.amount) || 0
    map[k].count++
  })
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, limit)
}

function withRunningBalance(txns) {
  let running = 0
  return [...txns].sort((a, b) => new Date(a.date) - new Date(b.date)).map(t => {
    const amt = parseFloat(t.amount) || 0
    running += t.sectionKey === 'income' ? amt : -amt
    return { ...t, runningBalance: running }
  })
}

function computeSavingsHistory(budget, periodOffset, periodOpts, N = 6) {
  if (!budget.recurrent || !budget.recurrence || budget.type === 'project') return []
  const now = new Date()
  const history = []
  for (let i = -(N - 1); i <= 0; i++) {
    const offset = periodOffset + i
    const bounds = getPeriodBounds(budget.recurrence, offset, periodOpts)
    if (!bounds || bounds.start > now) continue
    const txns = (budget.transactions || []).filter(t => { const d = new Date(t.date); return d >= bounds.start && d <= bounds.end })
    const inc  = txns.filter(t => t.sectionKey === 'income').reduce((s, t) => s + t.amount, 0)
    const sav  = txns.filter(t => t.sectionKey === 'savings').reduce((s, t) => s + t.amount, 0)
    history.push({ label: getPeriodLabel(budget.recurrence, offset, periodOpts), rate: inc > 0 ? (sav / inc) * 100 : 0 })
  }
  return history
}

// ── Styles ────────────────────────────────────────────────────────────
const M = 36
const s = StyleSheet.create({
  page:         { fontFamily: 'Helvetica', backgroundColor: '#FFFFFF', paddingBottom: 44 },
  // bands
  band:         { paddingHorizontal: M, paddingVertical: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  bandTitle:    { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#fff', letterSpacing: 0.2 },
  bandSub:      { fontSize: 7.5, color: 'rgba(255,255,255,0.72)', marginTop: 3, letterSpacing: 0.8 },
  bandRight:    { alignItems: 'flex-end' },
  bandPeriod:   { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#fff' },
  bandDate:     { fontSize: 7, color: 'rgba(255,255,255,0.6)', marginTop: 3 },
  // body
  body:         { paddingHorizontal: M, paddingTop: 18 },
  sLabel:       { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#9CA3AF', letterSpacing: 1.1, marginBottom: 8, marginTop: 16 },
  divider:      { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  // KPI
  kpiRow:       { flexDirection: 'row' },
  kpiCard:      { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#F3F4F6', marginRight: 7 },
  kpiCardL:     { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  kpiLabel:     { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 4 },
  kpiValue:     { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  kpiSub:       { fontSize: 6.5, color: '#6B7280', marginTop: 2 },
  // bars
  barRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  barLabel:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', width: 66 },
  barTrack:     { flex: 1, height: 9, backgroundColor: '#F3F4F6', borderRadius: 5, overflow: 'hidden', marginHorizontal: 7 },
  barFill:      { height: '100%', borderRadius: 5 },
  barValue:     { fontSize: 8.5, fontFamily: 'Helvetica-Bold', width: 54, textAlign: 'right' },
  // table
  tHead:        { flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 1 },
  tRow:         { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F7F7F7', alignItems: 'center' },
  tRowAlt:      { backgroundColor: '#FAFAFA' },
  tH:           { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#6B7280', letterSpacing: 0.4 },
  tC:           { fontSize: 7.5, color: '#374151' },
  tCB:          { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#111827' },
  // section band
  secBand:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 10, borderRadius: 6, marginBottom: 7, marginTop: 12 },
  secBandTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#fff', flex: 1 },
  secBandStats: { fontSize: 7, color: 'rgba(255,255,255,0.85)' },
  // item cards
  itemGrid:     { flexDirection: 'row', flexWrap: 'wrap' },
  itemCard:     { width: '48.5%', backgroundColor: '#F9FAFB', borderRadius: 6, padding: 9, borderWidth: 1, borderColor: '#F3F4F6', borderLeftWidth: 3, marginBottom: 7 },
  itemCardR:    { marginLeft: '3%' },
  itemName:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 6 },
  miniBarRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  miniBarLbl:   { fontSize: 6, color: '#9CA3AF', width: 42 },
  miniBarTrack: { flex: 1, height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginHorizontal: 3 },
  miniBarFill:  { height: '100%', borderRadius: 3 },
  miniBarAmt:   { fontSize: 6, color: '#374151', width: 40, textAlign: 'right' },
  // stats grid
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap' },
  statCard:     { width: '23%', backgroundColor: '#F9FAFB', borderRadius: 6, padding: 9, borderWidth: 1, borderColor: '#F3F4F6', marginRight: 7, marginBottom: 7 },
  statLabel:    { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#9CA3AF', letterSpacing: 0.6, marginBottom: 3 },
  statValue:    { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#111827' },
  statSub:      { fontSize: 6, color: '#6B7280', marginTop: 2 },
  // callout
  callout:      { backgroundColor: '#FFF7ED', borderRadius: 8, borderWidth: 1, borderColor: '#FED7AA', padding: 10 },
  calloutTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#92400E', marginBottom: 6 },
  // footer
  footer:       { position: 'absolute', bottom: 16, left: M, right: M, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 6 },
  footerText:   { fontSize: 6.5, color: '#9CA3AF' },
})

// ── Shared components ─────────────────────────────────────────────────
function PageFooter({ themeColor, budgetName }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{budgetName} · Budget Report</Text>
      <Text style={s.footerText}>Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
      <Text style={[s.footerText, { color: themeColor }]} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  )
}

function Band({ budget, subtitle, themeColor, periodLabel }) {
  return (
    <View style={[s.band, { backgroundColor: themeColor }]}>
      <View>
        <Text style={s.bandTitle}>{budget.name}</Text>
        <Text style={s.bandSub}>{subtitle.toUpperCase()}</Text>
      </View>
      {periodLabel ? (
        <View style={s.bandRight}>
          <Text style={s.bandPeriod}>{periodLabel}</Text>
          <Text style={s.bandDate}>Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
        </View>
      ) : null}
    </View>
  )
}

function SLabel({ children }) { return <Text style={s.sLabel}>{String(children).toUpperCase()}</Text> }

function HorizBar({ label, value, maxVal, color }) {
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{label}</Text>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${pct(value, maxVal)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[s.barValue, { color }]}>{fmt(value)}</Text>
    </View>
  )
}

function Dot({ color, size = 7 }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, marginRight: 5 }} />
}

function SavingsGauge({ rate, themeColor, history = [] }) {
  const cx = 70, cy = 60, r = 46, sw = 13
  const clampedRate = Math.min(Math.max(rate, 0), 100)
  const gaugeColor = rate >= 20 ? '#10B981' : rate >= 10 ? '#F59E0B' : '#EF4444'
  const bgD   = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`
  const fillD = arcPath(cx, cy, r, clampedRate)
  const maxHistRate = Math.max(...history.map(h => h.rate), 1)
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Svg width={140} height={80} viewBox="0 0 140 80">
        <Path d={bgD}   stroke="#E5E7EB" strokeWidth={sw} fill="none" strokeLinecap="round" />
        {fillD && <Path d={fillD} stroke={gaugeColor} strokeWidth={sw} fill="none" strokeLinecap="round" />}
      </Svg>
      <Text style={{ fontSize: 20, fontFamily: 'Helvetica-Bold', color: gaugeColor, marginTop: -14 }}>{rate.toFixed(1)}%</Text>
      <Text style={{ fontSize: 7, color: '#6B7280', marginTop: 2 }}>of income saved</Text>
      {history.length > 1 && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8, gap: 3, height: 24 }}>
          {history.map((h, i) => (
            <View key={i} style={{ alignItems: 'center' }}>
              <View style={{ width: 12, height: Math.max(3, (h.rate / maxHistRate) * 20), backgroundColor: i === history.length - 1 ? gaugeColor : '#D1D5DB', borderRadius: 2 }} />
            </View>
          ))}
        </View>
      )}
      {history.length > 1 && (
        <Text style={{ fontSize: 5.5, color: '#9CA3AF', marginTop: 3 }}>{history.length}-period trend</Text>
      )}
    </View>
  )
}

// ── Page 1: Cover ─────────────────────────────────────────────────────
function CoverPage({ budget, periodLabel, themeColor }) {
  const isProj   = budget.type === 'project'
  const typeLabel = isProj ? 'Project Budget' : 'Daily Life Budget'
  const recLabel  = budget.recurrent && budget.recurrence
    ? budget.recurrence.charAt(0).toUpperCase() + budget.recurrence.slice(1)
    : null
  return (
    <Page size="A4" style={[s.page, { paddingBottom: 0 }]}>
      {/* Colored top two-thirds */}
      <View style={{ backgroundColor: themeColor, height: 430, padding: M, justifyContent: 'flex-end', position: 'relative' }}>
        {/* Decorative circles */}
        <View style={{ position: 'absolute', top: 30, right: 30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.09)' }} />
        <View style={{ position: 'absolute', top: 100, right: 140, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.07)' }} />
        <View style={{ position: 'absolute', top: -40, left: 180, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.05)' }} />
        <View style={{ position: 'absolute', bottom: 60, right: 50, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        {/* Content */}
        <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.65)', letterSpacing: 2, marginBottom: 14, fontFamily: 'Helvetica-Bold' }}>
          BUDGET & FINANCIAL REPORT
        </Text>
        <Text style={{ fontSize: 38, fontFamily: 'Helvetica-Bold', color: '#fff', marginBottom: 20, letterSpacing: 0.3 }}>
          {budget.name}
        </Text>
        {periodLabel && (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.8, marginBottom: 3 }}>REPORT PERIOD</Text>
            <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#fff' }}>{periodLabel}</Text>
          </View>
        )}
      </View>

      {/* White bottom third */}
      <View style={{ flex: 1, padding: M }}>
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <View style={{ flex: 1, marginRight: 20 }}>
            <Text style={{ fontSize: 6.5, color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 3, fontFamily: 'Helvetica-Bold' }}>BUDGET TYPE</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#374151' }}>{typeLabel}</Text>
          </View>
          {recLabel && (
            <View style={{ flex: 1, marginRight: 20 }}>
              <Text style={{ fontSize: 6.5, color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 3, fontFamily: 'Helvetica-Bold' }}>RECURRENCE</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#374151' }}>{recLabel}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 6.5, color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 3, fontFamily: 'Helvetica-Bold' }}>CREATED</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#374151' }}>
              {new Date(budget.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 30, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
          <Text style={{ fontSize: 7, color: '#9CA3AF', marginBottom: 4 }}>
            Generated by My Budget App · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </Text>
          <Text style={{ fontSize: 6.5, color: '#D1D5DB' }}>
            This report is generated from your personal budget data and is for informational purposes only.
          </Text>
        </View>
      </View>
    </Page>
  )
}

// ── Page 2: Executive Summary ─────────────────────────────────────────
function SummaryPage({ budget, periodTxns, periodLabel, themeColor, prevActuals, forecast, savingsHistory }) {
  const secs   = budget.sections || {}
  const isProj = budget.type === 'project'
  const hasInc = !!secs.income?.enabled
  const hasSav = !!secs.savings?.enabled

  const incBudget = sumItems(secs.income?.items)
  const bilBudget = sumItems(secs.bills?.items)
  const varBudget = sumItems(secs.variable?.items)
  const savBudget = sumItems(secs.savings?.items)
  const expBudget = bilBudget + varBudget

  const incAct  = sumTxns(periodTxns, 'income')
  const bilAct  = sumTxns(periodTxns, 'bills')
  const varAct  = sumTxns(periodTxns, 'variable')
  const savAct  = sumTxns(periodTxns, 'savings')
  const expAct  = bilAct + varAct
  const netAct  = incAct - expAct - savAct
  const savRate = incAct > 0 ? (savAct / incAct) * 100 : 0
  const adherence = expBudget > 0 ? Math.max(0, 100 - (Math.max(0, expAct - expBudget) / expBudget) * 100) : 100

  const expTxns = periodTxns.filter(t => t.sectionKey !== 'income' && t.sectionKey !== 'savings')
  const avgTxn  = expTxns.length > 0 ? expAct / expTxns.length : 0
  const largest = [...periodTxns].sort((a, b) => b.amount - a.amount)[0]
  const uniqueCats = new Set(periodTxns.map(t => t.subcategoryName)).size

  const maxBar = Math.max(incAct, expAct, 1)

  const sectionRows = [
    hasInc  && { key: 'income',   label: 'Income',                                    budg: incBudget, act: incAct, prev: prevActuals?.income,   isInc: true  },
    !isProj && { key: 'bills',    label: 'Bills',                                     budg: bilBudget, act: bilAct, prev: prevActuals?.bills,    isInc: false },
    true    && { key: 'variable', label: isProj ? 'Expenses' : 'Variable',            budg: varBudget, act: varAct, prev: prevActuals?.variable, isInc: false },
    hasSav  && { key: 'savings',  label: 'Savings',                                   budg: savBudget, act: savAct, prev: prevActuals?.savings,  isInc: false },
  ].filter(Boolean)

  const leftoverBudg = incBudget - expBudget - savBudget
  const leftoverAct  = incAct - expAct - savAct

  // Card liability summary
  const cards = budget.trackCards && budget.cards?.length > 0 ? budget.cards : []
  const cardCharged = periodTxns.filter(t => t.cardId).reduce((s, t) => s + t.amount, 0)

  return (
    <Page size="A4" style={s.page}>
      <Band budget={budget} subtitle="Executive Summary" themeColor={themeColor} periodLabel={periodLabel} />
      <View style={s.body}>

        {/* KPIs */}
        <SLabel>Key Metrics</SLabel>
        <View style={s.kpiRow}>
          {hasInc && (
            <View style={s.kpiCard}>
              <Dot color={getSectionColor(budget, 'income')} size={5} />
              <Text style={s.kpiLabel}>TOTAL INCOME</Text>
              <Text style={[s.kpiValue, { color: getSectionColor(budget, 'income') }]}>{fmt(incAct)}</Text>
              {incBudget > 0 && <Text style={s.kpiSub}>Budget: {fmt(incBudget)}</Text>}
            </View>
          )}
          <View style={hasInc ? s.kpiCard : s.kpiCardL}>
            <Dot color={getSectionColor(budget, 'bills')} size={5} />
            <Text style={s.kpiLabel}>TOTAL EXPENSES</Text>
            <Text style={[s.kpiValue, { color: getSectionColor(budget, 'bills') }]}>{fmt(expAct)}</Text>
            {expBudget > 0 && <Text style={s.kpiSub}>Budget: {fmt(expBudget)}</Text>}
          </View>
          {hasInc && (
            <View style={s.kpiCard}>
              <Dot color={netAct >= 0 ? '#10B981' : '#EF4444'} size={5} />
              <Text style={s.kpiLabel}>NET LEFTOVER</Text>
              <Text style={[s.kpiValue, { color: netAct >= 0 ? '#10B981' : '#EF4444' }]}>{fmt(netAct)}</Text>
              <Text style={s.kpiSub}>{adherence.toFixed(0)}% budget adherence</Text>
            </View>
          )}
          <View style={s.kpiCardL}>
            <Dot color={themeColor} size={5} />
            <Text style={s.kpiLabel}>TRANSACTIONS</Text>
            <Text style={[s.kpiValue, { color: themeColor }]}>{periodTxns.length}</Text>
            {avgTxn > 0 && <Text style={s.kpiSub}>Avg {fmt(avgTxn)} each</Text>}
          </View>
        </View>

        {/* Savings Rate Gauge + Financial Position side by side */}
        <SLabel>Financial Health</SLabel>
        <View style={{ flexDirection: 'row', backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' }}>
          {hasInc && (
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderRightWidth: 1, borderRightColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 6 }}>SAVINGS RATE</Text>
              <SavingsGauge rate={savRate} themeColor={themeColor} history={savingsHistory} />
            </View>
          )}
          <View style={{ flex: 1.4, padding: 14 }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 10 }}>PERIOD FINANCIAL POSITION</Text>
            {hasInc && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ fontSize: 8, color: '#6B7280' }}>Cash in (income)</Text>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#10B981' }}>{fmt(incAct)}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
              <Text style={{ fontSize: 8, color: '#6B7280' }}>Cash out (expenses)</Text>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#EF4444' }}>−{fmt(expAct)}</Text>
            </View>
            {hasSav && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ fontSize: 8, color: '#6B7280' }}>Saved</Text>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: getSectionColor(budget, 'savings') }}>{fmt(savAct)}</Text>
              </View>
            )}
            {cards.length > 0 && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text style={{ fontSize: 8, color: '#6B7280' }}>Card charges (liability)</Text>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#F97316' }}>−{fmt(cardCharged)}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, marginTop: 2, borderTopWidth: 2, borderTopColor: '#E5E7EB' }}>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#374151' }}>Net cash flow</Text>
              <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: netAct >= 0 ? '#10B981' : '#EF4444' }}>{fmt(netAct)}</Text>
            </View>
            <View style={{ marginTop: 8, backgroundColor: adherence >= 100 ? '#D1FAE5' : adherence >= 75 ? '#FEF3C7' : '#FEE2E2', borderRadius: 5, padding: 6 }}>
              <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: adherence >= 100 ? '#065F46' : adherence >= 75 ? '#92400E' : '#991B1B' }}>
                {adherence >= 100 ? '✓ Within budget' : adherence >= 75 ? '⚠ Approaching limit' : '✗ Over budget'} · {adherence.toFixed(0)}% expense budget used
              </Text>
            </View>
          </View>
        </View>

        {/* Income vs Expenses */}
        {hasInc && (
          <>
            <SLabel>Income vs Expenses</SLabel>
            <HorizBar label="Income"   value={incAct}              maxVal={maxBar} color={getSectionColor(budget, 'income')} />
            <HorizBar label="Expenses" value={expAct}              maxVal={maxBar} color={getSectionColor(budget, 'bills')} />
            {hasSav && <HorizBar label="Savings" value={savAct}    maxVal={maxBar} color={getSectionColor(budget, 'savings')} />}
            <HorizBar label="Net"      value={Math.max(0, netAct)} maxVal={maxBar} color={netAct >= 0 ? '#10B981' : '#EF4444'} />
          </>
        )}

        {/* Budget Summary with MoM delta */}
        <SLabel>Budget Summary</SLabel>
        <View style={s.tHead}>
          <Text style={[s.tH, { flex: 1.8 }]}>Category</Text>
          <Text style={[s.tH, { flex: 1, textAlign: 'right' }]}>Expected</Text>
          <Text style={[s.tH, { flex: 1, textAlign: 'right' }]}>Actual</Text>
          <Text style={[s.tH, { flex: 1, textAlign: 'right' }]}>Difference</Text>
          {prevActuals && <Text style={[s.tH, { flex: 1, textAlign: 'right' }]}>vs Last Period</Text>}
          <Text style={[s.tH, { flex: 1.1, textAlign: 'right' }]}>Status</Text>
        </View>
        {sectionRows.map(({ key, label, budg, act, prev, isInc }, idx) => {
          const diff  = isInc ? act - budg : budg - act
          const good  = budg === 0 ? true : (isInc ? act >= budg : act <= budg)
          const dClr  = budg === 0 ? '#9CA3AF' : good ? '#10B981' : '#EF4444'
          const mom   = prev != null ? act - prev : null
          const momGood = mom === null ? true : (isInc ? mom >= 0 : mom <= 0)
          return (
            <View key={key} style={[s.tRow, idx % 2 === 1 ? s.tRowAlt : {}]}>
              <View style={{ flex: 1.8, flexDirection: 'row', alignItems: 'center' }}>
                <Dot color={getSectionColor(budget, key)} size={6} />
                <Text style={s.tCB}>{label}</Text>
              </View>
              <Text style={[s.tC, { flex: 1, textAlign: 'right', color: '#9CA3AF' }]}>{budg > 0 ? fmt(budg) : '—'}</Text>
              <Text style={[s.tCB, { flex: 1, textAlign: 'right' }]}>{fmt(act)}</Text>
              <Text style={[s.tC, { flex: 1, textAlign: 'right', color: dClr }]}>
                {budg > 0 ? (diff >= 0 ? '+' : '−') + fmt(Math.abs(diff)) : '—'}
              </Text>
              {prevActuals && (
                <Text style={[s.tC, { flex: 1, textAlign: 'right', color: mom === null ? '#9CA3AF' : momGood ? '#10B981' : '#EF4444' }]}>
                  {mom === null ? '—' : (mom >= 0 ? '↑' : '↓') + fmt(Math.abs(mom))}
                </Text>
              )}
              <Text style={[s.tC, { flex: 1.1, textAlign: 'right', color: dClr, fontFamily: 'Helvetica-Bold', fontSize: 7 }]}>
                {budg === 0 ? '—' : good ? '✓ On track' : '✗ Over'}
              </Text>
            </View>
          )
        })}
        {hasInc && (
          <View style={[s.tRow, { borderTopWidth: 2, borderTopColor: '#E5E7EB', marginTop: 2 }]}>
            <View style={{ flex: 1.8, flexDirection: 'row', alignItems: 'center' }}>
              <Dot color="#9CA3AF" size={6} /><Text style={s.tCB}>Leftover</Text>
            </View>
            <Text style={[s.tC, { flex: 1, textAlign: 'right', color: '#9CA3AF' }]}>{fmt(leftoverBudg)}</Text>
            <Text style={[s.tCB, { flex: 1, textAlign: 'right', color: leftoverAct >= 0 ? '#10B981' : '#EF4444' }]}>{fmt(leftoverAct)}</Text>
            <Text style={[s.tC, { flex: 1, textAlign: 'right' }]} />
            {prevActuals && <Text style={[s.tC, { flex: 1, textAlign: 'right' }]} />}
            <Text style={[s.tC, { flex: 1.1, textAlign: 'right' }]} />
          </View>
        )}

        {/* Spending Forecast */}
        {forecast && (
          <>
            <SLabel>Spending Forecast ({forecast.pctComplete.toFixed(0)}% through period, {forecast.daysRemaining.toFixed(0)} days remaining)</SLabel>
            <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#F3F4F6', padding: 12 }}>
              {forecast.cats.map((cat, i) => (
                <View key={cat.key} style={{ marginBottom: i < forecast.cats.length - 1 ? 10 : 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#374151' }}>{cat.label}</Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Text style={{ fontSize: 7, color: '#9CA3AF' }}>Actual so far: {fmt(cat.actual)}</Text>
                      <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: cat.willOvershoot ? '#EF4444' : '#374151' }}>
                        Projected: {fmt(cat.projected)}
                      </Text>
                      {cat.budgeted > 0 && <Text style={{ fontSize: 7, color: '#9CA3AF' }}>Budget: {fmt(cat.budgeted)}</Text>}
                    </View>
                  </View>
                  <View style={{ height: 7, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                    <View style={{ width: `${pct(cat.actual, Math.max(cat.budgeted, cat.projected, 1))}%`, height: '100%', backgroundColor: getSectionColor(budget, cat.key), borderRadius: 4 }} />
                  </View>
                  {cat.willOvershoot && (
                    <Text style={{ fontSize: 6.5, color: '#EF4444', marginTop: 2, fontFamily: 'Helvetica-Bold' }}>
                      ⚠ Projected to overshoot by {fmt(cat.overBy)} at current burn rate
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Additional Stats */}
        <SLabel>Additional Statistics</SLabel>
        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <Text style={s.statLabel}>BUDGET ADHERENCE</Text>
            <Text style={[s.statValue, { color: adherence >= 100 ? '#10B981' : adherence >= 75 ? '#F59E0B' : '#EF4444' }]}>{adherence.toFixed(0)}%</Text>
            <Text style={s.statSub}>expense budget used</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLabel}>AVG TRANSACTION</Text>
            <Text style={[s.statValue, { color: '#374151' }]}>{fmt(avgTxn)}</Text>
            <Text style={s.statSub}>{expTxns.length} expense entries</Text>
          </View>
          {largest && (
            <View style={s.statCard}>
              <Text style={s.statLabel}>LARGEST SINGLE TXN</Text>
              <Text style={[s.statValue, { color: '#374151' }]}>{fmt(largest.amount)}</Text>
              <Text style={s.statSub}>{largest.subcategoryName || '—'}</Text>
            </View>
          )}
          <View style={s.statCard}>
            <Text style={s.statLabel}>CATEGORIES USED</Text>
            <Text style={[s.statValue, { color: '#374151' }]}>{String(uniqueCats)}</Text>
            <Text style={s.statSub}>unique categories</Text>
          </View>
          {hasSav && (
            <View style={s.statCard}>
              <Text style={s.statLabel}>SAVINGS GOAL</Text>
              <Text style={[s.statValue, { color: savAct >= savBudget && savBudget > 0 ? '#10B981' : '#F59E0B' }]}>
                {savBudget > 0 ? pct(savAct, savBudget).toFixed(0) + '%' : '—'}
              </Text>
              <Text style={s.statSub}>{savBudget > 0 ? `${fmt(savAct)} of ${fmt(savBudget)}` : 'No goal set'}</Text>
            </View>
          )}
          {cards.length > 0 && (
            <View style={s.statCard}>
              <Text style={s.statLabel}>CARD LIABILITY</Text>
              <Text style={[s.statValue, { color: '#374151' }]}>{fmt(cardCharged)}</Text>
              <Text style={s.statSub}>{periodTxns.filter(t => t.cardId).length} charged txns</Text>
            </View>
          )}
        </View>
      </View>
      <PageFooter themeColor={themeColor} budgetName={budget.name} />
    </Page>
  )
}

// ── Page 3: Transaction Intelligence ─────────────────────────────────
function IntelligencePage({ budget, periodTxns, themeColor }) {
  const topMerchants = computeTopMerchants(periodTxns, 8)
  const biggestTxns  = [...periodTxns].sort((a, b) => b.amount - a.amount).slice(0, 5)
  const dowData      = computeDowData(periodTxns)
  const maxDow       = Math.max(...dowData.map(d => d.total), 1)
  const totalMerchantSpend = topMerchants.reduce((s, m) => s + m.total, 0)
  const allExpSpend  = periodTxns.filter(t => t.sectionKey !== 'income' && t.sectionKey !== 'savings').reduce((s, t) => s + t.amount, 0)
  const highestDow   = dowData.reduce((a, b) => b.total > a.total ? b : a, dowData[0])

  return (
    <Page size="A4" style={s.page}>
      <Band budget={budget} subtitle="Transaction Intelligence" themeColor={themeColor} />
      <View style={s.body}>

        {/* Top merchants */}
        <SLabel>Top Spending Categories (Ranked)</SLabel>
        {topMerchants.length === 0 ? (
          <Text style={{ fontSize: 8, color: '#9CA3AF' }}>No expense transactions this period.</Text>
        ) : (
          <>
            <View style={s.tHead}>
              <Text style={[s.tH, { width: 20 }]}>#</Text>
              <Text style={[s.tH, { flex: 2.5 }]}>Category / Merchant</Text>
              <Text style={[s.tH, { flex: 1 }]}>Section</Text>
              <Text style={[s.tH, { width: 28, textAlign: 'right' }]}>Txns</Text>
              <Text style={[s.tH, { flex: 1, textAlign: 'right' }]}>Total Spent</Text>
              <Text style={[s.tH, { flex: 1, textAlign: 'right' }]}>% of Expenses</Text>
              <Text style={[s.tH, { flex: 2 }]}>  Share</Text>
            </View>
            {topMerchants.map((m, idx) => {
              const share = pct(m.total, allExpSpend)
              const color = getSectionColor(budget, m.sectionKey)
              return (
                <View key={m.name} style={[s.tRow, idx % 2 === 1 ? s.tRowAlt : {}]}>
                  <Text style={[s.tC, { width: 20, color: '#9CA3AF' }]}>{idx + 1}</Text>
                  <Text style={[s.tCB, { flex: 2.5 }]}>{m.name}</Text>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <Dot color={color} size={5} />
                    <Text style={[s.tC, { fontSize: 7 }]}>{SECTION_LABELS[m.sectionKey] || m.sectionKey}</Text>
                  </View>
                  <Text style={[s.tC, { width: 28, textAlign: 'right', color: '#6B7280' }]}>{m.count}</Text>
                  <Text style={[s.tCB, { flex: 1, textAlign: 'right', color }]}>{fmt(m.total)}</Text>
                  <Text style={[s.tC, { flex: 1, textAlign: 'right', color: '#6B7280' }]}>{share.toFixed(1)}%</Text>
                  <View style={{ flex: 2, paddingLeft: 6 }}>
                    <View style={{ height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{ width: `${share}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
                    </View>
                  </View>
                </View>
              )
            })}
          </>
        )}

        {/* Biggest transactions callout */}
        {biggestTxns.length > 0 && (
          <>
            <SLabel>Biggest Single Transactions</SLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {biggestTxns.map((t, idx) => {
                const color = getSectionColor(budget, t.sectionKey)
                const isRight = idx % 2 === 1
                return (
                  <View key={t.id} style={[{ width: '48.5%', backgroundColor: '#F9FAFB', borderRadius: 7, padding: 10, borderWidth: 1, borderColor: '#F3F4F6', borderLeftWidth: 3, borderLeftColor: color, marginBottom: 7 }, isRight ? { marginLeft: '3%' } : {}]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={{ backgroundColor: color + '20', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2, marginRight: 5 }}>
                          <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', color }}>#{idx + 1}</Text>
                        </View>
                        <Text style={{ fontSize: 7, color: '#6B7280' }}>{fmtShortDate(t.date)}</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color }}>{fmt(t.amount)}</Text>
                    </View>
                    <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 2 }}>{t.subcategoryName || '—'}</Text>
                    {t.memo ? <Text style={{ fontSize: 7, color: '#9CA3AF' }} numberOfLines={1}>{t.memo}</Text> : null}
                  </View>
                )
              })}
            </View>
          </>
        )}

        {/* Day-of-week heatmap */}
        <SLabel>Spending by Day of Week</SLabel>
        {allExpSpend === 0 ? (
          <Text style={{ fontSize: 8, color: '#9CA3AF' }}>No expense data to display.</Text>
        ) : (
          <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#F3F4F6', padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 70, marginBottom: 6 }}>
              {dowData.map((d, i) => {
                const barH = Math.max(4, (d.total / maxDow) * 60)
                const isHighest = d.day === highestDow.day
                return (
                  <View key={d.day} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 70 }}>
                    <View style={{ width: '60%', height: barH, backgroundColor: isHighest ? themeColor : themeColor + '55', borderRadius: 3 }} />
                  </View>
                )
              })}
            </View>
            <View style={{ flexDirection: 'row' }}>
              {dowData.map(d => (
                <View key={d.day} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 7, fontFamily: d.day === highestDow.day ? 'Helvetica-Bold' : 'Helvetica', color: d.day === highestDow.day ? themeColor : '#6B7280' }}>{d.day}</Text>
                  <Text style={{ fontSize: 6, color: '#9CA3AF', marginTop: 2 }}>{fmt(d.total)}</Text>
                  {d.count > 0 && <Text style={{ fontSize: 5.5, color: '#D1D5DB' }}>{d.count} txn{d.count !== 1 ? 's' : ''}</Text>}
                </View>
              ))}
            </View>
            {highestDow.total > 0 && (
              <Text style={{ fontSize: 7, color: '#6B7280', marginTop: 10, textAlign: 'center' }}>
                Highest spending day: {highestDow.day} ({fmt(highestDow.total)}, {highestDow.count} transaction{highestDow.count !== 1 ? 's' : ''})
              </Text>
            )}
          </View>
        )}
      </View>
      <PageFooter themeColor={themeColor} budgetName={budget.name} />
    </Page>
  )
}

// ── Page 4: Category Breakdown ────────────────────────────────────────
function CategoryPage({ budget, periodTxns, themeColor }) {
  const secs   = budget.sections || {}
  const isProj = budget.type === 'project'
  const sectionDefs = [
    secs.income?.enabled  && { key: 'income',   label: 'Income',                                  items: secs.income?.items   || [] },
    !isProj               && { key: 'bills',    label: 'Bills',                                   items: secs.bills?.items    || [] },
    true                  && { key: 'variable', label: isProj ? 'Expenses' : 'Variable Expenses', items: secs.variable?.items || [] },
    secs.savings?.enabled && { key: 'savings',  label: 'Savings',                                 items: secs.savings?.items  || [] },
  ].filter(Boolean)

  return (
    <Page size="A4" style={s.page}>
      <Band budget={budget} subtitle="Category Breakdown" themeColor={themeColor} />
      <View style={s.body}>
        {sectionDefs.map(sec => {
          const color     = getSectionColor(budget, sec.key)
          const secTxns   = periodTxns.filter(t => t.sectionKey === sec.key)
          const secAct    = secTxns.reduce((s, t) => s + t.amount, 0)
          const secBudget = sumItems(sec.items)
          const actualsMap = {}
          secTxns.forEach(t => { actualsMap[t.subcategoryName] = (actualsMap[t.subcategoryName] || 0) + t.amount })
          const maxVal = Math.max(...sec.items.map(i => Math.max(parseFloat(i.amount) || 0, actualsMap[i.name] || 0)), 1)
          return (
            <View key={sec.key}>
              <View style={[s.secBand, { backgroundColor: color }]}>
                <Text style={s.secBandTitle}>{sec.label}</Text>
                <Text style={s.secBandStats}>Budget: {fmt(secBudget)}  ·  Actual: {fmt(secAct)}  ·  {secTxns.length} transactions</Text>
              </View>
              {sec.items.length === 0 ? (
                <Text style={{ fontSize: 7.5, color: '#9CA3AF', paddingLeft: 4, marginBottom: 8 }}>No budget items defined.</Text>
              ) : (
                <View style={s.itemGrid}>
                  {sec.items.map((item, idx) => {
                    const exp  = parseFloat(item.amount) || 0
                    const act  = actualsMap[item.name] || 0
                    const over = sec.key !== 'income' ? act > exp && exp > 0 : act < exp && exp > 0
                    return (
                      <View key={item.id || item.name} style={[s.itemCard, { borderLeftColor: color }, idx % 2 === 1 ? s.itemCardR : {}]}>
                        <Text style={s.itemName}>{item.name}</Text>
                        <View style={s.miniBarRow}>
                          <Text style={s.miniBarLbl}>Expected</Text>
                          <View style={s.miniBarTrack}>
                            <View style={[s.miniBarFill, { width: `${pct(exp, maxVal)}%`, backgroundColor: color, opacity: 0.4 }]} />
                          </View>
                          <Text style={s.miniBarAmt}>{fmt(exp)}</Text>
                        </View>
                        <View style={s.miniBarRow}>
                          <Text style={s.miniBarLbl}>Actual</Text>
                          <View style={s.miniBarTrack}>
                            <View style={[s.miniBarFill, { width: `${pct(act, maxVal)}%`, backgroundColor: over ? '#EF4444' : color }]} />
                          </View>
                          <Text style={[s.miniBarAmt, { fontFamily: 'Helvetica-Bold' }]}>{fmt(act)}</Text>
                        </View>
                        {exp > 0 && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                            <Text style={{ fontSize: 6, color: over ? '#EF4444' : '#10B981', fontFamily: 'Helvetica-Bold' }}>
                              {over ? '↑ Over ' + fmt(act - exp) : act === 0 ? 'No spending yet' : '✓ Under ' + fmt(exp - act)}
                            </Text>
                            <Text style={{ fontSize: 6, color: '#9CA3AF' }}>{exp > 0 ? ((act / exp) * 100).toFixed(0) + '% used' : ''}</Text>
                          </View>
                        )}
                      </View>
                    )
                  })}
                </View>
              )}
            </View>
          )
        })}

        {budget.trackCards && budget.cards?.length > 0 && (
          <>
            <SLabel>Credit Card Summary</SLabel>
            <View style={s.itemGrid}>
              {budget.cards.map((card, idx) => {
                const charged = periodTxns.filter(t => t.cardId === card.id).reduce((s, t) => s + t.amount, 0)
                const limit   = parseFloat(card.limit) || 0
                const util    = pct(charged, limit)
                return (
                  <View key={card.id} style={[s.itemCard, { borderLeftColor: card.color }, idx % 2 === 1 ? s.itemCardR : {}]}>
                    <Text style={s.itemName}>{card.name}</Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', color: card.color, marginBottom: 5 }}>{fmt(charged)}</Text>
                    {limit > 0 && (
                      <>
                        <View style={[s.miniBarTrack, { height: 5, marginHorizontal: 0, marginBottom: 3 }]}>
                          <View style={[s.miniBarFill, { width: `${Math.min(util, 100)}%`, backgroundColor: util > 80 ? '#EF4444' : card.color }]} />
                        </View>
                        <Text style={{ fontSize: 6, color: '#6B7280' }}>{util.toFixed(0)}% of {fmt(limit)} limit</Text>
                      </>
                    )}
                  </View>
                )
              })}
            </View>
          </>
        )}
      </View>
      <PageFooter themeColor={themeColor} budgetName={budget.name} />
    </Page>
  )
}

// ── Page 5: Transactions with Running Balance ─────────────────────────
function TransactionsPage({ budget, periodTxns, themeColor }) {
  const cards    = budget.cards || []
  const cardMap  = Object.fromEntries(cards.map(c => [c.id, c]))
  const hasCards = budget.trackCards && cards.length > 0
  const txns     = withRunningBalance(periodTxns)

  const grouped = {}
  txns.forEach(t => {
    if (!grouped[t.sectionKey]) grouped[t.sectionKey] = []
    grouped[t.sectionKey].push(t)
  })

  return (
    <Page size="A4" style={s.page}>
      <Band budget={budget} subtitle={'Transaction History · ' + periodTxns.length + ' transactions'} themeColor={themeColor} />
      <View style={s.body}>
        <View style={s.tHead}>
          <Text style={[s.tH, { width: 46 }]}>Date</Text>
          <Text style={[s.tH, { flex: 2 }]}>Category</Text>
          <Text style={[s.tH, { flex: 2 }]}>Memo</Text>
          {hasCards && <Text style={[s.tH, { flex: 1.1 }]}>Card</Text>}
          <Text style={[s.tH, { width: 48, textAlign: 'right' }]}>Amount</Text>
          <Text style={[s.tH, { width: 55, textAlign: 'right' }]}>Running Balance</Text>
        </View>
        {SECTION_ORDER.map(key => {
          const secTxns = grouped[key]
          if (!secTxns?.length) return null
          const color    = getSectionColor(budget, key)
          const subtotal = secTxns.reduce((s, t) => s + t.amount, 0)
          return (
            <View key={key}>
              <View style={{ backgroundColor: color + '1A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, marginVertical: 3, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Dot color={color} size={6} />
                  <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color }}>{SECTION_LABELS[key]}</Text>
                </View>
                <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color }}>{secTxns.length} txns · {fmt(subtotal)}</Text>
              </View>
              {secTxns.map((t, idx) => {
                const card    = t.cardId ? cardMap[t.cardId] : null
                const balClr  = t.runningBalance >= 0 ? '#10B981' : '#EF4444'
                return (
                  <View key={t.id} style={[s.tRow, idx % 2 === 1 ? s.tRowAlt : {}, { borderBottomColor: '#F5F5F5' }]}>
                    <Text style={[s.tC, { width: 46, color: '#6B7280' }]}>{fmtShortDate(t.date)}</Text>
                    <Text style={[s.tCB, { flex: 2 }]}>{t.subcategoryName || '—'}</Text>
                    <Text style={[s.tC, { flex: 2, color: '#6B7280' }]} numberOfLines={1}>{t.memo || '—'}</Text>
                    {hasCards && (
                      <View style={{ flex: 1.1, flexDirection: 'row', alignItems: 'center' }}>
                        {card ? <><Dot color={card.color} size={5} /><Text style={[s.tC, { fontSize: 7 }]}>{card.name}</Text></> : <Text style={[s.tC, { color: '#D1D5DB' }]}>—</Text>}
                      </View>
                    )}
                    <Text style={[s.tCB, { width: 48, textAlign: 'right', color }]}>{fmt(t.amount)}</Text>
                    <Text style={[s.tCB, { width: 55, textAlign: 'right', color: balClr, fontSize: 7 }]}>{fmt(t.runningBalance)}</Text>
                  </View>
                )
              })}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 10, paddingVertical: 4, marginBottom: 4 }}>
                <Text style={{ fontSize: 7.5, color: '#6B7280' }}>Subtotal: </Text>
                <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color }}>{fmt(subtotal)}</Text>
              </View>
            </View>
          )
        })}
        {periodTxns.length === 0 && (
          <Text style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 50 }}>No transactions recorded for this period.</Text>
        )}
      </View>
      <PageFooter themeColor={themeColor} budgetName={budget.name} />
    </Page>
  )
}

// ── Page 6: Period Trends ─────────────────────────────────────────────
function TrendsPage({ budget, periodOffset, periodOpts, themeColor }) {
  const isRecurrent = budget.recurrent && budget.recurrence && budget.type !== 'project'
  if (!isRecurrent) return null

  const secs    = budget.sections || {}
  const allTxns = budget.transactions || []
  const now     = new Date()
  const hasInc  = !!secs.income?.enabled
  const hasSav  = !!secs.savings?.enabled

  const periods = []
  for (let i = -5; i <= 0; i++) {
    const offset = periodOffset + i
    const bounds = getPeriodBounds(budget.recurrence, offset, periodOpts)
    if (!bounds || bounds.start > now) continue
    const label = getPeriodLabel(budget.recurrence, offset, periodOpts)
    const txns  = allTxns.filter(t => { const d = new Date(t.date); return d >= bounds.start && d <= bounds.end })
    const inc   = txns.filter(t => t.sectionKey === 'income').reduce((s, t) => s + t.amount, 0)
    const bil   = txns.filter(t => t.sectionKey === 'bills').reduce((s, t) => s + t.amount, 0)
    const vrb   = txns.filter(t => t.sectionKey === 'variable').reduce((s, t) => s + t.amount, 0)
    const sav   = txns.filter(t => t.sectionKey === 'savings').reduce((s, t) => s + t.amount, 0)
    const exp   = bil + vrb
    const net   = inc - exp - sav
    periods.push({ offset, label, inc, bil, vrb, sav, exp, net, count: txns.length })
  }

  if (periods.length < 2) return null
  const maxBar = Math.max(...periods.map(p => Math.max(p.inc, p.exp)), 1)

  return (
    <Page size="A4" style={s.page}>
      <Band budget={budget} subtitle={'Period Comparison · Last ' + periods.length + ' periods'} themeColor={themeColor} />
      <View style={s.body}>
        <SLabel>Period Comparison Table</SLabel>
        <View style={s.tHead}>
          <Text style={[s.tH, { flex: 2 }]}>Period</Text>
          {hasInc && <Text style={[s.tH, { flex: 1, textAlign: 'right' }]}>Income</Text>}
          <Text style={[s.tH, { flex: 1, textAlign: 'right' }]}>Bills</Text>
          <Text style={[s.tH, { flex: 1, textAlign: 'right' }]}>Variable</Text>
          {hasSav && <Text style={[s.tH, { flex: 1, textAlign: 'right' }]}>Savings</Text>}
          <Text style={[s.tH, { flex: 1, textAlign: 'right' }]}>Net</Text>
          <Text style={[s.tH, { width: 28, textAlign: 'right' }]}>Txns</Text>
        </View>
        {periods.map((p, idx) => {
          const isLatest = idx === periods.length - 1
          const prev = idx > 0 ? periods[idx - 1] : null
          const d = (val, pv, lowerBetter = false) => {
            if (!prev || val === pv) return null
            return { diff: val - pv, good: lowerBetter ? val < pv : val > pv }
          }
          const renderD = (delta) => delta ? (
            <Text style={{ fontSize: 5.5, color: delta.good ? '#10B981' : '#EF4444', marginTop: 1 }}>
              {delta.diff > 0 ? '↑' : '↓'}{fmt(Math.abs(delta.diff))}
            </Text>
          ) : null
          return (
            <View key={p.offset} style={[s.tRow, isLatest ? { backgroundColor: themeColor + '14' } : idx % 2 === 1 ? s.tRowAlt : {}]}>
              <View style={{ flex: 2, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={[s.tCB, isLatest ? { color: themeColor } : {}]}>{p.label}</Text>
                {isLatest && <View style={{ backgroundColor: themeColor, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 }}><Text style={{ fontSize: 5, color: '#fff', fontFamily: 'Helvetica-Bold' }}>NOW</Text></View>}
              </View>
              {hasInc && <View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={[s.tC, { color: getSectionColor(budget, 'income') }]}>{fmt(p.inc)}</Text>{renderD(d(p.inc, prev?.inc))}</View>}
              <View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={s.tC}>{fmt(p.bil)}</Text>{renderD(d(p.bil, prev?.bil, true))}</View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={s.tC}>{fmt(p.vrb)}</Text>{renderD(d(p.vrb, prev?.vrb, true))}</View>
              {hasSav && <View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={[s.tC, { color: getSectionColor(budget, 'savings') }]}>{fmt(p.sav)}</Text></View>}
              <View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={[s.tCB, { color: p.net >= 0 ? '#10B981' : '#EF4444' }]}>{fmt(p.net)}</Text>{renderD(d(p.net, prev?.net))}</View>
              <Text style={[s.tC, { width: 28, textAlign: 'right', color: '#6B7280' }]}>{p.count}</Text>
            </View>
          )
        })}

        <SLabel>Spending Trend</SLabel>
        {periods.map((p, idx) => {
          const isLatest = idx === periods.length - 1
          return (
            <View key={p.offset} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 7, color: isLatest ? themeColor : '#6B7280', fontFamily: isLatest ? 'Helvetica-Bold' : 'Helvetica', width: 70 }}>{p.label}</Text>
              <View style={{ flex: 1 }}>
                {hasInc && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={{ fontSize: 5.5, color: '#9CA3AF', width: 48 }}>Income</Text>
                    <View style={{ flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginRight: 5 }}>
                      <View style={{ width: `${pct(p.inc, maxBar)}%`, height: '100%', backgroundColor: getSectionColor(budget, 'income'), borderRadius: 3 }} />
                    </View>
                    <Text style={{ fontSize: 6, color: '#374151', width: 46, textAlign: 'right' }}>{fmt(p.inc)}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 5.5, color: '#9CA3AF', width: 48 }}>Expenses</Text>
                  <View style={{ flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden', marginRight: 5 }}>
                    <View style={{ width: `${pct(p.exp, maxBar)}%`, height: '100%', backgroundColor: getSectionColor(budget, 'bills'), borderRadius: 3 }} />
                  </View>
                  <Text style={{ fontSize: 6, color: '#374151', width: 46, textAlign: 'right' }}>{fmt(p.exp)}</Text>
                </View>
              </View>
            </View>
          )
        })}

        {periods.length >= 3 && (() => {
          const avgExp = periods.reduce((s, p) => s + p.exp, 0) / periods.length
          const cur = periods[periods.length - 1]
          const best  = [...periods].sort((a, b) => b.net - a.net)[0]
          const worst = [...periods].sort((a, b) => a.net - b.net)[0]
          return (
            <View style={{ marginTop: 12 }}>
              <SLabel>Insights</SLabel>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 7, padding: 11, borderWidth: 1, borderColor: '#F3F4F6', marginRight: 8 }}>
                  <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 4 }}>Expense Trend</Text>
                  <Text style={{ fontSize: 7, color: '#6B7280', lineHeight: 1.5 }}>
                    {'This period (' + fmt(cur.exp) + ') is ' + (cur.exp > avgExp ? 'above' : 'below') + ' the ' + periods.length + '-period average (' + fmt(avgExp) + ') by ' + fmt(Math.abs(cur.exp - avgExp)) + '.'}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 7, padding: 11, borderWidth: 1, borderColor: '#F3F4F6' }}>
                  <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 4 }}>Best & Worst Periods</Text>
                  <Text style={{ fontSize: 7, color: '#6B7280', lineHeight: 1.5 }}>
                    {'Best net: ' + best.label + ' (' + fmt(best.net) + '). Worst net: ' + worst.label + ' (' + fmt(worst.net) + ').'}
                  </Text>
                </View>
              </View>
            </View>
          )
        })()}
      </View>
      <PageFooter themeColor={themeColor} budgetName={budget.name} />
    </Page>
  )
}

// ── Page 7: Appendix ─────────────────────────────────────────────────
function AppendixPage({ budget, themeColor }) {
  const secs   = budget.sections || {}
  const isProj = budget.type === 'project'
  const sectionDefs = [
    secs.income?.enabled  && { key: 'income',   label: 'Income',                                  items: secs.income?.items   || [] },
    !isProj               && { key: 'bills',    label: 'Bills',                                   items: secs.bills?.items    || [] },
    true                  && { key: 'variable', label: isProj ? 'Expenses' : 'Variable Expenses', items: secs.variable?.items || [] },
    secs.savings?.enabled && { key: 'savings',  label: 'Savings',                                 items: secs.savings?.items  || [] },
  ].filter(Boolean)

  return (
    <Page size="A4" style={s.page}>
      <Band budget={budget} subtitle="Appendix · Category Definitions" themeColor={themeColor} />
      <View style={s.body}>
        <Text style={{ fontSize: 7.5, color: '#6B7280', marginBottom: 16, lineHeight: 1.5 }}>
          This appendix lists all budget categories and their configured amounts. Useful for sharing with an accountant, financial advisor, or household member.
        </Text>

        {sectionDefs.map(sec => {
          const color   = getSectionColor(budget, sec.key)
          const total   = sumItems(sec.items)
          return (
            <View key={sec.key} style={{ marginBottom: 16 }}>
              <View style={[s.secBand, { backgroundColor: color, marginTop: 0 }]}>
                <Text style={s.secBandTitle}>{sec.label}</Text>
                <Text style={s.secBandStats}>{sec.items.length} items · Total: {fmt(total)}</Text>
              </View>
              {sec.items.length === 0 ? (
                <Text style={{ fontSize: 7.5, color: '#9CA3AF', paddingLeft: 4 }}>No items defined for this section.</Text>
              ) : (
                <>
                  <View style={s.tHead}>
                    <Text style={[s.tH, { flex: 3 }]}>Category Name</Text>
                    <Text style={[s.tH, { flex: 1, textAlign: 'right' }]}>Monthly Budget</Text>
                    <Text style={[s.tH, { flex: 1, textAlign: 'right' }]}>Due Day</Text>
                    <Text style={[s.tH, { flex: 2, textAlign: 'right' }]}>Notes</Text>
                  </View>
                  {sec.items.map((item, idx) => (
                    <View key={item.id || item.name} style={[s.tRow, idx % 2 === 1 ? s.tRowAlt : {}]}>
                      <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center' }}>
                        <Dot color={color} size={5} />
                        <Text style={s.tCB}>{item.name}</Text>
                      </View>
                      <Text style={[s.tCB, { flex: 1, textAlign: 'right', color }]}>{item.amount ? fmt(item.amount) : '—'}</Text>
                      <Text style={[s.tC, { flex: 1, textAlign: 'right', color: '#6B7280' }]}>
                        {item.dueDay ? `Day ${item.dueDay}` : item.dueCycleDays ? `Every ${item.dueCycleDays}d` : '—'}
                      </Text>
                      <Text style={[s.tC, { flex: 2, textAlign: 'right', color: '#9CA3AF' }]}>—</Text>
                    </View>
                  ))}
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingRight: 10, paddingVertical: 5 }}>
                    <Text style={{ fontSize: 7.5, color: '#6B7280' }}>Section total: </Text>
                    <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color }}>{fmt(total)}</Text>
                  </View>
                </>
              )}
            </View>
          )
        })}

        {/* Budget metadata */}
        <View style={{ marginTop: 10, padding: 12, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#F3F4F6' }}>
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#374151', marginBottom: 8 }}>Budget Metadata</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {[
              { label: 'Budget ID', value: budget.id?.slice(0, 8) + '…' },
              { label: 'Type', value: budget.type === 'project' ? 'Project' : 'Daily Life' },
              { label: 'Created', value: new Date(budget.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
              { label: 'Recurrence', value: budget.recurrent ? (budget.recurrence || 'Custom') : 'None' },
              { label: 'Card Tracking', value: budget.trackCards ? 'Enabled' : 'Disabled' },
              { label: 'Total Items', value: String(Object.values(budget.sections || {}).flatMap(s => s.items || []).length) },
            ].map(({ label, value }) => (
              <View key={label} style={{ width: '33%', marginBottom: 6 }}>
                <Text style={{ fontSize: 6, color: '#9CA3AF', marginBottom: 2 }}>{label}</Text>
                <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#374151' }}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <PageFooter themeColor={themeColor} budgetName={budget.name} />
    </Page>
  )
}

// ── Main document ─────────────────────────────────────────────────────
export function BudgetPdfDocument({ budget, periodTxns, periodLabel, periodOffset, periodOpts }) {
  const theme       = getTheme(budget.themeId)
  const themeColor  = theme?.primary ?? '#6366F1'
  const isRecurrent = budget.recurrent && budget.recurrence && budget.type !== 'project'
  const prevActuals = computePrevActuals(budget, periodOffset, periodOpts)
  const forecast    = computeForecast(budget, periodTxns, periodOffset, periodOpts)
  const savingsHistory = computeSavingsHistory(budget, periodOffset, periodOpts, 6)

  return (
    <Document title={budget.name + ' — Budget Report'} author="My Budget App" creator="My Budget App">
      <CoverPage budget={budget} periodLabel={periodLabel} themeColor={themeColor} />
      <SummaryPage
        budget={budget} periodTxns={periodTxns} periodLabel={periodLabel}
        themeColor={themeColor} prevActuals={prevActuals} forecast={forecast} savingsHistory={savingsHistory}
      />
      <IntelligencePage budget={budget} periodTxns={periodTxns} themeColor={themeColor} />
      <CategoryPage budget={budget} periodTxns={periodTxns} themeColor={themeColor} />
      <TransactionsPage budget={budget} periodTxns={periodTxns} themeColor={themeColor} />
      {isRecurrent && <TrendsPage budget={budget} periodOffset={periodOffset} periodOpts={periodOpts} themeColor={themeColor} />}
      <AppendixPage budget={budget} themeColor={themeColor} />
    </Document>
  )
}
