import { useEffect, useRef, useState, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import useStore from '../api/store'
import { getGraphData, getGraphStats } from '../api/client'

const NODE_COLORS = {
  Paper:   '#6172f3',
  Method:  '#22d3ee',
  Domain:  '#a78bfa',
  Dataset: '#fbbf24',
  Result:  '#34d399',
}

const NODE_SIZES = {
  Paper: 6, Method: 5, Domain: 5, Dataset: 4, Result: 4,
}

const LINK_COLORS = {
  USES_METHOD:       'rgba(97,114,243,0.4)',
  APPLIES_TO_DOMAIN: 'rgba(167,139,250,0.4)',
  EVALUATES_ON:      'rgba(251,191,36,0.3)',
  REPORTS:           'rgba(52,211,153,0.3)',
}

export default function GraphPage() {
  const { graphData, graphStats, setGraphData, setGraphStats } = useStore()
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('All')
  const [tooltip, setTooltip] = useState(null)
  const graphRef = useRef()

  const loadGraph = useCallback(async () => {
    setLoading(true)
    try {
      const [dataRes, statsRes] = await Promise.all([getGraphData(), getGraphStats()])
      setGraphData(dataRes.data)
      setGraphStats(statsRes.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [setGraphData, setGraphStats])

  useEffect(() => {
    if (!graphData) loadGraph()
  }, [graphData, loadGraph])

  const filteredNodes = graphData?.nodes?.filter(
    n => filter === 'All' || n.type === filter
  ) || []

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id))

  const filteredLinks = graphData?.links?.filter(
    l => filteredNodeIds.has(l.source) || filteredNodeIds.has(l.target)
  ) || []

  const paintNode = useCallback((node, ctx, globalScale) => {
    const color = NODE_COLORS[node.type] || '#6b7280'
    const radius = (NODE_SIZES[node.type] || 4)

    // Glow
    ctx.shadowBlur = 12
    ctx.shadowColor = color

    // Circle
    ctx.beginPath()
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()

    ctx.shadowBlur = 0

    // Label at zoom >= 3
    if (globalScale >= 2.5) {
      const label = node.label?.slice(0, 20) || ''
      ctx.font = `${5 / globalScale}px Inter`
      ctx.textAlign = 'center'
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillText(label, node.x, node.y + radius + 3 / globalScale)
    }
  }, [])

  return (
    <div className="min-h-screen mesh-bg pt-20">
      {/* Controls */}
      <div className="fixed top-16 left-0 right-0 z-40 px-6 py-3 bg-surface-900/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Stats */}
          {graphStats && (
            <div className="flex items-center gap-4">
              {[
                { label: 'Papers',  value: graphStats.papers,  color: 'text-brand-400' },
                { label: 'Methods', value: graphStats.methods,  color: 'text-cyan-400' },
                { label: 'Domains', value: graphStats.domains,  color: 'text-purple-400' },
                { label: 'Datasets',value: graphStats.datasets, color: 'text-amber-400' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filter buttons */}
          <div className="flex items-center gap-2">
            {['All', 'Paper', 'Method', 'Domain', 'Dataset'].map(t => (
              <button
                key={t}
                id={`filter-${t.toLowerCase()}`}
                onClick={() => setFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
                  ${filter === t
                    ? 'text-white'
                    : 'text-slate-500 bg-surface-600 hover:text-slate-300'
                  }`}
                style={filter === t ? {
                  background: NODE_COLORS[t] || '#6172f3',
                  boxShadow: `0 0 10px ${NODE_COLORS[t] || '#6172f3'}50`,
                } : {}}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            id="refresh-graph-btn"
            onClick={loadGraph}
            disabled={loading}
            className="btn-secondary text-xs"
          >
            {loading ? '⟳ Loading…' : '↺ Refresh'}
          </button>
        </div>

        {/* Legend */}
        <div className="max-w-6xl mx-auto flex items-center gap-4 mt-2">
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-3 h-3 rounded-full" style={{ background: color }} />
              {type}
            </div>
          ))}
          <span className="text-xs text-slate-600 ml-auto">Scroll to zoom · Drag to pan · Zoom in for labels</span>
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="pt-28">
        {loading && (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-brand-700 border-t-brand-400 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Loading knowledge graph…</p>
            </div>
          </div>
        )}

        {!loading && (!graphData || filteredNodes.length === 0) && (
          <div className="flex items-center justify-center h-96">
            <div className="text-center glass-card p-8 max-w-sm">
              <div className="text-5xl mb-4">🕸️</div>
              <p className="text-white font-semibold mb-2">No graph data yet</p>
              <p className="text-slate-400 text-sm">Upload and process papers first to build the knowledge graph.</p>
            </div>
          </div>
        )}

        {!loading && filteredNodes.length > 0 && (
          <ForceGraph2D
            ref={graphRef}
            graphData={{ nodes: filteredNodes, links: filteredLinks }}
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => 'replace'}
            linkColor={l => LINK_COLORS[l.type] || 'rgba(255,255,255,0.1)'}
            linkWidth={1}
            backgroundColor="transparent"
            width={window.innerWidth}
            height={window.innerHeight - 140}
            onNodeHover={(node) => {
              if (node) {
                setTooltip({
                  label: node.label,
                  type: node.type,
                  props: node.properties,
                })
              } else {
                setTooltip(null)
              }
            }}
            cooldownTicks={100}
            d3AlphaDecay={0.02}
          />
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed bottom-6 left-6 z-50 graph-tooltip max-w-xs animate-fade-in">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: NODE_COLORS[tooltip.type] }}
            />
            <span className="font-semibold text-white text-xs">{tooltip.type}</span>
          </div>
          <p className="text-slate-200">{tooltip.label}</p>
          {tooltip.props?.year && (
            <p className="text-slate-500 text-xs mt-0.5">Year: {tooltip.props.year}</p>
          )}
          {tooltip.props?.authors?.length > 0 && (
            <p className="text-slate-500 text-xs truncate">
              Authors: {tooltip.props.authors.slice(0, 2).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
