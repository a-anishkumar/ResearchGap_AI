import { useEffect, useState, useCallback } from 'react'
import { getNodeDetail } from '../api/client'
import { formatNodeLabel } from '../utils/textUtils'

const TYPE_META = {
  Paper:   { icon: '📄', color: '#6172f3', bg: 'rgba(97,114,243,0.12)',  border: 'rgba(97,114,243,0.3)',  label: 'Paper'   },
  Method:  { icon: '⚙️',  color: '#22d3ee', bg: 'rgba(34,211,238,0.1)',   border: 'rgba(34,211,238,0.3)',   label: 'Method'  },
  Domain:  { icon: '🌐', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)',  border: 'rgba(167,139,250,0.3)',  label: 'Domain'  },
  Dataset: { icon: '📊', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.3)',   label: 'Dataset' },
  Result:  { icon: '📈', color: '#34d399', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.3)',   label: 'Result'  },
}

const LINK_COLORS = {
  USES_METHOD:       '#6172f3',
  APPLIES_TO_DOMAIN: '#a78bfa',
  EVALUATES_ON:      '#fbbf24',
}

function Skeleton({ className = '' }) {
  return <div className={`skeleton h-4 rounded ${className}`} />
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2.5">{title}</p>
      {children}
    </div>
  )
}

