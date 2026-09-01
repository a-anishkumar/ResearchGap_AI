import { useState, useEffect } from 'react'
import useStore from '../api/store'
import { comparePapers } from '../api/client'
import { useToast } from './Toast'
import { formatNodeLabel } from '../utils/textUtils'

export default function CompareModal() {
  const { comparePaperIds, isCompareModalOpen, setCompareModalOpen, clearComparePaperIds } = useStore()
  const toast = useToast()

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!isCompareModalOpen || comparePaperIds.length !== 2) {
      setData(null)
      return
    }

    setLoading(true)
    setData(null)

    comparePapers(comparePaperIds[0], comparePaperIds[1])
      .then(res => {
        setData(res.data)
      })
      .catch(err => {
        toast.error(err?.response?.data?.detail || 'Failed to compare selected papers')
        setCompareModalOpen(false)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [isCompareModalOpen, comparePaperIds])

  if (!isCompareModalOpen) return null

  const handleClose = () => {
    setCompareModalOpen(false)
  }

  const paperA = data?.paper_a
  const paperB = data?.paper_b
  const overlap = data?.direct_overlap
  const llm = data?.llm_analysis

  const getVerdictStyle = (verdict) => {
    if (verdict === 'Complementary') return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
    if (verdict === 'Redundant') return 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    return 'bg-purple-500/20 text-purple-300 border-purple-500/40'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="bg-surface-900 border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-surface-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-cyan flex items-center justify-center text-white font-bold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Side-by-Side Paper Comparison</h2>
              <p className="text-xs text-slate-400">AI analysis of taxonomy overlap, divergent methods, & synthesis opportunities</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={clearComparePaperIds}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 bg-surface-700 hover:bg-surface-600 transition-colors"
            >
              Clear Selection
            </button>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-white text-2xl leading-none p-1 transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {loading && (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 border-3 border-brand-500/30 border-t-brand-400 rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-300 font-medium animate-pulse">
                Comparing paper taxonomies and synthesizing insights via AI…
              </p>
            </div>
          )}

          {!loading && data && (
            <>
              {/* Verdict Header Card */}
              <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${getVerdictStyle(llm?.verdict)}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-bold tracking-wider opacity-80">AI Relationship Verdict:</span>
                    <span className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-black/30 border border-current">
                      {llm?.verdict || 'Analysis Complete'}
                    </span>
                  </div>
                  <p className="text-xs font-medium opacity-90 leading-relaxed max-w-3xl">
                    {llm?.verdict_rationale}
                  </p>
                </div>
              </div>

              {/* Side-by-Side Metadata Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Paper A */}
                <div className="glass-card p-4 border-l-4 border-l-brand-500">
                  <span className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mb-1 block">Paper A</span>
                  <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">{paperA?.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{paperA?.authors?.join(', ') || 'Unknown Authors'} ({paperA?.year || 'N/A'})</p>
                  
                  <div className="mt-3 space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-1">Methods ({paperA?.methods?.length || 0}):</span>
                      <div className="flex flex-wrap gap-1">
                        {paperA?.methods?.map(m => (
                          <span key={m} className={`badge-method text-[11px] ${overlap?.shared_methods?.includes(m) ? 'ring-1 ring-emerald-400 bg-emerald-950/40 text-emerald-300' : ''}`}>
                            {formatNodeLabel(m)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Domains ({paperA?.domains?.length || 0}):</span>
                      <div className="flex flex-wrap gap-1">
                        {paperA?.domains?.map(d => (
                          <span key={d} className={`badge-domain text-[11px] ${overlap?.shared_domains?.includes(d) ? 'ring-1 ring-cyan-400 bg-cyan-950/40 text-cyan-300' : ''}`}>
                            {formatNodeLabel(d)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Paper B */}
                <div className="glass-card p-4 border-l-4 border-l-purple-500">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1 block">Paper B</span>
                  <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">{paperB?.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{paperB?.authors?.join(', ') || 'Unknown Authors'} ({paperB?.year || 'N/A'})</p>

                  <div className="mt-3 space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-1">Methods ({paperB?.methods?.length || 0}):</span>
                      <div className="flex flex-wrap gap-1">
                        {paperB?.methods?.map(m => (
                          <span key={m} className={`badge-method text-[11px] ${overlap?.shared_methods?.includes(m) ? 'ring-1 ring-emerald-400 bg-emerald-950/40 text-emerald-300' : ''}`}>
                            {formatNodeLabel(m)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">Domains ({paperB?.domains?.length || 0}):</span>
                      <div className="flex flex-wrap gap-1">
                        {paperB?.domains?.map(d => (
                          <span key={d} className={`badge-domain text-[11px] ${overlap?.shared_domains?.includes(d) ? 'ring-1 ring-cyan-400 bg-cyan-950/40 text-cyan-300' : ''}`}>
                            {formatNodeLabel(d)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Overlap Section */}
              <div className="bg-surface-800/90 border border-emerald-500/20 rounded-xl p-4">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Direct Taxonomy Overlap
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-surface-900/60 p-3 rounded-lg border border-white/5">
                    <p className="text-slate-400 font-semibold mb-1">Shared Methods</p>
                    {overlap?.shared_methods?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {overlap.shared_methods.map(m => (
                          <span key={m} className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                            {formatNodeLabel(m)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">No direct method overlap</p>
                    )}
                  </div>

                  <div className="bg-surface-900/60 p-3 rounded-lg border border-white/5">
                    <p className="text-slate-400 font-semibold mb-1">Shared Domains</p>
                    {overlap?.shared_domains?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {overlap.shared_domains.map(d => (
                          <span key={d} className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-medium">
                            {formatNodeLabel(d)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">No direct domain overlap</p>
                    )}
                  </div>

                  <div className="bg-surface-900/60 p-3 rounded-lg border border-white/5">
                    <p className="text-slate-400 font-semibold mb-1">Shared Datasets</p>
                    {overlap?.shared_datasets?.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {overlap.shared_datasets.map(ds => (
                          <span key={ds} className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">
                            {formatNodeLabel(ds)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">No shared datasets evaluated</p>
                    )}
                  </div>
                </div>
              </div>

              {/* LLM Comparison Breakdown */}
              <div className="space-y-4">
                {/* Divergent Approaches */}
                <div className="glass-card p-4 space-y-2">
                  <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider">
                    ⚡ Divergent Approaches & Problem Framing
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {llm?.divergent_approaches}
                  </p>
                </div>

                {/* Performance Comparison */}
                <div className="glass-card p-4 space-y-2">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    📊 Performance & Results Comparison
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {llm?.performance_comparison}
                  </p>
                </div>

                {/* Complementary Angles */}
                <div className="glass-card p-4 space-y-2 border-brand-500/30 bg-gradient-to-br from-brand-950/20 to-purple-950/20">
                  <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                    💡 Complementary Angles & Hybrid Research Synthesis
                  </h4>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {llm?.complementary_insights}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
