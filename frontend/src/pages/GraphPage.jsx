import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { forceCollide } from 'd3-force-3d'
import useStore from '../api/store'
import { getGraphData, getGraphStats } from '../api/client'
import NodeDetailPanel from '../components/NodeDetailPanel'
import GraphAnalyticsPanel from '../components/GraphAnalyticsPanel'
import NodeMergeModal from '../components/NodeMergeModal'
import { formatNodeLabel } from '../utils/textUtils'

/* ── Constants ──────────────────────────────────────────── */
const NODE_COLORS = {
  Paper:   '#6172f3',
  Method:  '#22d3ee',
  Domain:  '#a78bfa',
  Dataset: '#fbbf24',
  Result:  '#34d399',
}

const NODE_ICONS = {
  Paper:   '📄',
  Method:  '⚙',
  Domain:  '🌐',
  Dataset: '◈',
  Result:  '▲',
}

const LINK_COLORS = {
  USES_METHOD:       'rgba(97,114,243,0.55)',
  APPLIES_TO_DOMAIN: 'rgba(167,139,250,0.55)',
  EVALUATES_ON:      'rgba(251,191,36,0.45)',
  REPORTS:           'rgba(52,211,153,0.35)',
}

const LINK_PARTICLES = {
  USES_METHOD:       2,
  APPLIES_TO_DOMAIN: 2,
  EVALUATES_ON:      1,
  REPORTS:           1,
}

const LINK_PARTICLE_COLORS = {
  USES_METHOD:       '#818cf8',
  APPLIES_TO_DOMAIN: '#c4b5fd',
  EVALUATES_ON:      '#fde68a',
  REPORTS:           '#6ee7b7',
}

const FILTER_TYPES = ['All', 'Paper', 'Method', 'Domain', 'Dataset']

/* ── Helper: compute degree map ────────────────────────── */
function buildDegreeMap(nodes, links) {
  const map = {}
  nodes?.forEach(n => { map[n.id] = 0 })
  links?.forEach(l => {
    const s = typeof l.source === 'object' ? l.source.id : l.source
    const t = typeof l.target === 'object' ? l.target.id : l.target
    if (map[s] != null) map[s]++
    if (map[t] != null) map[t]++
  })
  return map
}

