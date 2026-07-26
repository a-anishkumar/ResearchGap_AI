import { useEffect, useCallback, useState } from 'react'
import useStore from '../api/store'
import { getGraphStats, getHealth, getAllStatus } from '../api/client'
import StatDetailPanel from '../components/StatDetailPanel'

// ── Clean vector icons for dashboard ─────────────────────────────────────────
function PaperIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function MethodIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function DomainIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  )
}

function DatasetIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  )
}

function ChartIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function LinkIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  )
}

function GraphIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )
}

function GapsIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function SearchIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function RefreshIcon({ className = "w-3 h-3" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
    </svg>
  )
}

function RocketIcon({ className = "w-12 h-12" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}

function SparklesIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}

const STAT_CARDS = [
  { key: 'papers',        label: 'Papers',    icon: <PaperIcon />,   color: 'text-brand-400',   bg: 'bg-brand-900/40',   border: 'border-brand-700/30' },
  { key: 'methods',       label: 'Methods',   icon: <MethodIcon />,  color: 'text-cyan-400',    bg: 'bg-cyan-900/40',    border: 'border-cyan-700/30'  },
  { key: 'domains',       label: 'Domains',   icon: <DomainIcon />,  color: 'text-purple-400',  bg: 'bg-purple-900/40',  border: 'border-purple-700/30'},
  { key: 'datasets',      label: 'Datasets',  icon: <DatasetIcon />, color: 'text-amber-400',   bg: 'bg-amber-900/40',   border: 'border-amber-700/30' },
  { key: 'results',       label: 'Results',   icon: <ChartIcon />,   color: 'text-green-400',   bg: 'bg-green-900/40',   border: 'border-green-700/30' },
  { key: 'relationships', label: 'Links',     icon: <LinkIcon />,    color: 'text-slate-300',   bg: 'bg-surface-600/60', border: 'border-white/5'      },
]

const QUICK_ACTIONS = [
  { page: 'upload',     label: 'Upload Papers',     icon: <PaperIcon />, desc: 'Add PDFs to your corpus', color: 'from-brand-600 to-brand-500',   glow: 'rgba(97,114,243,0.15)' },
  { page: 'graph',      label: 'Knowledge Graph',   icon: <GraphIcon />, desc: 'Explore method & domain links', color: 'from-purple-600 to-purple-500', glow: 'rgba(167,139,250,0.15)' },
  { page: 'gaps',       label: 'Research Gaps',     icon: <GapsIcon />,  desc: 'Discover research opportunities', color: 'from-cyan-600 to-cyan-500',   glow: 'rgba(34,211,238,0.12)' },
  { page: 'search',     label: 'Semantic Search',   icon: <SearchIcon />, desc: 'Chat with your paper corpus', color: 'from-amber-600 to-amber-500',  glow: 'rgba(251,191,36,0.12)' },
]

// Workflow steps for the progress guide
const WORKFLOW_STEPS = [
  { label: 'Upload Papers',  page: 'upload',     icon: '📄' },
  { label: 'AI Processing',  page: 'processing', icon: '⚙️' },
  { label: 'Explore Graph',  page: 'graph',      icon: '🔗' },
  { label: 'Find Gaps',      page: 'gaps',       icon: '🔍' },
]

