/**
 * StatDetailPanel — slide-over panel showing full entity lists when a Dashboard stat card is clicked.
 * Supports: papers | methods | domains | datasets | results | relationships
 */
import { useEffect, useState } from 'react'
import { getEntities } from '../api/client'
import useStore from '../api/store'

// ── Clean Vector Icons ────────────────────────────────────────────────────────
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

function CalendarIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function GraphIcon({ className = "w-12 h-12" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )
}

// ──────────────────────────────────────────────
// Sub-renderers
// ──────────────────────────────────────────────

function PaperItem({ paper, onView }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-surface-600/50 border border-white/5 hover:border-white/10 transition-all group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate leading-snug">
          {paper.title || paper.filename}
        </p>
        {paper.authors?.length > 0 && (
          <p className="text-xs text-slate-500 truncate mt-0.5">{paper.authors.slice(0, 2).join(', ')}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {paper.year && (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <CalendarIcon className="w-3 h-3 text-slate-500" />
              {paper.year}
            </span>
          )}
          <span className="text-xs text-cyan-400 flex items-center gap-1">
            <MethodIcon className="w-3 h-3 text-cyan-400" />
            {paper.method_count} methods
          </span>
          <span className="text-xs text-purple-400 flex items-center gap-1">
            <DomainIcon className="w-3 h-3 text-purple-400" />
            {paper.domain_count} domains
          </span>
        </div>
      </div>
      {onView && (
        <button
          onClick={() => onView(paper)}
          className="shrink-0 text-xs px-2 py-1 rounded-lg text-slate-500 hover:text-brand-300 hover:bg-brand-900/40 transition-all opacity-0 group-hover:opacity-100 font-medium"
        >
          View →
        </button>
      )}
    </div>
  )
}

const normalizePaper = (p) => {
  if (!p) return { paper_id: '', title: 'Unknown Paper' }
  if (typeof p === 'string') return { paper_id: p, title: p }
  return {
    paper_id: p.paper_id || p.id || p.title || '',
    title: p.title || p.filename || p.paper_id || 'Untitled Paper'
  }
}

function EntityItem({ name, count, papers, color, icon, onSelectPaper }) {
  const [open, setOpen] = useState(false)
  const normalizedPapers = (papers || []).map(normalizePaper)

  const p0 = normalizedPapers[0]
  const badgeLabel = !p0
    ? '0 papers'
    : normalizedPapers.length === 1
      ? p0.title
      : `${p0.title} +${normalizedPapers.length - 1} more`

  return (
    <div className="rounded-xl border border-white/5 overflow-hidden">
      <div className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface-600/50 hover:bg-surface-500/50 transition-all">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          <span className="shrink-0">{icon}</span>
          <span className={`text-sm font-medium ${color} truncate`}>{name}</span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {p0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (normalizedPapers.length === 1) {
                  if (onSelectPaper) onSelectPaper(p0)
                } else {
                  setOpen(v => !v)
                }
              }}
              title={p0.title}
              className="text-xs font-semibold text-brand-300 bg-brand-950/60 border border-brand-500/30 px-2.5 py-1 rounded-full max-w-[200px] truncate hover:bg-brand-900/80 hover:text-white transition-all cursor-pointer flex items-center gap-1"
            >
              <svg className="w-3 h-3 text-brand-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate">{badgeLabel}</span>
            </button>
          )}

          <button
            onClick={() => setOpen(v => !v)}
            className="text-xs text-slate-400 hover:text-white p-1"
          >
            <span className={`inline-block transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>›</span>
          </button>
        </div>
      </div>

      {open && normalizedPapers.length > 0 && (
        <div className="px-4 py-3 bg-surface-700/30 space-y-1.5 border-t border-white/5 animate-fade-in">
          {normalizedPapers.map((p, i) => (
            <button
              key={i}
              onClick={() => onSelectPaper && onSelectPaper(p)}
              className="w-full text-left text-xs text-slate-300 hover:text-brand-300 flex items-start gap-1.5 group transition-colors"
            >
              <span className="text-brand-400 shrink-0 mt-0.5">•</span>
              <span className="leading-snug group-hover:underline">{p.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ResultItem({ metric, value, description, papers, onSelectPaper }) {
  const [open, setOpen] = useState(false)
  const normalizedPapers = (papers || []).map(normalizePaper)

  const p0 = normalizedPapers[0]
  const badgeLabel = !p0
    ? '0 papers'
    : normalizedPapers.length === 1
      ? p0.title
      : `${p0.title} +${normalizedPapers.length - 1} more`

  return (
    <div className="rounded-xl border border-white/5 overflow-hidden">
      <div className="w-full flex items-start justify-between gap-3 px-4 py-3 bg-surface-600/50 hover:bg-surface-500/50 transition-all text-left">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold text-green-400">{metric}</span>
            <span className="text-sm text-white font-bold">{value}</span>
          </div>
          {description && <p className="text-xs text-slate-500 mt-0.5 truncate">{description}</p>}
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {p0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (normalizedPapers.length === 1) {
                  if (onSelectPaper) onSelectPaper(p0)
                } else {
                  setOpen(v => !v)
                }
              }}
              title={p0.title}
              className="text-xs font-semibold text-brand-300 bg-brand-950/60 border border-brand-500/30 px-2.5 py-1 rounded-full max-w-[200px] truncate hover:bg-brand-900/80 hover:text-white transition-all cursor-pointer flex items-center gap-1"
            >
              <svg className="w-3 h-3 text-brand-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="truncate">{badgeLabel}</span>
            </button>
          )}

          <button
            onClick={() => setOpen(v => !v)}
            className="text-xs text-slate-400 hover:text-white p-1"
          >
            <span className={`inline-block transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>›</span>
          </button>
        </div>
      </div>

      {open && normalizedPapers.length > 0 && (
        <div className="px-4 py-3 bg-surface-700/30 space-y-1.5 border-t border-white/5 animate-fade-in">
          {normalizedPapers.map((p, i) => (
            <button
              key={i}
              onClick={() => onSelectPaper && onSelectPaper(p)}
              className="w-full text-left text-xs text-slate-300 hover:text-brand-300 flex items-start gap-1.5 group transition-colors"
            >
              <span className="text-brand-400 shrink-0 mt-0.5">•</span>
              <span className="leading-snug group-hover:underline">{p.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


// ──────────────────────────────────────────────
// Config for each card type
// ──────────────────────────────────────────────

const PANEL_CONFIG = {
  papers: {
    title: 'All Papers',
    icon: <PaperIcon />,
    color: 'text-brand-400',
    emptyText: 'No papers uploaded yet.',
    emptyIcon: <PaperIcon className="w-12 h-12 mx-auto text-slate-500" />,
  },
  methods: {
    title: 'All Methods',
    icon: <MethodIcon />,
    color: 'text-cyan-400',
    emptyText: 'No methods extracted yet.',
    emptyIcon: <MethodIcon className="w-12 h-12 mx-auto text-slate-500" />,
    entityColor: 'text-cyan-300',
    entityIcon: <MethodIcon className="w-4 h-4 text-cyan-400" />,
  },
  domains: {
    title: 'All Domains',
    icon: <DomainIcon />,
    color: 'text-purple-400',
    emptyText: 'No domains extracted yet.',
    emptyIcon: <DomainIcon className="w-12 h-12 mx-auto text-slate-500" />,
    entityColor: 'text-purple-300',
    entityIcon: <DomainIcon className="w-4 h-4 text-purple-400" />,
  },
  datasets: {
    title: 'All Datasets',
    icon: <DatasetIcon />,
    color: 'text-amber-400',
    emptyText: 'No datasets found yet.',
    emptyIcon: <DatasetIcon className="w-12 h-12 mx-auto text-slate-500" />,
    entityColor: 'text-amber-300',
    entityIcon: <DatasetIcon className="w-4 h-4 text-amber-400" />,
  },
  results: {
    title: 'All Results & Metrics',
    icon: <ChartIcon />,
    color: 'text-green-400',
    emptyText: 'No results extracted yet.',
    emptyIcon: <ChartIcon className="w-12 h-12 mx-auto text-slate-500" />,
  },
  relationships: {
    title: 'Graph Relationships',
    icon: <LinkIcon />,
    color: 'text-slate-300',
  },
}

// ──────────────────────────────────────────────
// Main panel
// ──────────────────────────────────────────────

export default function StatDetailPanel({ type, onClose }) {
  const { setSelectedPaper, setPage } = useStore()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  const cfg = PANEL_CONFIG[type] || PANEL_CONFIG.papers

  useEffect(() => {
    setLoading(true)
    getEntities()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [type])

  const handleViewPaper = (paper) => {
    setSelectedPaper(paper)
    setPage('processing')
    onClose()
  }

  // ── Filter helpers ──
  const filterText = search.trim().toLowerCase()

  const filteredPapers = (data?.papers || []).filter(p =>
    !filterText ||
    p.title?.toLowerCase().includes(filterText) ||
    p.authors?.some(a => a.toLowerCase().includes(filterText)) ||
    String(p.year || '').includes(filterText)
  )
  const filteredMethods = (data?.methods || []).filter(m =>
    !filterText || m.name.toLowerCase().includes(filterText)
  )
  const filteredDomains = (data?.domains || []).filter(d =>
    !filterText || d.name.toLowerCase().includes(filterText)
  )
  const filteredDatasets = (data?.datasets || []).filter(d =>
    !filterText || d.name.toLowerCase().includes(filterText)
  )
  const filteredResults = (data?.results || []).filter(r =>
    !filterText ||
    r.metric?.toLowerCase().includes(filterText) ||
    r.value?.toLowerCase().includes(filterText) ||
    r.description?.toLowerCase().includes(filterText)
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-surface-900 border-l border-white/5 flex flex-col shadow-2xl"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`text-xl ${cfg.color}`}>{cfg.icon}</div>
            <h2 className={`text-lg font-bold ${cfg.color}`}>{cfg.title}</h2>
            {!loading && data && (
              <span className="text-xs text-slate-500 bg-surface-600 px-2 py-0.5 rounded-full">
                {type === 'papers' ? filteredPapers.length
                  : type === 'methods' ? filteredMethods.length
                  : type === 'domains' ? filteredDomains.length
                  : type === 'datasets' ? filteredDatasets.length
                  : type === 'results' ? filteredResults.length
                  : 0}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none p-1 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-white/5 shrink-0">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${cfg.title.toLowerCase()}…`}
            className="input-base text-sm py-2"
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {loading && (
            <div className="space-y-3 animate-fade-in">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="skeleton h-14 rounded-xl" />
              ))}
            </div>
          )}

          {/* PAPERS */}
          {!loading && type === 'papers' && (
            filteredPapers.length === 0
              ? <EmptyState cfg={cfg} filtered={!!filterText} />
              : filteredPapers.map(p => (
                  <PaperItem
                    key={p.paper_id}
                    paper={p}
                    onView={handleViewPaper}
                  />
                ))
          )}

          {/* METHODS */}
          {!loading && type === 'methods' && (
            filteredMethods.length === 0
              ? <EmptyState cfg={cfg} filtered={!!filterText} />
              : filteredMethods.map(m => (
                  <EntityItem
                    key={m.name}
                    name={m.name}
                    count={m.count}
                    papers={m.papers}
                    color={cfg.entityColor}
                    icon={cfg.entityIcon}
                    onSelectPaper={handleViewPaper}
                  />
                ))
          )}

          {/* DOMAINS */}
          {!loading && type === 'domains' && (
            filteredDomains.length === 0
              ? <EmptyState cfg={cfg} filtered={!!filterText} />
              : filteredDomains.map(d => (
                  <EntityItem
                    key={d.name}
                    name={d.name}
                    count={d.count}
                    papers={d.papers}
                    color={cfg.entityColor}
                    icon={cfg.entityIcon}
                    onSelectPaper={handleViewPaper}
                  />
                ))
          )}

          {/* DATASETS */}
          {!loading && type === 'datasets' && (
            filteredDatasets.length === 0
              ? <EmptyState cfg={cfg} filtered={!!filterText} />
              : filteredDatasets.map(d => (
                  <EntityItem
                    key={d.name}
                    name={d.name}
                    count={d.count}
                    papers={d.papers}
                    color={cfg.entityColor}
                    icon={cfg.entityIcon}
                    onSelectPaper={handleViewPaper}
                  />
                ))
          )}

          {/* RESULTS */}
          {!loading && type === 'results' && (
            filteredResults.length === 0
              ? <EmptyState cfg={cfg} filtered={!!filterText} />
              : filteredResults.map((r, i) => (
                  <ResultItem key={i} {...r} onSelectPaper={handleViewPaper} />
                ))
          )}


          {/* RELATIONSHIPS — navigate to graph */}
          {!loading && type === 'relationships' && (
            <div className="glass-card p-8 text-center flex flex-col items-center justify-center">
              <GraphIcon className="w-12 h-12 text-slate-500 mb-4" />
              <p className="text-white font-semibold mb-2">View the Knowledge Graph</p>
              <p className="text-slate-400 text-sm mb-6 max-w-sm">
                Explore all {data?.methods?.length || 0} method–paper links,{' '}
                {data?.domains?.length || 0} domain–paper links interactively.
              </p>
              <button
                onClick={() => { setPage('graph'); onClose() }}
                className="btn-primary flex items-center gap-2"
              >
                <LinkIcon className="w-4 h-4 text-white" />
                Open Knowledge Graph
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 shrink-0">
          <button onClick={onClose} className="btn-secondary w-full justify-center text-sm">
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}

function EmptyState({ cfg, filtered }) {
  return (
    <div className="glass-card p-10 text-center flex flex-col items-center justify-center">
      <div className="mb-3">{cfg.emptyIcon || cfg.icon}</div>
      <p className="text-white font-semibold mb-1">
        {filtered ? 'No matches found' : cfg.emptyText}
      </p>
      {!filtered && (
        <p className="text-slate-500 text-sm">Process some papers first to see data here.</p>
      )}
    </div>
  )
}
