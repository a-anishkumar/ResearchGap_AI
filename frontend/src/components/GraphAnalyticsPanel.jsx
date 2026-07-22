/**
 * GraphAnalyticsPanel — slide-in left panel showing:
 *  - Top-5 most-connected Methods (by paper usage)
 *  - Top-5 most-targeted Domains
 *  - Top-5 most prolific Papers (by method+domain count)
 *  - Relationship type legend with counts
 */

const TYPE_META = {
  Paper:   { icon: '📄', color: '#6172f3' },
  Method:  { icon: '⚙️',  color: '#22d3ee' },
  Domain:  { icon: '🌐', color: '#a78bfa' },
  Dataset: { icon: '📊', color: '#fbbf24' },
}

const REL_TYPES = [
  { type: 'USES_METHOD',       color: '#6172f3', label: 'Uses Method'       },
  { type: 'APPLIES_TO_DOMAIN', color: '#a78bfa', label: 'Applies To Domain' },
  { type: 'EVALUATES_ON',      color: '#fbbf24', label: 'Evaluates On'      },
]

function RankedRow({ icon, label, count, maxCount, color, onClick }) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
  return (
    <button
      onClick={onClick}
      className="w-full text-left group flex items-center gap-2.5 px-3 py-2 rounded-xl
                 bg-surface-700/30 hover:bg-surface-600/50 border border-white/5
                 hover:border-white/10 transition-all mb-1"
    >
      <span className="text-base flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="text-xs text-slate-300 group-hover:text-white truncate transition-colors font-medium">
            {label}
          </span>
          <span className="text-[10px] font-semibold flex-shrink-0" style={{ color }}>
            {count}
          </span>
        </div>
        <div className="w-full bg-white/5 rounded-full overflow-hidden" style={{ height: '3px' }}>
          <div
            style={{ width: `${pct}%`, background: color, height: '3px', borderRadius: '2px', transition: 'width 0.6s ease' }}
          />
        </div>
      </div>
    </button>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">{title}</p>
      {children}
    </div>
  )
}

export default function GraphAnalyticsPanel({ graphData, graphStats, onClose, onZoomTo }) {
  if (!graphData?.nodes?.length) return null

  // Compute degree (number of connected links) per node
  const degreeMap = {}
  graphData.nodes.forEach(n => { degreeMap[n.id] = 0 })
  graphData.links?.forEach(l => {
    const s = typeof l.source === 'object' ? l.source.id : l.source
    const t = typeof l.target === 'object' ? l.target.id : l.target
    if (degreeMap[s] != null) degreeMap[s]++
    if (degreeMap[t] != null) degreeMap[t]++
  })

  const byType = (type) =>
    graphData.nodes
      .filter(n => n.type === type)
      .map(n => ({ ...n, degree: degreeMap[n.id] || 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 6)

  const topMethods  = byType('Method')
  const topDomains  = byType('Domain')
  const topPapers   = byType('Paper')
  const topDatasets = byType('Dataset')

  const maxMDeg  = topMethods[0]?.degree  || 1
  const maxDDeg  = topDomains[0]?.degree  || 1
  const maxPDeg  = topPapers[0]?.degree   || 1
  const maxDsDeg = topDatasets[0]?.degree || 1

  // Count relationships by type
  const relCounts = {}
  graphData.links?.forEach(l => {
    relCounts[l.type] = (relCounts[l.type] || 0) + 1
  })

  return (
    <div
      className="fixed top-16 left-0 h-[calc(100vh-64px)] w-80 z-40 panel-enter-left flex flex-col"
      style={{
        background: 'rgba(10,12,20,0.95)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '8px 0 40px rgba(0,0,0,0.5)',
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 flex items-center justify-between"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <div>
            <p className="text-sm font-semibold text-white">Graph Analytics</p>
            <p className="text-[10px] text-slate-500">Top connected entities</p>
          </div>
        </div>
        <button
          id="analytics-panel-close"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Stats summary */}
      {graphStats && (
        <div className="flex-shrink-0 px-4 py-3 grid grid-cols-2 gap-2"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {[
            { label: 'Papers',   val: graphStats.papers,        color: '#6172f3' },
            { label: 'Methods',  val: graphStats.methods,       color: '#22d3ee' },
            { label: 'Domains',  val: graphStats.domains,       color: '#a78bfa' },
            { label: 'Datasets', val: graphStats.datasets,      color: '#fbbf24' },
          ].map(s => (
            <div key={s.label}
                 className="px-2.5 py-2 rounded-xl bg-surface-700/40 border border-white/5 text-center">
              <p className="text-base font-bold" style={{ color: s.color }}>{s.val ?? '—'}</p>
              <p className="text-[10px] text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 panel-scroll px-4 py-4">

        {/* Relationship legend */}
        <Section title="Relationship Types">
          {REL_TYPES.map(r => (
            <div key={r.type} className="flex items-center gap-2.5 mb-2">
              <span className="rel-legend-line" style={{ background: r.color }} />
              <span className="text-xs text-slate-400">{r.label}</span>
              {relCounts[r.type] > 0 && (
                <span className="ml-auto text-[10px] font-semibold" style={{ color: r.color }}>
                  {relCounts[r.type]}
                </span>
              )}
            </div>
          ))}
        </Section>

        {/* Top Methods */}
        {topMethods.length > 0 && (
          <Section title={`Top Methods by Connectivity`}>
            {topMethods.map((n, i) => (
              <RankedRow
                key={n.id}
                icon="⚙️"
                label={n.label}
                count={n.degree}
                maxCount={maxMDeg}
                color={TYPE_META.Method.color}
                onClick={() => onZoomTo && onZoomTo(n.id, 'Method')}
              />
            ))}
          </Section>
        )}

        {/* Top Domains */}
        {topDomains.length > 0 && (
          <Section title={`Top Domains by Connectivity`}>
            {topDomains.map((n, i) => (
              <RankedRow
                key={n.id}
                icon="🌐"
                label={n.label}
                count={n.degree}
                maxCount={maxDDeg}
                color={TYPE_META.Domain.color}
                onClick={() => onZoomTo && onZoomTo(n.id, 'Domain')}
              />
            ))}
          </Section>
        )}

        {/* Top Papers */}
        {topPapers.length > 0 && (
          <Section title={`Most Connected Papers`}>
            {topPapers.map((n, i) => (
              <RankedRow
                key={n.id}
                icon="📄"
                label={n.label}
                count={n.degree}
                maxCount={maxPDeg}
                color={TYPE_META.Paper.color}
                onClick={() => onZoomTo && onZoomTo(n.id, 'Paper')}
              />
            ))}
          </Section>
        )}

        {/* Top Datasets */}
        {topDatasets.length > 0 && (
          <Section title={`Datasets by Usage`}>
            {topDatasets.map((n, i) => (
              <RankedRow
                key={n.id}
                icon="📊"
                label={n.label}
                count={n.degree}
                maxCount={maxDsDeg}
                color={TYPE_META.Dataset.color}
                onClick={() => onZoomTo && onZoomTo(n.id, 'Dataset')}
              />
            ))}
          </Section>
        )}

      </div>
    </div>
  )
}
