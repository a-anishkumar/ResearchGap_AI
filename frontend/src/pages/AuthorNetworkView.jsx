import { useState, useEffect, useRef } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { getAuthorNetwork, getAuthorDetail } from '../api/client'
import { useToast } from '../components/Toast'

export default function AuthorNetworkView() {
  const toast = useToast()
  const fgRef = useRef()
  const [loading, setLoading] = useState(true)
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })

  // Author Detail Drawer State
  const [selectedAuthor, setSelectedAuthor] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [authorDetail, setAuthorDetail] = useState(null)

  useEffect(() => {
    setLoading(true)
    getAuthorNetwork()
      .then(res => {
        setGraphData(res.data || { nodes: [], links: [] })
      })
      .catch(err => {
        toast?.error(`Author Network error: ${err.message}`)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleNodeClick = async (node) => {
    setSelectedAuthor(node.name)
    setDetailLoading(true)
    setAuthorDetail(null)
    try {
      const res = await getAuthorDetail(node.name)
      setAuthorDetail(res.data)
    } catch (err) {
      toast?.error(`Failed fetching author details: ${err.message}`)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="min-h-screen mesh-bg pt-20 px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Page Header */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-950/60 border border-purple-800/40 text-purple-300">
                Co-Authorship Network
              </span>
              <span className="text-xs text-slate-500">Semantic Scholar + Corpus Graph</span>
            </div>
            <h1 className="section-title">Author & Institution Network</h1>
            <p className="text-slate-400 text-sm">
              Explore co-authorship relationships across your corpus and inspect external publication catalogs.
            </p>
          </div>
        </div>

        {/* Graph Container */}
        <div className="glass-card relative overflow-hidden h-[600px] flex">

          {loading ? (
            <div className="w-full py-32 text-center space-y-4 my-auto">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-400">Building co-authorship network graph…</p>
            </div>
          ) : graphData.nodes.length === 0 ? (
            <div className="w-full my-auto flex flex-col items-center justify-center py-16 px-8 text-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-purple-950/40 border border-purple-800/30 flex items-center justify-center">
                <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-white font-bold text-lg">No Co-Authorship Data Yet</h3>
                <p className="text-slate-400 text-sm max-w-md">
                  Author relationships are extracted when papers are processed. Upload papers with author metadata and run processing to populate this network.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700/40 border border-white/5">
                  <span className="text-brand-400 font-bold">1.</span> Upload academic PDFs
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700/40 border border-white/5">
                  <span className="text-brand-400 font-bold">2.</span> Run AI processing
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-700/40 border border-white/5">
                  <span className="text-brand-400 font-bold">3.</span> Return here to explore network
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 relative">
              <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                backgroundColor="transparent"
                nodeRelSize={6}
                nodeVal={d => Math.max(4, d.paper_count * 3)}
                nodeColor={() => '#a78bfa'}
                nodeLabel={d => `${d.name} (${d.paper_count} paper${d.paper_count > 1 ? 's' : ''})`}
                linkColor={() => '#ffffff25'}
                linkWidth={l => Math.max(1, l.weight * 1.5)}
                onNodeClick={handleNodeClick}
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const label = node.name
                  const fontSize = 12 / globalScale
                  const radius = Math.max(4, Math.sqrt(node.paper_count || 1) * 5)

                  // Draw Glow Ring
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, radius + 2, 0, 2 * Math.PI, false)
                  ctx.fillStyle = '#a78bfa40'
                  ctx.fill()

                  // Draw Main Node
                  ctx.beginPath()
                  ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false)
                  ctx.fillStyle = '#8b5cf6'
                  ctx.fill()
                  ctx.strokeStyle = '#ffffff'
                  ctx.lineWidth = 1.5 / globalScale
                  ctx.stroke()

                  // Text Label
                  ctx.font = `${fontSize}px Inter, sans-serif`
                  ctx.fillStyle = '#ffffff'
                  ctx.textAlign = 'center'
                  ctx.textBaseline = 'middle'
                  ctx.fillText(label, node.x, node.y + radius + 10 / globalScale)
                }}
              />
            </div>
          )}

          {/* Author Detail Side Panel */}
          {selectedAuthor && (
            <div className="w-96 border-l border-white/10 bg-surface-900/95 backdrop-blur-xl p-6 overflow-y-auto space-y-5 animate-slide-left z-20">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Author Profile</span>
                  <h3 className="text-lg font-bold text-white leading-tight">{selectedAuthor}</h3>
                </div>
                <button
                  onClick={() => setSelectedAuthor(null)}
                  className="text-slate-400 hover:text-white text-lg p-1"
                >
                  ✕
                </button>
              </div>

              {detailLoading ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">Fetching Semantic Scholar catalog…</p>
                </div>
              ) : authorDetail ? (
                <div className="space-y-6">

                  {/* In-Project Papers */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                      In-Project Papers ({authorDetail.in_project_papers?.length || 0})
                    </h4>
                    <div className="space-y-2">
                      {authorDetail.in_project_papers?.map((p, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-surface-700/50 border border-white/5 space-y-1">
                          <p className="text-xs font-bold text-white leading-snug">{p.title}</p>
                          <p className="text-[10px] text-slate-400">Year: {p.year || 'N/A'}</p>
                          {p.methods?.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {p.methods.slice(0, 2).map(m => (
                                <span key={m} className="badge-method text-[9px] px-1.5 py-0.5">{m}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* External Top Papers (Semantic Scholar) */}
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Top External Papers</span>
                      <span className="text-[10px] text-slate-500 font-normal">S2 Ranked</span>
                    </h4>

                    {authorDetail.external_top_papers?.length > 0 ? (
                      <div className="space-y-2">
                        {authorDetail.external_top_papers.map((ep, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-slate-950/60 border border-cyan-900/40 space-y-1">
                            <p className="text-xs font-bold text-slate-200 leading-snug">{ep.title}</p>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                              <span>Year: {ep.year || 'N/A'}</span>
                              <span className="text-cyan-400 font-bold">Citations: {ep.citation_count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic p-2 bg-slate-950/40 rounded">
                        External publication catalog unavailable or unindexed on Semantic Scholar.
                      </p>
                    )}
                  </div>

                </div>
              ) : null}
            </div>
          )}

        </div>

      </div>
    </div>
  )
}