function PaperRow({ paper, onZoom }) {
  return (
    <button
      onClick={() => onZoom && onZoom(paper.id, 'Paper')}
      className="w-full text-left group flex items-start gap-2.5 px-3 py-2.5 rounded-xl
                 bg-surface-700/40 hover:bg-brand-900/40 border border-white/5 hover:border-brand-700/40
                 transition-all duration-150 mb-1.5"
    >
      <span className="text-base leading-none mt-0.5 flex-shrink-0">📄</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-200 font-medium group-hover:text-white truncate transition-colors">
          {paper.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {paper.year && (
            <span className="text-[10px] text-slate-500">{paper.year}</span>
          )}
          {paper.authors?.length > 0 && (
            <span className="text-[10px] text-slate-600 truncate">
              {paper.authors.slice(0, 2).join(', ')}{paper.authors.length > 2 ? ' +more' : ''}
            </span>
          )}
        </div>
      </div>
      <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-brand-400 flex-shrink-0 mt-1 ml-auto transition-colors"
           fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </button>
  )
}

function TagChip({ label, color, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all hover:opacity-80 mb-1.5 mr-1.5"
      style={{ background: `${color}15`, borderColor: `${color}40`, color }}
    >
      {formatNodeLabel(label)}
      {count != null && (
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10">
          {count}
        </span>
      )}
    </button>
  )
}

export default function NodeDetailPanel({ node, onClose, onZoomTo }) {
  const [detail, setDetail]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const fetchDetail = useCallback(async () => {
    if (!node) return
    setLoading(true)
    setError(null)
    setDetail(null)
    try {
      const res = await getNodeDetail(node.id, node.type)
      setDetail(res.data)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load node detail')
    } finally {
      setLoading(false)
    }
  }, [node])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  if (!node) return null

  const meta = TYPE_META[node.type] || TYPE_META.Paper

  return (
    <div
      className="fixed top-0 right-0 h-full w-96 z-50 panel-enter flex flex-col"
      style={{
        background: 'rgba(10,12,20,0.96)',
        borderLeft: `1px solid ${meta.border}`,
        boxShadow: `-8px 0 40px rgba(0,0,0,0.6), -2px 0 0 ${meta.color}20`,
      }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-5 py-4 flex items-start justify-between gap-3"
        style={{
          background: meta.bg,
          borderBottom: `1px solid ${meta.border}`,
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl leading-none flex-shrink-0">{meta.icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}
              >
                {meta.label}
              </span>
            </div>
            <p className="text-sm font-semibold text-white leading-snug truncate">
              {formatNodeLabel(node.label)}
            </p>
          </div>
        </div>
        <button
          id="node-panel-close"
          onClick={onClose}
          className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 panel-scroll px-5 py-5">
        {loading && (
          <div className="space-y-4">
            <Skeleton className="w-3/4" />
            <Skeleton className="w-full" />
            <Skeleton className="w-2/3" />
            <Skeleton className="w-full h-16 rounded-xl" />
            <Skeleton className="w-full h-16 rounded-xl" />
            <Skeleton className="w-full h-16 rounded-xl" />
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-900/20 border border-red-700/30 text-xs text-red-300">
            {error}
          </div>
        )}

        {!loading && detail && node.type === 'Paper' && (
          <PaperDetail detail={detail} onZoom={onZoomTo} />
        )}
        {!loading && detail && node.type === 'Method' && (
          <MethodDetail detail={detail} onZoom={onZoomTo} />
        )}
        {!loading && detail && node.type === 'Domain' && (
          <DomainDetail detail={detail} onZoom={onZoomTo} />
        )}
        {!loading && detail && node.type === 'Dataset' && (
          <DatasetDetail detail={detail} onZoom={onZoomTo} />
        )}
      </div>
    </div>
  )
}

/* ── Paper Detail ── */
function PaperDetail({ detail, onZoom }) {
  return (
    <>
      {/* Title */}
      <Section title="Title">
        <p className="text-sm text-white font-medium leading-relaxed">{detail.title}</p>
      </Section>

      {/* Meta row */}
      <Section title="Metadata">
        <div className="grid grid-cols-2 gap-2">
          {detail.year && (
            <div className="px-3 py-2 rounded-xl bg-surface-700/50 border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Year</p>
              <p className="text-sm font-semibold text-white">{detail.year}</p>
            </div>
          )}
          <div className="px-3 py-2 rounded-xl bg-surface-700/50 border border-white/5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Methods</p>
            <p className="text-sm font-semibold text-cyan-400">{detail.method_count}</p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-surface-700/50 border border-white/5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Domains</p>
            <p className="text-sm font-semibold text-purple-400">{detail.domain_count}</p>
          </div>
          {detail.datasets?.length > 0 && (
            <div className="px-3 py-2 rounded-xl bg-surface-700/50 border border-white/5">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Datasets</p>
              <p className="text-sm font-semibold text-amber-400">{detail.datasets.length}</p>
            </div>
          )}
        </div>
      </Section>

      {/* Authors */}
      {detail.authors?.length > 0 && (
        <Section title={`Authors (${detail.authors.length})`}>
          <div className="flex flex-wrap gap-1.5">
            {detail.authors.map((a, i) => (
              <span key={i} className="px-2.5 py-1 rounded-lg text-xs bg-surface-600/60 border border-white/5 text-slate-300">
                {a}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Methods */}
      {detail.methods?.length > 0 && (
        <Section title={`Methods Used (${detail.methods.length})`}>
          <div className="flex flex-wrap">
            {detail.methods.map((m, i) => (
              <TagChip
                key={i}
                label={m}
                color={TYPE_META.Method.color}
                onClick={() => onZoom && onZoom(m, 'Method')}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Domains */}
      {detail.domains?.length > 0 && (
        <Section title={`Application Domains (${detail.domains.length})`}>
          <div className="flex flex-wrap">
            {detail.domains.map((d, i) => (
              <TagChip
                key={i}
                label={d}
                color={TYPE_META.Domain.color}
                onClick={() => onZoom && onZoom(d, 'Domain')}
              />
            ))}
          </div>
        </Section>
      )}

      {/* Datasets */}
      {detail.datasets?.length > 0 && (
        <Section title={`Datasets Evaluated (${detail.datasets.length})`}>
          <div className="flex flex-wrap">
            {detail.datasets.map((ds, i) => (
              <TagChip key={i} label={ds} color={TYPE_META.Dataset.color} />
            ))}
          </div>
        </Section>
      )}

      {/* Results */}
      {detail.results?.length > 0 && (
        <Section title={`Reported Results (${detail.results.length})`}>
          <div className="space-y-1.5">
            {detail.results.slice(0, 6).map((r, i) => (
              <div key={i} className="px-3 py-2 rounded-xl bg-surface-700/40 border border-white/5 text-xs">
                <span className="text-emerald-400 font-semibold">{r.metric}:</span>
                <span className="text-white ml-1.5">{r.value}</span>
                {r.description && <p className="text-slate-500 mt-0.5 text-[10px]">{r.description}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}

/* ── Method Detail ── */
function MethodDetail({ detail, onZoom }) {
  return (
    <>
      <Section title="Method Name">
        <p className="text-lg font-bold text-cyan-400">{detail.name}</p>
      </Section>

      <div className="px-4 py-3 rounded-xl bg-cyan-900/20 border border-cyan-700/30 mb-5 flex items-center gap-3">
        <span className="text-2xl">⚙️</span>
        <div>
          <p className="text-xl font-bold text-white">{detail.paper_count}</p>
          <p className="text-xs text-slate-400">papers use this method</p>
        </div>
      </div>

      {detail.co_domains?.length > 0 && (
        <Section title={`Applied To Domains (${detail.co_domains.length})`}>
          <div className="space-y-1.5">
            {detail.co_domains.map((d, i) => {
              const max = detail.co_domains[0]?.count || 1
              const pct = Math.round((d.count / max) * 100)
              return (
                <button
                  key={i}
                  onClick={() => onZoom && onZoom(d.name, 'Domain')}
                  className="w-full text-left px-3 py-2 rounded-xl bg-surface-700/40 hover:bg-purple-900/30
                             border border-white/5 hover:border-purple-700/40 transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-200 group-hover:text-white transition-colors truncate font-medium">
                      🌐 {d.name}
                    </span>
                    <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2">{d.count} papers</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full overflow-hidden" style={{ height: '3px' }}>
                    <div className="conn-bar bg-purple-500" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              )
            })}
          </div>
        </Section>
      )}

      <Section title={`Papers Using This Method (${detail.papers?.length})`}>
        <div className="space-y-0">
          {detail.papers?.map((p, i) => (
            <PaperRow key={i} paper={p} onZoom={onZoom} />
          ))}
        </div>
      </Section>
    </>
  )
}

/* ── Domain Detail ── */
function DomainDetail({ detail, onZoom }) {
  return (
    <>
      <Section title="Domain Name">
        <p className="text-lg font-bold text-purple-400">{detail.name}</p>
      </Section>

      <div className="px-4 py-3 rounded-xl bg-purple-900/20 border border-purple-700/30 mb-5 flex items-center gap-3">
        <span className="text-2xl">🌐</span>
        <div>
          <p className="text-xl font-bold text-white">{detail.paper_count}</p>
          <p className="text-xs text-slate-400">papers target this domain</p>
        </div>
      </div>

      {detail.co_methods?.length > 0 && (
        <Section title={`Methods Used Across Papers (${detail.co_methods.length})`}>
          <div className="space-y-1.5">
            {detail.co_methods.map((m, i) => {
              const max = detail.co_methods[0]?.count || 1
              const pct = Math.round((m.count / max) * 100)
              return (
                <button
                  key={i}
                  onClick={() => onZoom && onZoom(m.name, 'Method')}
                  className="w-full text-left px-3 py-2 rounded-xl bg-surface-700/40 hover:bg-cyan-900/30
                             border border-white/5 hover:border-cyan-700/40 transition-all group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-200 group-hover:text-white transition-colors truncate font-medium">
                      ⚙️ {m.name}
                    </span>
                    <span className="text-[10px] text-slate-500 flex-shrink-0 ml-2">{m.count} papers</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full overflow-hidden" style={{ height: '3px' }}>
                    <div className="conn-bar bg-cyan-500" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              )
            })}
          </div>
        </Section>
      )}

      <Section title={`Papers Targeting This Domain (${detail.papers?.length})`}>
        <div className="space-y-0">
          {detail.papers?.map((p, i) => (
            <PaperRow key={i} paper={p} onZoom={onZoom} />
          ))}
        </div>
      </Section>
    </>
  )
}

/* ── Dataset Detail ── */
function DatasetDetail({ detail, onZoom }) {
  return (
    <>
      <Section title="Dataset Name">
        <p className="text-lg font-bold text-amber-400">{detail.name}</p>
      </Section>

      <div className="px-4 py-3 rounded-xl bg-amber-900/20 border border-amber-700/30 mb-5 flex items-center gap-3">
        <span className="text-2xl">📊</span>
        <div>
          <p className="text-xl font-bold text-white">{detail.paper_count}</p>
          <p className="text-xs text-slate-400">papers evaluate on this dataset</p>
        </div>
      </div>

      <Section title={`Papers Evaluating on This Dataset (${detail.papers?.length})`}>
        <div className="space-y-0">
          {detail.papers?.map((p, i) => (
            <PaperRow key={i} paper={p} onZoom={onZoom} />
          ))}
        </div>
      </Section>
    </>
  )
}
