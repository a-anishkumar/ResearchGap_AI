import { useState, useEffect } from 'react'
import { getTimeline } from '../api/client'
import PaperDetailDrawer from '../components/PaperDetailDrawer'
import { useToast } from '../components/Toast'

// Method/Domain color palette matching GraphPage.jsx
const METHOD_COLORS = ['#6172f3', '#22d3ee', '#34d399', '#a78bfa', '#f43f5e', '#fbbf24']

function getColorForTag(tag = '') {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return METHOD_COLORS[Math.abs(hash) % METHOD_COLORS.length]
}

export default function TimelineView() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [papers, setPapers] = useState([])
  const [scaleType, setScaleType] = useState('linear') // 'linear' | 'log'
  const [selectedPaperId, setSelectedPaperId] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [hoveredPaper, setHoveredPaper] = useState(null)

  useEffect(() => {
    setLoading(true)
    getTimeline()
      .then(res => {
        setPapers(res.data.papers || [])
      })
      .catch(err => {
        toast?.error(`Timeline error: ${err.message}`)
      })
      .finally(() => setLoading(false))
  }, [])

  // Calculate year range
  const years = papers.map(p => p.year || 2024)
  const minYear = years.length ? Math.min(...years) - 1 : 2018
  const maxYear = years.length ? Math.max(...years) + 1 : 2026

  // Calculate citation max
  const maxCitations = papers.length ? Math.max(...papers.map(p => p.citation_count || 0), 10) : 100

  // Coordinate mapping helpers
  const getX = (year) => {
    const range = maxYear - minYear || 1
    return ((year - minYear) / range) * 100
  }

  const getY = (count) => {
    if (scaleType === 'log') {
      const logVal = Math.log10(count + 1)
      const logMax = Math.log10(maxCitations + 1) || 1
      return (logVal / logMax) * 100
    }
    return (count / maxCitations) * 100
  }

  const handleNodeClick = (paperId) => {
    setSelectedPaperId(paperId)
    setDrawerOpen(true)
  }

  return (
    <div className="min-h-screen mesh-bg pt-20 px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 animate-fade-in">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-950/60 border border-brand-800/40 text-brand-300">
                Semantic Scholar API
              </span>
              <span className="text-xs text-slate-500">Real-Time Citation Metadata</span>
            </div>
            <h1 className="section-title">Publication Timeline & Citation Impact</h1>
            <p className="text-slate-400 text-sm">
              Publication years vs. real-world citation counts for papers in your project corpus.
            </p>
          </div>

          {/* Controls */}
          <div className="glass-card px-4 py-2 flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">Y-Axis Scale:</span>
            <div className="flex items-center bg-slate-900/80 p-1 rounded-lg border border-white/10 text-xs">
              <button
                onClick={() => setScaleType('linear')}
                className={`px-3 py-1 rounded-md transition-all font-semibold ${
                  scaleType === 'linear'
                    ? 'bg-brand-600 text-white shadow-glow-brand'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Linear
              </button>
              <button
                onClick={() => setScaleType('log')}
                className={`px-3 py-1 rounded-md transition-all font-semibold ${
                  scaleType === 'log'
                    ? 'bg-cyan-600 text-white shadow-glow-cyan'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Log10 Scale
              </button>
            </div>
          </div>
        </div>

        {/* Main Scatter Chart Card */}
        <div className="glass-card p-6 relative overflow-hidden min-h-[500px] flex flex-col justify-between">

          {loading ? (
            <div className="py-32 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-400">Fetching publication dates and Semantic Scholar citation counts…</p>
            </div>
          ) : papers.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-slate-400 text-sm">No papers found in current project. Upload papers to view the publication timeline.</p>
            </div>
          ) : (
            <>
              {/* Chart Grid Lines */}
              <div className="relative flex-1 min-h-[380px] my-6 border-l border-b border-white/10 mx-8">

                {/* Y-Axis Labels */}
                <div className="absolute -left-12 top-0 bottom-0 flex flex-col justify-between text-[10px] text-slate-500 font-mono">
                  <span>{scaleType === 'log' ? `~${maxCitations}` : maxCitations}</span>
                  <span>{scaleType === 'log' ? `~${Math.round(maxCitations/2)}` : Math.round(maxCitations/2)}</span>
                  <span>0</span>
                </div>

                {/* Horizontal Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                  <div className="border-b border-dashed border-white/20 w-full" />
                  <div className="border-b border-dashed border-white/20 w-full" />
                  <div className="border-b border-dashed border-white/20 w-full" />
                </div>

                {/* Plot Nodes */}
                {papers.map((p, idx) => {
                  const xPct = getX(p.year || 2024)
                  const yPct = getY(p.citation_count || 0)
                  const color = getColorForTag(p.method || p.domain)
                  const isHovered = hoveredPaper?.paper_id === p.paper_id

                  return (
                    <div
                      key={p.paper_id || idx}
                      onClick={() => handleNodeClick(p.paper_id)}
                      onMouseEnter={() => setHoveredPaper(p)}
                      onMouseLeave={() => setHoveredPaper(null)}
                      style={{
                        left: `${Math.max(2, Math.min(98, xPct))}%`,
                        bottom: `${Math.max(4, Math.min(96, yPct))}%`,
                        backgroundColor: color,
                        boxShadow: `0 0 ${isHovered ? '16px' : '8px'} ${color}bb`,
                      }}
                      className={`absolute w-5 h-5 -ml-2.5 -mb-2.5 rounded-full cursor-pointer transition-all duration-300 transform hover:scale-150 z-20 flex items-center justify-center border-2 border-white/80`}
                    >
                      <span className="text-[9px] font-bold text-slate-950">
                        {p.citation_count > 999 ? `${(p.citation_count/1000).toFixed(1)}k` : p.citation_count}
                      </span>
                    </div>
                  )
                })}

                {/* Hover Tooltip Popup */}
                {hoveredPaper && (
                  <div
                    style={{
                      left: `${Math.max(5, Math.min(75, getX(hoveredPaper.year)))}%`,
                      bottom: `${Math.max(10, Math.min(70, getY(hoveredPaper.citation_count) + 5))}%`,
                    }}
                    className="absolute z-30 w-72 p-4 bg-slate-900/95 border border-brand-500/40 rounded-xl shadow-2xl backdrop-blur-md pointer-events-none animate-fade-in space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-white/10 pb-1">
                      <span>Year: <strong className="text-white">{hoveredPaper.year}</strong></span>
                      <span>Citations: <strong className="text-brand-300">{hoveredPaper.citation_count}</strong></span>
                    </div>
                    <p className="text-xs font-bold text-white line-clamp-2 leading-tight">
                      {hoveredPaper.title}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {hoveredPaper.authors?.join(', ') || 'Unknown Authors'}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {hoveredPaper.method && (
                        <span className="badge-method text-[10px] px-2 py-0.5">{hoveredPaper.method}</span>
                      )}
                      {hoveredPaper.domain && (
                        <span className="badge-domain text-[10px] px-2 py-0.5">{hoveredPaper.domain}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* X-Axis Labels */}
              <div className="mx-8 flex justify-between text-xs text-slate-400 font-mono border-t border-white/10 pt-2">
                <span>{minYear}</span>
                <span>{Math.round((minYear + maxYear) / 2)}</span>
                <span>{maxYear}</span>
              </div>
            </>
          )}

          {/* Footer Info Strip */}
          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
            <span>Click any node to view detailed paper metadata and extracted graph entities.</span>
            <span>Total Papers: <strong className="text-slate-300">{papers.length}</strong></span>
          </div>

        </div>

      </div>

      {/* Paper Detail Drawer */}
      <PaperDetailDrawer
        paperId={selectedPaperId}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}