export default function DashboardPage() {
  const { graphStats, setGraphStats, setPage, papers, setPapers, health, setHealth } = useStore()
  const [loading, setLoading] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, statusRes, healthRes] = await Promise.allSettled([
        getGraphStats(),
        getAllStatus(),
        getHealth(),
      ])
      if (statsRes.status === 'fulfilled')  setGraphStats(statsRes.value.data)
      if (statusRes.status === 'fulfilled') setPapers(statusRes.value.data)
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data)
    } finally {
      setLoading(false)
    }
  }, [setGraphStats, setPapers, setHealth])

  useEffect(() => { refresh() }, [refresh])

  const donePapers = papers.filter(p => p.stage === 'done')
  const processingPapers = papers.filter(p => p.stage !== 'done' && p.stage !== 'error')

  return (
    <div className="min-h-screen mesh-bg pt-20 px-6 py-10">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-8 animate-fade-in flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-3xl md:text-4xl text-white mb-1.5">
              Welcome to <span className="bg-gradient-to-r from-brand-400 via-accent-purple to-accent-cyan bg-clip-text text-transparent">ResearchGap AI</span>
            </h1>
            <p className="text-slate-400">Your AI-powered research gap discovery engine</p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="btn-secondary text-xs flex items-center gap-1.5 shrink-0"
          >
            <RefreshIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Workflow Steps */}
        <div className="glass-card p-4 mb-8 animate-slide-up">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Research Workflow</p>
          <div className="flex items-center gap-2">
            {WORKFLOW_STEPS.map((step, i) => {
              const isDone = i === 0
                ? papers.length > 0
                : i === 1
                ? donePapers.length > 0
                : i === 2
                ? (graphStats?.papers ?? 0) > 0
                : false
              return (
                <div key={step.page} className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => setPage(step.page)}
                    className={`flex flex-col sm:flex-row items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all w-full text-center sm:text-left
                      ${ isDone
                        ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/50'
                        : 'border-white/8 bg-surface-700/40 text-slate-400 hover:text-white hover:bg-surface-600/50'
                      }`}
                  >
                    <span className="text-base sm:text-sm">{step.icon}</span>
                    <span className="leading-snug">{step.label}</span>
                    {isDone && <span className="sm:ml-auto text-emerald-400 text-[10px] font-bold">✓</span>}
                  </button>
                  {i < WORKFLOW_STEPS.length - 1 && (
                    <svg className="w-3 h-3 text-slate-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          {STAT_CARDS.map((card, i) => {
            const value = card.key === 'relationships'
              ? (graphStats?.relationships ?? graphStats?.rels ?? null)
              : (graphStats?.[card.key] ?? null)
            const hasData = value !== null && value > 0
            return (
              <button
                key={card.key}
                id={`stat-card-${card.key}`}
                onClick={() => hasData && setSelectedCard(card.key)}
                className={`stat-card glass-card p-4 text-center border ${card.border} animate-slide-up w-full
                  ${hasData ? 'cursor-pointer hover:border-white/15 hover:scale-[1.04]' : 'cursor-default opacity-70'}
                  transition-all duration-200 group relative overflow-hidden`}
                style={{ animationDelay: `${i * 60}ms` }}
                title={hasData ? `Click to explore ${card.label}` : ''}
              >
                {hasData && (
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                    style={{ background: `radial-gradient(ellipse at center, ${card.key === 'papers' ? 'rgba(97,114,243,0.1)' : card.key === 'methods' ? 'rgba(34,211,238,0.08)' : card.key === 'domains' ? 'rgba(167,139,250,0.08)' : card.key === 'datasets' ? 'rgba(251,191,36,0.08)' : card.key === 'results' ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.04)'} 0%, transparent 70%)` }}
                  />
                )}
                <div className={`w-10 h-10 rounded-xl ${card.bg} border ${card.border} flex items-center justify-center mx-auto mb-3 transition-transform duration-200 ${hasData ? 'group-hover:scale-110' : ''}`}>
                  <span className={`${card.color}`}>{card.icon}</span>
                </div>
                {value !== null ? (
                  <p className={`text-3xl font-bold font-display ${card.color} mb-1`}>{value}</p>
                ) : (
                  <div className="skeleton h-8 w-12 mx-auto mb-1" />
                )}
                <p className="text-xs text-slate-500 font-medium">{card.label}</p>
                {hasData && (
                  <p className="text-[10px] text-slate-600 mt-1 group-hover:text-slate-400 transition-colors">click to explore</p>
                )}
              </button>
            )
          })}
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">

          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={action.page}
                  onClick={() => setPage(action.page)}
                  className="glass-card p-5 text-left border border-white/5 hover:border-white/12 hover:scale-[1.02] transition-all duration-200 group relative overflow-hidden animate-slide-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {/* Hover glow */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                    style={{ background: `radial-gradient(ellipse at 20% 50%, ${action.glow} 0%, transparent 70%)` }}
                  />
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-200 shadow-md`}>
                      {action.icon}
                    </div>
                    <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-white mb-0.5">{action.label}</p>
                  <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">{action.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* System Health */}
          <div>
            <h2 className="text-lg font-bold text-white mb-4">System Health</h2>
            <div className="glass-card p-5 space-y-4">
              {[
                {
                  label: 'Graph Database',
                  value: health?.neo4j === 'connected' ? 'Neo4j Connected' : 'SQLite (Local)',
                  status: health?.neo4j === 'connected' ? 'success' : 'warning',
                },
                {
                  label: 'Gemini AI',
                  value: health?.gemini_key_set ? 'API Key Set' : 'No Key Found',
                  status: health?.gemini_key_set ? 'success' : 'danger',
                },
                {
                  label: 'Vector Store',
                  value: health?.chromadb_docs != null ? `${health.chromadb_docs} chunks` : 'Loading…',
                  status: 'success',
                },
                {
                  label: 'Papers Processed',
                  value: `${donePapers.length} done`,
                  status: donePapers.length > 0 ? 'success' : 'neutral',
                },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      item.status === 'success' ? 'bg-green-500' :
                      item.status === 'warning' ? 'bg-yellow-500' :
                      item.status === 'danger' ? 'bg-red-500' : 'bg-slate-600'
                    }`} />
                    <span className="text-sm text-slate-400">{item.label}</span>
                  </div>
                  <span className={`text-xs font-semibold ${
                    item.status === 'success' ? 'text-green-400' :
                    item.status === 'warning' ? 'text-yellow-400' :
                    item.status === 'danger' ? 'text-red-400' : 'text-slate-400'
                  }`}>
                    {item.value}
                  </span>
                </div>
              ))}

              {processingPapers.length > 0 && (
                <div className="pt-3 border-t border-white/5 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 border border-amber-500/30 border-t-amber-500 rounded-full animate-spin shrink-0" />
                  <p className="text-xs text-amber-400 font-medium">
                    {processingPapers.length} paper{processingPapers.length > 1 ? 's' : ''} currently processing…
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Papers */}
        {donePapers.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Recent Papers</h2>
              <button
                onClick={() => setPage('processing')}
                className="text-xs text-brand-400 hover:text-brand-300 transition-colors font-medium"
              >
                View all →
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {donePapers.slice(0, 6).map((paper, i) => (
                <div
                  key={paper.paper_id}
                  className="glass-card p-4 hover:border-white/10 transition-all duration-200 animate-slide-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-sm font-medium text-white leading-tight line-clamp-2 flex-1">
                      {paper.extraction?.title || paper.filename}
                    </p>
                    <span className="shrink-0 text-xs text-green-400 font-semibold">✓</span>
                  </div>
                  {paper.extraction?.year && (
                    <p className="text-xs text-slate-500 mb-2">{paper.extraction.year}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {paper.extraction?.methods?.slice(0, 2).map(m => (
                      <span key={m} className="badge-method">{m}</span>
                    ))}
                    {paper.extraction?.domains?.slice(0, 1).map(d => (
                      <span key={d} className="badge-domain">{d}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && papers.length === 0 && (
          <div className="glass-card p-16 text-center mt-4 animate-fade-in flex flex-col items-center">
            <RocketIcon className="text-slate-500 w-16 h-16 mb-6 animate-pulse-slow" />
            <h2 className="text-2xl font-bold text-white mb-3">Get Started</h2>
            <p className="text-slate-400 max-w-md mx-auto mb-8 text-sm">
              Upload your first batch of research papers to start building your knowledge graph and discovering research gaps.
            </p>
            <button
              onClick={() => setPage('upload')}
              className="btn-primary flex items-center gap-2 px-6 py-2.5"
            >
              <PaperIcon className="w-4 h-4 text-white" />
              Upload Papers
            </button>
          </div>
        )}
      </div>

      {/* Stat detail panel */}
      {selectedCard && (
        <StatDetailPanel type={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  )
}