/* ── Main Component ─────────────────────────────────────── */
export default function GraphPage() {
  const { graphData, graphStats, setGraphData, setGraphStats } = useStore()

  const [loading, setLoading]             = useState(false)
  const [filter, setFilter]               = useState('All')
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchSuggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const [selectedNode, setSelectedNode]   = useState(null)   // clicked node
  const [hoveredNode, setHoveredNode]     = useState(null)   // hovered node id
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [neighborMode, setNeighborMode]   = useState(false)  // dim non-neighbors
  const [isCurationOpen, setIsCurationOpen] = useState(false)

  const graphRef  = useRef()
  const searchRef = useRef()

  /* ── Load data ── */
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

  /* ── Degree map ── */
  const degreeMap = useMemo(
    () => buildDegreeMap(graphData?.nodes, graphData?.links),
    [graphData]
  )
  const maxDegree = useMemo(
    () => Math.max(1, ...Object.values(degreeMap)),
    [degreeMap]
  )

  /* ── Neighbor set for selected node ── */
  const neighborIds = useMemo(() => {
    if (!selectedNode || !graphData?.links) return null
    const ids = new Set([selectedNode.id])
    graphData.links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source
      const t = typeof l.target === 'object' ? l.target.id : l.target
      if (s === selectedNode.id) ids.add(t)
      if (t === selectedNode.id) ids.add(s)
    })
    return ids
  }, [selectedNode, graphData])

  /* ── Filtered graph data ── */
  const filteredNodes = useMemo(() => {
    return graphData?.nodes?.filter(n => {
      const matchesFilter = filter === 'All' || n.type === filter
      const matchesSearch = !searchQuery.trim() ||
        n.label?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesFilter && matchesSearch
    }) || []
  }, [graphData, filter, searchQuery])

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes])

  const filteredLinks = useMemo(() =>
    graphData?.links?.filter(
      l => filteredNodeIds.has(typeof l.source === 'object' ? l.source.id : l.source) &&
           filteredNodeIds.has(typeof l.target === 'object' ? l.target.id : l.target)
    ) || [],
    [graphData, filteredNodeIds]
  )

  /* ── Sorted nodes for layering (selected/hovered/searched & high degree on top) ── */
  const sortedNodes = useMemo(() => {
    const nodes = [...filteredNodes]
    nodes.sort((a, b) => {
      const aLabel = formatNodeLabel(a.label || '')
      const bLabel = formatNodeLabel(b.label || '')
      const aActive = selectedNode?.id === a.id || hoveredNode === a.id ||
        (searchQuery.trim() && aLabel.toLowerCase().includes(searchQuery.toLowerCase()))
      const bActive = selectedNode?.id === b.id || hoveredNode === b.id ||
        (searchQuery.trim() && bLabel.toLowerCase().includes(searchQuery.toLowerCase()))

      if (aActive && !bActive) return 1
      if (!aActive && bActive) return -1

      const degA = degreeMap[a.id] || 0
      const degB = degreeMap[b.id] || 0
      return degA - degB
    })
    return nodes
  }, [filteredNodes, selectedNode, hoveredNode, searchQuery, degreeMap])

  /* ── Configure D3 force simulation spacing & label collision ── */
  useEffect(() => {
    if (!graphRef.current) return
    const fg = graphRef.current

    // 1. Force collision sized to pill label dimensions
    fg.d3Force('collide', forceCollide(node => {
      const label = formatNodeLabel(node.label || '')
      const approxWidth = Math.max(32, label.length * 6.5 + 24)
      const approxHeight = 22
      return Math.sqrt(Math.pow(approxWidth / 2, 2) + Math.pow(approxHeight / 2, 2)) + 6
    }).iterations(3))

    // 2. Stronger repulsion to separate dense clusters
    const chargeForce = fg.d3Force('charge')
    if (chargeForce) {
      chargeForce.strength(-450)
    }

    // 3. Dynamic link distance for central hub nodes
    const linkForce = fg.d3Force('link')
    if (linkForce) {
      linkForce.distance(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source
        const t = typeof l.target === 'object' ? l.target.id : l.target
        const sDeg = degreeMap[s] || 0
        const tDeg = degreeMap[t] || 0
        return 75 + Math.max(sDeg, tDeg) * 8
      })
    }

    fg.d3ReheatSimulation()
  }, [sortedNodes, filteredLinks, degreeMap])

  /* ── Search suggestions ── */
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const q = searchQuery.toLowerCase()
    const matches = graphData?.nodes
      ?.filter(n => formatNodeLabel(n.label)?.toLowerCase().includes(q))
      ?.slice(0, 8) || []
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }, [searchQuery, graphData])

  /* ── Zoom to node ── */
  const zoomToNode = useCallback((nodeId, nodeType) => {
    const node = graphData?.nodes?.find(n => n.id === nodeId)
    if (!node || !graphRef.current) return
    setSelectedNode({ id: nodeId, label: formatNodeLabel(node.label), type: nodeType || node.type })
    graphRef.current.centerAt(node.x, node.y, 800)
    graphRef.current.zoom(3.5, 800)
    setSearchQuery('')
    setShowSuggestions(false)
  }, [graphData])

  /* ── Node canvas painter ── */
  const paintNode = useCallback((node, ctx, globalScale) => {
    const deg     = degreeMap[node.id] || 0
    const normDeg = deg / maxDegree
    const fullLabel = formatNodeLabel(node.label || '')

    const isSelected  = selectedNode?.id === node.id
    const isHovered   = hoveredNode === node.id
    const isSearched  = searchQuery.trim() && fullLabel.toLowerCase().includes(searchQuery.toLowerCase())
    const isNeighbor  = neighborMode && neighborIds && neighborIds.has(node.id)
    const isFocused   = isSelected || isHovered || isSearched
    const isDimmed    = neighborMode && neighborIds && !neighborIds.has(node.id)
    const baseColor   = isSearched ? '#f59e0b' : NODE_COLORS[node.type] || '#22d3ee'
    const alpha       = isDimmed ? 0.15 : 1

    ctx.globalAlpha = alpha

    // --- LOD: Low zoom (< 0.6) dot fallback for non-important nodes ---
    if (globalScale < 0.6) {
      const isImportant = isFocused || isNeighbor || normDeg >= 0.4
      if (!isImportant) {
        const dotRadius = Math.max(3, 4 + normDeg * 4)
        ctx.shadowBlur = isFocused ? 12 : 2
        ctx.shadowColor = baseColor
        ctx.fillStyle = baseColor
        ctx.beginPath()
        ctx.arc(node.x, node.y, dotRadius, 0, 2 * Math.PI)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
        return
      }
    }

    // --- LOD: Truncate text on medium zoom (0.6 <= zoom < 1.4) unless focused ---
    let displayLabel = fullLabel
    if (globalScale >= 0.6 && globalScale < 1.4 && !isFocused) {
      displayLabel = fullLabel.length > 18 ? fullLabel.slice(0, 16) + '…' : fullLabel
    }

    const fontSize = Math.max(3.5, 9 / Math.max(0.5, globalScale * 0.4))
    ctx.font = `${isSelected ? '700' : '600'} ${fontSize}px Inter, system-ui, sans-serif`

    const textWidth  = ctx.measureText(displayLabel).width
    const paddingX   = 9 + normDeg * 6
    const paddingY   = 5 + normDeg * 3
    const rectWidth  = textWidth + paddingX * 2
    const rectHeight = fontSize + paddingY * 2
    const x = node.x - rectWidth / 2
    const y = node.y - rectHeight / 2
    const radius = 6

    // Glow / shadow
    ctx.shadowBlur  = isFocused ? 22 : 4 + normDeg * 8
    ctx.shadowColor = isSelected ? '#10b981' : isSearched ? '#f59e0b' : baseColor
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 1

    // Fill
    ctx.fillStyle = isSelected ? '#10b981' : isHovered ? lighten(baseColor) : baseColor
    ctx.beginPath()
    if (ctx.roundRect) {
      ctx.roundRect(x, y, rectWidth, rectHeight, radius)
    } else {
      ctx.rect(x, y, rectWidth, rectHeight)
    }
    ctx.fill()
    ctx.shadowBlur = 0

    // Border
    if (isSelected) {
      ctx.strokeStyle = '#6ee7b7'
      ctx.lineWidth = 1.5
      ctx.stroke()
    } else {
      ctx.strokeStyle = `rgba(255,255,255,${isDimmed ? 0.03 : 0.15 + normDeg * 0.1})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Text
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = isDimmed ? 'rgba(255,255,255,0.2)' : '#ffffff'
    ctx.fillText(displayLabel, node.x, node.y)
    ctx.globalAlpha  = 1
  }, [degreeMap, maxDegree, selectedNode, hoveredNode, searchQuery, neighborMode, neighborIds])

  /* ── Link canvas painter ── */
  const paintLink = useCallback((link, ctx, globalScale) => {
    const start = link.source
    const end   = link.target
    if (typeof start !== 'object' || typeof end !== 'object') return

    const isDimmed = neighborMode && neighborIds && !(
      neighborIds.has(start.id) && neighborIds.has(end.id)
    )

    if (isDimmed) return
    if (globalScale < 1.0) return  // skip link text below zoom 1.0x

    const label = link.type?.replace(/_/g, ' ') || ''
    const fontSize = Math.max(3, 7 / Math.max(0.5, globalScale * 0.4))
    ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`

    const mx = start.x + (end.x - start.x) / 2
    const my = start.y + (end.y - start.y) / 2

    const tw = ctx.measureText(label).width
    const rw = tw + 6
    const rh = fontSize + 3

    ctx.fillStyle = 'rgba(10, 12, 20, 0.82)'
    ctx.beginPath()
    if (ctx.roundRect) ctx.roundRect(mx - rw / 2, my - rh / 2, rw, rh, 3)
    else ctx.rect(mx - rw / 2, my - rh / 2, rw, rh)
    ctx.fill()

    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = 'rgba(255,255,255,0.55)'
    ctx.fillText(label, mx, my)
  }, [neighborMode, neighborIds])

  /* ── Lighten helper ── */
  function lighten(hex) {
    return hex
  }

  /* ── Node click ── */
  const handleNodeClick = useCallback((node) => {
    if (selectedNode?.id === node.id) {
      setSelectedNode(null)
    } else {
      setSelectedNode({ id: node.id, label: formatNodeLabel(node.label), type: node.type, properties: node.properties })
      if (graphRef.current) {
        graphRef.current.centerAt(node.x, node.y, 600)
        graphRef.current.zoom(3.0, 600)
      }
    }
  }, [selectedNode])

  /* ── Dismiss search dropdown on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (!searchRef.current?.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const graphWidth  = window.innerWidth  - (showAnalytics ? 320 : 0) - (selectedNode ? 384 : 0)
  const graphHeight = window.innerHeight - 148

  return (
    <div className="min-h-screen mesh-bg pt-20">

      {/* ── Top Controls Bar ── */}
      <div className="fixed top-16 left-0 right-0 z-40 graph-controls-bar px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">

          {/* Analytics Toggle */}
          <button
            id="toggle-analytics-btn"
            onClick={() => setShowAnalytics(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
              ${showAnalytics
                ? 'bg-brand-700/50 text-brand-200 border border-brand-600/50'
                : 'bg-surface-600 text-slate-400 hover:text-white border border-white/5'
              }`}
          >
            <span>📊</span>
            Analytics
          </button>

          {/* Curation Toggle */}
          <button
            id="toggle-curation-btn"
            onClick={() => setIsCurationOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-600 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 transition-all duration-150"
          >
            <span>🛠️</span>
            Curate Taxonomy
          </button>

          {/* Neighbor Highlight */}
          {selectedNode && (
            <button
              id="toggle-neighbor-btn"
              onClick={() => setNeighborMode(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
                ${neighborMode
                  ? 'bg-emerald-700/50 text-emerald-200 border border-emerald-600/50'
                  : 'bg-surface-600 text-slate-400 hover:text-white border border-white/5'
                }`}
            >
              <span>✦</span>
              {neighborMode ? 'Neighbors: ON' : 'Neighbors: OFF'}
            </button>
          )}

          {/* Divider */}
          <div className="w-px h-5 bg-white/10" />

          {/* Filter Buttons */}
          {FILTER_TYPES.map(t => {
            const count = t === 'All'
              ? graphData?.nodes?.length
              : graphData?.nodes?.filter(n => n.type === t).length
            return (
              <button
                key={t}
                id={`filter-${t.toLowerCase()}`}
                onClick={() => setFilter(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
                  ${filter === t
                    ? 'text-white shadow-sm'
                    : 'text-slate-500 bg-surface-600 hover:text-slate-300 border border-white/5'
                  }`}
                style={filter === t ? {
                  background: NODE_COLORS[t] || '#6172f3',
                  boxShadow: `0 0 10px ${NODE_COLORS[t] || '#6172f3'}50`,
                } : {}}
              >
                {t !== 'All' && <span>{NODE_ICONS[t]}</span>}
                {t}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold
                    ${filter === t ? 'bg-white/20' : 'bg-white/10 text-slate-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}

          {/* Divider */}
          <div className="w-px h-5 bg-white/10" />

          {/* Refresh */}
          <button
            id="refresh-graph-btn"
            onClick={loadGraph}
            disabled={loading}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                 fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
            </svg>
            {loading ? 'Loading…' : 'Refresh'}
          </button>

          {/* Search */}
          <div ref={searchRef} className="relative ml-auto">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500"
                   fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => searchSuggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Search nodes…"
                className="pl-8 pr-3 py-1.5 rounded-lg bg-surface-600 border border-white/10
                           text-white text-xs placeholder-slate-500 outline-none
                           focus:border-brand-500/60 transition-colors w-44"
              />
            </div>
            {/* Suggestions dropdown */}
            {showSuggestions && (
              <div className="absolute top-full mt-1.5 right-0 w-64 rounded-xl z-50 overflow-hidden animate-fade-in"
                   style={{ background: 'rgba(14,17,28,0.98)', border: '1px solid rgba(255,255,255,0.08)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
                {searchSuggestions.map(n => (
                  <button
                    key={n.id}
                    className="w-full text-left flex items-center gap-2.5 px-3 py-2.5
                               hover:bg-white/5 transition-colors text-xs text-slate-200"
                    onClick={() => zoomToNode(n.id, n.type)}
                  >
                    <span className="text-base flex-shrink-0">{NODE_ICONS[n.type]}</span>
                    <div className="min-w-0">
                      <p className="truncate text-slate-200">{formatNodeLabel(n.label)}</p>
                      <p className="text-[10px]" style={{ color: NODE_COLORS[n.type] }}>{n.type}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Legend Row ── */}
        <div className="flex items-center gap-5 mt-2 flex-wrap">
          {/* Node type legend */}
          {Object.entries(NODE_COLORS).map(([type, color]) => {
            const count = graphData?.nodes?.filter(n => n.type === type).length || 0
            return (
              <div key={type} className="flex items-center gap-1.5 text-xs text-slate-400">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span>{NODE_ICONS[type]} {type}</span>
                {count > 0 && <span className="text-slate-600">({count})</span>}
              </div>
            )
          })}
          <span className="text-xs text-slate-600 ml-auto">
            Scroll = zoom · Drag = pan · Click = details
          </span>
        </div>
      </div>

      {/* ── Analytics Panel (left) ── */}
      {showAnalytics && (
        <GraphAnalyticsPanel
          graphData={graphData}
          graphStats={graphStats}
          onClose={() => setShowAnalytics(false)}
          onZoomTo={zoomToNode}
        />
      )}

      {/* ── Graph Canvas ── */}
      <div
        className="pt-28 transition-all duration-300"
        style={{ marginLeft: showAnalytics ? 320 : 0, marginRight: selectedNode ? 384 : 0 }}
      >
        {loading && (
          <div className="flex items-center justify-center" style={{ height: graphHeight }}>
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-brand-700 border-t-brand-400 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Loading knowledge graph…</p>
              <p className="text-xs text-slate-600 mt-1">Fetching nodes and relationships</p>
            </div>
          </div>
        )}

        {!loading && (!graphData || sortedNodes.length === 0) && (
          <div className="flex items-center justify-center" style={{ height: graphHeight }}>
            <div className="text-center glass-card p-10 max-w-sm flex flex-col items-center animate-fade-in">
              <div className="text-5xl mb-4">🕸️</div>
              <p className="text-white font-semibold mb-2">
                {graphData ? 'No nodes match filters' : 'No graph data yet'}
              </p>
              <p className="text-slate-400 text-sm">
                {graphData
                  ? 'Try changing the filter or search query.'
                  : 'Upload and process papers first to build the knowledge graph.'}
              </p>
              {graphData && (
                <button
                  onClick={() => { setFilter('All'); setSearchQuery('') }}
                  className="mt-4 btn-secondary text-xs"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && sortedNodes.length > 0 && (
          <ForceGraph2D
            ref={graphRef}
            graphData={{ nodes: sortedNodes, links: filteredLinks }}

            // Node rendering
            nodeCanvasObject={paintNode}
            nodeCanvasObjectMode={() => 'replace'}

            // Link rendering
            linkCanvasObject={paintLink}
            linkCanvasObjectMode={() => 'after'}
            linkColor={l => {
              const s = typeof l.source === 'object' ? l.source.id : l.source
              const t = typeof l.target === 'object' ? l.target.id : l.target
              const isDimmed = neighborMode && neighborIds &&
                !(neighborIds.has(s) && neighborIds.has(t))
              if (isDimmed) return 'rgba(255,255,255,0.03)'
              return LINK_COLORS[l.type] || 'rgba(255,255,255,0.18)'
            }}
            linkWidth={l => {
              const s = typeof l.source === 'object' ? l.source.id : l.source
              const t = typeof l.target === 'object' ? l.target.id : l.target
              const isAdj = selectedNode && (s === selectedNode.id || t === selectedNode.id)
              return isAdj ? 2.5 : 1.5
            }}

            // Directed arrows
            linkDirectionalArrowLength={5}
            linkDirectionalArrowRelPos={0.65}
            linkDirectionalArrowColor={l => LINK_COLORS[l.type] || 'rgba(255,255,255,0.3)'}

            // Particle animation on links
            linkDirectionalParticles={l => LINK_PARTICLES[l.type] || 0}
            linkDirectionalParticleWidth={2.5}
            linkDirectionalParticleSpeed={0.005}
            linkDirectionalParticleColor={l => LINK_PARTICLE_COLORS[l.type] || '#fff'}

            // Background
            backgroundColor="transparent"
            width={graphWidth}
            height={graphHeight}

            // Events
            onNodeClick={handleNodeClick}
            onNodeHover={node => setHoveredNode(node ? node.id : null)}
            onBackgroundClick={() => {
              setSelectedNode(null)
              setNeighborMode(false)
            }}

            // Physics
            cooldownTicks={120}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        )}
      </div>

      {/* ── Node Detail Panel (right) ── */}
      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          onClose={() => { setSelectedNode(null); setNeighborMode(false) }}
          onZoomTo={zoomToNode}
        />
      )}

      {/* ── Selected node mini badge (bottom left) ── */}
      {selectedNode && !showAnalytics && (
        <div className="fixed bottom-6 left-6 z-40 animate-fade-in">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
            style={{
              background: 'rgba(14,17,28,0.95)',
              border: `1px solid ${NODE_COLORS[selectedNode.type] || '#6172f3'}50`,
              boxShadow: `0 4px 16px rgba(0,0,0,0.5)`,
            }}
          >
            <span>{NODE_ICONS[selectedNode.type]}</span>
            <span className="text-slate-300 max-w-[200px] truncate">{formatNodeLabel(selectedNode.label)}</span>
            <button
              onClick={() => setNeighborMode(v => !v)}
              className="ml-1 px-2 py-0.5 rounded-md text-[10px] font-bold transition-all"
              style={{
                background: neighborMode ? '#065f46' : 'rgba(255,255,255,0.08)',
                color: neighborMode ? '#6ee7b7' : '#94a3b8',
              }}
            >
              {neighborMode ? '✦ ON' : '✦ OFF'}
            </button>
          </div>
        </div>
      )}

      {/* Curation Modal */}
      <NodeMergeModal
        isOpen={isCurationOpen}
        onClose={() => setIsCurationOpen(false)}
        onMergeSuccess={loadGraph}
      />
    </div>
  )
}

