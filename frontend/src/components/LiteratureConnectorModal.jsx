import { useState, useEffect } from 'react'
import { connectPapers } from '../api/client'
import PaperDetailDrawer from './PaperDetailDrawer'
import { useToast } from './Toast'

export default function LiteratureConnectorModal({ paperIdA, paperIdB, isOpen, onClose }) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [connectData, setConnectData] = useState(null)
  const [selectedPaperId, setSelectedPaperId] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!isOpen || !paperIdA || !paperIdB) {
      setConnectData(null)
      return
    }

    setLoading(true)
    setConnectData(null)

    connectPapers(paperIdA, paperIdB)
      .then(res => {
        setConnectData(res.data)
      })
      .catch(err => {
        toast?.error(`Literature Connector error: ${err.message}`)
      })
      .finally(() => setLoading(false))
  }, [isOpen, paperIdA, paperIdB])

  if (!isOpen) return null

  const path = connectData?.path

  const handleNodeClick = (paperId) => {
    if (paperId && !paperId.startsWith('ext_')) {
      setSelectedPaperId(paperId)
      setDrawerOpen(true)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-card w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-cyan-500/30">

        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-surface-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-brand-600 flex items-center justify-center text-white font-bold shadow-glow-cyan">
              🔗
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-display">Literature Citation Path Connector</h2>
              <p className="text-xs text-slate-400">Shortest citation chain algorithm via Semantic Scholar Graph API</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-8 overflow-y-auto flex-1 custom-scrollbar space-y-6">

          {loading ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-300 animate-pulse">
                Running BFS shortest-path search across Semantic Scholar citation subgraphs…
              </p>
            </div>
          ) : !connectData ? (
            <div className="py-16 text-center text-slate-400">
              <p>Unable to calculate citation connection path.</p>
            </div>
          ) : !path || path.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-slate-900/40 p-6 rounded-2xl border border-white/5">
              <div className="w-12 h-12 rounded-full bg-amber-950/60 border border-amber-800/40 flex items-center justify-center text-amber-400 text-xl mx-auto">
                🔍
              </div>
              <h3 className="text-base font-bold text-white">No Citation Path Found Within 3 Hops</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                {connectData.message || "Neither paper directly cites or references each other within a 3-hop depth on Semantic Scholar."}
              </p>
              <span className="inline-block text-[11px] px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-white/5">
                Note: This confirms a distinct literature gap between the two domains.
              </span>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-cyan-950/20 p-4 rounded-xl border border-cyan-800/30 flex items-center justify-between text-xs">
                <span className="text-cyan-300 font-semibold">{connectData.message}</span>
                <span className="text-slate-400">Path Depth: <strong className="text-white">{connectData.depth} hop{connectData.depth !== 1 ? 's' : ''}</strong></span>
              </div>

              {/* Linear Path Chain Diagram */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-8 px-4 bg-slate-900/60 rounded-2xl border border-white/10 relative overflow-x-auto custom-scrollbar">

                {path.map((node, i) => {
                  const isEnd = i === 0 || i === path.length - 1
                  return (
                    <div key={i} className="flex flex-col md:flex-row items-center gap-4 flex-1 min-w-[200px]">
                      
                      {/* Node Box */}
                      <div
                        onClick={() => handleNodeClick(node.paper_id)}
                        className={`w-full p-4 rounded-xl border transition-all duration-200 text-center flex flex-col justify-between min-h-[140px] cursor-pointer ${
                          isEnd
                            ? 'bg-brand-950/60 border-brand-500 shadow-glow-brand hover:brightness-110'
                            : 'bg-surface-700/80 border-cyan-700/40 hover:border-cyan-400 hover:bg-surface-600'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span className={`px-2 py-0.5 rounded font-bold ${isEnd ? 'bg-brand-500/20 text-brand-300' : 'bg-cyan-500/20 text-cyan-300'}`}>
                            {i === 0 ? 'Start Paper A' : i === path.length - 1 ? 'Target Paper B' : `Hop #${i}`}
                          </span>
                          {node.is_corpus_paper && (
                            <span className="text-emerald-400 font-bold">In Corpus</span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug my-2" title={node.title}>
                          {node.title}
                        </h4>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-white/5 pt-2">
                          <span>{node.year || 'N/A'}</span>
                          <span className="text-brand-300">Citations: {node.citation_count}</span>
                        </div>
                      </div>

                      {/* Arrow Divider */}
                      {i < path.length - 1 && (
                        <div className="flex flex-col items-center shrink-0 text-cyan-400 font-bold text-lg">
                          <span className="hidden md:inline">➔</span>
                          <span className="inline md:hidden">↓</span>
                          <span className="text-[9px] text-slate-500 uppercase font-mono">cites</span>
                        </div>
                      )}

                    </div>
                  )
                })}

              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-surface-700/50 flex items-center justify-between text-xs text-slate-400">
          <span>Semantic Scholar Shortest Path Algorithm</span>
          <button onClick={onClose} className="btn-secondary py-1.5 px-4">
            Close
          </button>
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
