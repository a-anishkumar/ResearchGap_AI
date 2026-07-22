import { useState } from 'react'
import useStore from '../api/store'
import { analyzeGaps, suggestGaps } from '../api/client'
import GapCard from '../components/GapCard'
import { exportGapsAsMarkdown, exportGapsAsJSON } from '../utils/exportReport'
import { useToast } from '../components/Toast'

// ── Clean SVGs ──────────────────────────────────────────────────────────────
function ChartIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function SparklesIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}

function ExportIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function MethodIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function DomainIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  )
}

function MicroscopeIcon({ className = "w-12 h-12" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  )
}

function CheckCircleIcon({ className = "w-12 h-12" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

// ── Inline bar chart for gap candidates ─────────────────────────────────────
function GapBarChart({ gaps }) {
  if (!gaps?.length) return null
  const maxScore = Math.max(...gaps.map(g => g.score || 0))

  return (
    <div className="glass-card p-5">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
        Gap Score — Top Candidates
      </h3>
      <div className="space-y-2.5">
        {gaps.slice(0, 8).map((gap, i) => {
          const pct = maxScore > 0 ? (gap.score / maxScore) * 100 : 0
          const hue = Math.round(220 - i * 15) // Shift from blue → purple
          return (
            <div key={i} className="group">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-slate-500 w-4 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-xs font-medium text-slate-300 truncate max-w-[120px]">{gap.method}</span>
                    <span className="text-[10px] text-slate-600">×</span>
                    <span className="text-xs text-slate-400 truncate max-w-[100px]">{gap.domain}</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-brand-400 shrink-0 w-10 text-right">
                  {gap.score?.toFixed(0)}
                </span>
              </div>
              <div className="ml-6 h-2 bg-surface-500 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, hsl(${hue},70%,55%), hsl(${hue - 20},80%,65%))`,
                    animationDelay: `${i * 80}ms`,
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-700" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Coverage donut chart (SVG) ───────────────────────────────────────────────
function CoverageDonut({ observed, total }) {
  const pct = total > 0 ? observed / total : 0
  const r = 42
  const circ = 2 * Math.PI * r
  const observedDash = circ * pct
  const missingDash  = circ * (1 - pct)
  const coverage = Math.round(pct * 100)

  return (
    <div className="glass-card p-5 flex flex-col items-center">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 self-start">
        Corpus Coverage
      </h3>
      <div className="relative w-28 h-28">
        <svg width="112" height="112" className="-rotate-90" viewBox="0 0 112 112">
          <circle cx="56" cy="56" r={r} fill="none" stroke="#1e2235" strokeWidth="10" />
          <circle
            cx="56" cy="56" r={r}
            fill="none"
            stroke="#ef4444"
            strokeWidth="10"
            strokeDasharray={`${missingDash} ${observedDash}`}
            strokeLinecap="round"
            opacity="0.4"
          />
          <circle
            cx="56" cy="56" r={r}
            fill="none"
            stroke="#34d399"
            strokeWidth="10"
            strokeDasharray={`${observedDash} ${missingDash}`}
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 6px #34d39950)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white font-display">{coverage}%</span>
          <span className="text-[10px] text-slate-500">covered</span>
        </div>
      </div>
      <div className="w-full mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="text-slate-400">Explored</span>
          </div>
          <span className="font-bold text-green-400">{observed}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 opacity-60" />
            <span className="text-slate-400">Unexplored</span>
          </div>
          <span className="font-bold text-red-400">{total - observed}</span>
        </div>
        <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2">
          <span className="text-slate-500">Total pairs</span>
          <span className="font-bold text-slate-300">{total}</span>
        </div>
      </div>
    </div>
  )
}

// ── Method frequency chart ───────────────────────────────────────────────────
function FrequencyChart({ gaps, title, getLabel, getFreq, color }) {
  if (!gaps?.length) return null

  const freqMap = {}
  gaps.forEach(g => {
    const label = getLabel(g)
    freqMap[label] = Math.max(freqMap[label] || 0, getFreq(g))
  })
  const sorted = Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  const max = sorted[0]?.[1] || 1

  return (
    <div className="glass-card p-5">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">{title}</h3>
      <div className="space-y-2.5">
        {sorted.map(([label, freq]) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-300 truncate max-w-[150px]" title={label}>{label}</span>
              <span className="text-xs font-bold text-slate-400">{freq}p</span>
            </div>
            <div className="h-1.5 bg-surface-500 rounded-full overflow-hidden">
              <div
                className={`h-full ${color} rounded-full transition-all duration-500`}
                style={{ width: `${(freq / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Candidates tab ───────────────────────────────────────────────────────────
function CandidatesView({ gaps }) {
  const maxScore = Math.max(...gaps.map(g => g.score || 0))
  return (
    <div className="space-y-3">
      {gaps.map((gap, i) => {
        const pct = maxScore > 0 ? (gap.score / maxScore) * 100 : 0
        return (
          <div
            key={i}
            className="glass-card p-4 hover:border-brand-700/30 transition-all duration-200 animate-slide-up group"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg bg-surface-500 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                {i + 1}
              </span>

              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                <span className="badge-method flex items-center gap-1.5">
                  <MethodIcon className="w-3.5 h-3.5 text-brand-400" />
                  {gap.method}
                </span>
                <span className="text-slate-600 text-sm font-bold">×</span>
                <span className="badge-domain flex items-center gap-1.5">
                  <DomainIcon className="w-3.5 h-3.5 text-cyan-400" />
                  {gap.domain}
                </span>
              </div>

              <div className="shrink-0 text-right">
                <span className="text-[10px] text-slate-500 mr-2 uppercase tracking-wider">Score</span>
                <span className="text-xs font-bold text-brand-400 bg-brand-900/50 border border-brand-700/30 px-2 py-0.5 rounded-full shadow-glow-brand">
                  {gap.score?.toFixed(0)}
                </span>
              </div>
            </div>

            <div className="mt-3 ml-10 bg-slate-900/40 rounded-lg p-3 border border-white/5 relative overflow-hidden">
               <div 
                 className="absolute top-0 left-0 bottom-0 bg-brand-900/20 transition-all duration-700 border-r border-brand-500/20" 
                 style={{ width: `${pct}%` }} 
               />
               <p className="text-xs text-slate-400 leading-relaxed relative z-10">
                 <strong className="text-slate-300">Why this is a gap:</strong> You have <strong className="text-brand-300">{gap.method_frequency} paper{gap.method_frequency !== 1 ? 's' : ''}</strong> using <strong>{gap.method}</strong>, and <strong className="text-cyan-300">{gap.domain_frequency} paper{gap.domain_frequency !== 1 ? 's' : ''}</strong> about <strong>{gap.domain}</strong>... but none of them use both together!
               </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function GapsPage() {
  const {
    gapAnalysis, setGapAnalysis,
    gapSuggestions, setGapSuggestions,
    loadingGaps, setLoadingGaps,
    loadingSuggestions, setLoadingSuggestions,
  } = useStore()

  const [topN, setTopN]             = useState(10)
  const [analyzeError, setAnalyzeError]   = useState(null)
  const [suggestError, setSuggestError]   = useState(null)
  const [activeTab, setActiveTab]   = useState('candidates')
  const [showExport, setShowExport] = useState(false)
  const toast = useToast()

  const handleAnalyze = async () => {
    setLoadingGaps(true)
    setAnalyzeError(null)
    try {
      const { data } = await analyzeGaps(topN)
      setGapAnalysis(data)
      setActiveTab('candidates')
    } catch (e) {
      setAnalyzeError(e?.response?.data?.detail || e.message)
    } finally {
      setLoadingGaps(false)
    }
  }

  const handleSuggest = async () => {
    setLoadingSuggestions(true)
    setSuggestError(null)
    try {
      const { data } = await suggestGaps(topN)
      setGapSuggestions(data)
      setActiveTab('suggestions')
    } catch (e) {
      setSuggestError(e?.response?.data?.detail || e.message)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const maxScore = gapSuggestions?.suggestions?.length
    ? Math.max(...gapSuggestions.suggestions.map(g => g.score || 0))
    : 1

  return (
    <div className="min-h-screen mesh-bg pt-20 px-6 py-12">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="section-title mb-2">Research Gap Discovery</h1>
          <p className="text-slate-400">
            Identify unexplored Method × Domain combinations and get AI-powered research opportunity statements.
          </p>
        </div>

        {/* Controls */}
        <div className="glass-card p-5 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-400 font-medium">Top gaps:</label>
            <select
              id="top-n-select"
              value={topN}
              onChange={e => setTopN(Number(e.target.value))}
              className="input-base w-24 py-2"
            >
              {[5, 10, 15, 20, 30, 50].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button id="analyze-gaps-btn" onClick={handleAnalyze} disabled={loadingGaps} className="btn-secondary flex items-center gap-1.5">
            <ChartIcon className="w-4 h-4" />
            {loadingGaps ? 'Analyzing…' : 'Analyze Gaps'}
          </button>

          <button
            id="suggest-gaps-btn"
            onClick={handleSuggest}
            disabled={loadingSuggestions || (gapAnalysis && gapAnalysis.missing_pairs === 0)}
            className="btn-primary flex items-center gap-1.5"
            title={gapAnalysis?.missing_pairs === 0 ? 'No gaps to suggest for' : 'Generate AI suggestions'}
          >
            <SparklesIcon className="w-4 h-4" />
            {loadingSuggestions ? 'Generating…' : 'Generate AI Suggestions'}
          </button>

          {/* Export */}
          {(gapAnalysis || gapSuggestions) && (
            <div className="relative ml-auto">
              <button onClick={() => setShowExport(v => !v)} className="btn-secondary flex items-center gap-1.5">
                <ExportIcon className="w-4 h-4" />
                Export
              </button>
              {showExport && (
                <div className="absolute top-full right-0 mt-2 z-30 glass-card border border-white/10 min-w-[180px] py-1 animate-fade-in">
                  <button
                    onClick={() => { exportGapsAsMarkdown(gapAnalysis, gapSuggestions); setShowExport(false); toast.success('Markdown downloaded!') }}
                    className="block w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                  >Export as Markdown</button>
                  <button
                    onClick={() => { exportGapsAsJSON(gapAnalysis, gapSuggestions); setShowExport(false); toast.success('JSON downloaded!') }}
                    className="block w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                  >Export as JSON</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Errors */}
        {analyzeError && (
          <div className="glass-card p-4 border border-red-800/40 bg-red-950/20 mb-4">
            <p className="text-sm text-red-400">⚠ {analyzeError}</p>
          </div>
        )}
        {suggestError && (
          <div className="glass-card p-4 border border-red-800/40 bg-red-950/20 mb-4">
            <p className="text-sm text-red-400">⚠ {suggestError}</p>
          </div>
        )}

        {/* ── Dashboard overview ── */}
        {gapAnalysis && gapAnalysis.missing_pairs > 0 && (
          <div className="mb-8 animate-slide-up">

            {/* Summary KPI strip */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { 
                  label: 'Total Possibilities',    
                  value: gapAnalysis.total_possible_pairs, 
                  color: 'text-slate-300',  
                  sub: 'Method × Domain combinations',
                  explanation: 'If we combine every research method with every domain found in your papers, this is the total number of possible combinations.'
                },
                { 
                  label: 'Already Explored',       
                  value: gapAnalysis.observed_pairs,        
                  color: 'text-green-400',  
                  sub: 'found in your papers',
                  explanation: 'The number of combinations that already exist in the papers you uploaded. Someone has already researched these.'
                },
                { 
                  label: 'Unexplored Gaps',  
                  value: gapAnalysis.missing_pairs,         
                  color: 'text-brand-400',  
                  sub: 'opportunities for you',
                  explanation: 'The combinations that haven\'t been tried yet. These are your opportunities to do new research!'
                },
              ].map(s => (
                <div key={s.label} className="glass-card p-5 text-center stat-card relative group cursor-help">
                  <p className={`text-4xl font-bold font-display mb-1 ${s.color}`}>{s.value}</p>
                  <p className="text-sm font-semibold text-white">{s.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.sub}</p>
                  
                  {/* Hover Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3 bg-slate-800 text-sm text-slate-200 rounded-xl border border-white/10 shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-10 scale-95 group-hover:scale-100">
                    <p className="font-bold text-white mb-1">What is this?</p>
                    <p className="text-xs leading-relaxed">{s.explanation}</p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800" />
                  </div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <CoverageDonut
                observed={gapAnalysis.observed_pairs}
                total={gapAnalysis.total_possible_pairs}
              />
              <GapBarChart gaps={gapAnalysis.top_gaps} />
              <div className="space-y-4">
                <FrequencyChart
                  gaps={gapAnalysis.top_gaps}
                  title="Top Methods in Gaps"
                  getLabel={g => g.method}
                  getFreq={g => g.method_frequency}
                  color="bg-brand-500"
                />
                <FrequencyChart
                  gaps={gapAnalysis.top_gaps}
                  title="Top Domains in Gaps"
                  getLabel={g => g.domain}
                  getFreq={g => g.domain_frequency}
                  color="bg-cyan-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        {(gapAnalysis || gapSuggestions) && gapAnalysis?.missing_pairs > 0 && (
          <div className="flex gap-2 mb-5">
            {[
              { id: 'candidates',  label: 'Gap Candidates', count: gapAnalysis?.top_gaps?.length || 0, icon: <ChartIcon className="w-4 h-4 shrink-0" /> },
              { id: 'suggestions', label: 'AI Suggestions', count: gapSuggestions?.suggestions?.length || 0, icon: <SparklesIcon className="w-4 h-4 shrink-0" /> },
            ].map(tab => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center gap-2
                  ${activeTab === tab.id
                    ? 'bg-brand-900/60 text-brand-300 border border-brand-700/40 shadow-glow-brand'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-brand-500/20 text-brand-300' : 'bg-slate-800 text-slate-400'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── Candidates ── */}
        {activeTab === 'candidates' && gapAnalysis?.top_gaps?.length > 0 && (
          <CandidatesView gaps={gapAnalysis.top_gaps} />
        )}

        {/* ── AI Suggestions ── */}
        {activeTab === 'suggestions' && gapSuggestions?.suggestions?.length > 0 && (
          <div className="space-y-4">
            {gapSuggestions.suggestions.map((gap, i) => (
              <GapCard key={i} gap={gap} rank={i + 1} maxScore={maxScore} />
            ))}
          </div>
        )}

        {/* Loading states */}
        {loadingGaps && (
          <div className="space-y-4 animate-fade-in">
            {[1,2,3].map(i => (
              <div key={i} className="glass-card p-5">
                <div className="flex gap-3 mb-3">
                  <div className="skeleton w-7 h-7 rounded-lg" />
                  <div className="flex gap-2 flex-1">
                    <div className="skeleton h-6 w-32 rounded-full" />
                    <div className="skeleton h-6 w-28 rounded-full" />
                  </div>
                </div>
                <div className="skeleton h-2 rounded-full w-full ml-10" />
              </div>
            ))}
          </div>
        )}
        {loadingSuggestions && (
          <div className="space-y-4 animate-fade-in">
            {[1,2,3].map(i => (
              <div key={i} className="glass-card p-5">
                <div className="flex gap-3 mb-4">
                  <div className="skeleton w-7 h-7 rounded-lg" />
                  <div className="skeleton h-6 w-48 rounded-full" />
                </div>
                <div className="space-y-3">
                  <div className="skeleton h-20 rounded-xl" />
                  <div className="skeleton h-20 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!gapAnalysis && !loadingGaps && !loadingSuggestions && (
          <div className="glass-card p-16 text-center animate-fade-in flex flex-col items-center">
            <MicroscopeIcon className="w-16 h-16 text-slate-500 mb-6 animate-pulse-slow" />
            <h2 className="text-2xl font-display font-bold text-white mb-3">Discover What's Unexplored</h2>
            <p className="text-slate-400 max-w-lg mx-auto text-sm leading-relaxed mb-8">
              Click <strong className="text-white">Analyze Gaps</strong> to find missing Method × Domain combinations across your corpus.
              Then click <strong className="text-white">Generate AI Suggestions</strong> to get structured, point-wise research opportunity statements.
            </p>
            <button onClick={handleAnalyze} disabled={loadingGaps} className="btn-primary text-base py-3 px-8 flex items-center gap-2">
              <ChartIcon className="w-5 h-5" />
              Analyze Gaps Now
            </button>
          </div>
        )}

        {/* 0 gaps */}
        {gapAnalysis?.missing_pairs === 0 && (
          <div className="glass-card p-12 text-center animate-fade-in mt-6 flex flex-col items-center">
            <CheckCircleIcon className="w-16 h-16 text-green-400 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">Full Coverage!</h3>
            <p className="text-slate-400 max-w-md mx-auto text-sm">
              All {gapAnalysis.total_possible_pairs} potential Method × Domain combinations have been explored.
            </p>
            <p className="text-slate-500 text-xs mt-4 bg-slate-950/20 py-2 px-4 rounded-lg inline-block">
              Tip: Upload papers with different methods or domains to discover new gaps.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
