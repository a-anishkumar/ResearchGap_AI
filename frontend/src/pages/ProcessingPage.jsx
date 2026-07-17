import { useEffect, useRef } from 'react'
import useStore from '../api/store'
import { getAllStatus } from '../api/client'
import PaperProgressCard from '../components/PaperProgressCard'

export default function ProcessingPage() {
  const { papers, setPapers, setPage } = useStore()
  const intervalRef = useRef(null)

  // Poll status every 2s until all papers are done or errored
  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await getAllStatus()
        setPapers(data)
        const allDone = data.every(p => p.stage === 'done' || p.stage === 'error')
        if (allDone && intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      } catch {}
    }

    poll()
    intervalRef.current = setInterval(poll, 2000)
    return () => clearInterval(intervalRef.current)
  }, [setPapers])

  const total = papers.length
  const done  = papers.filter(p => p.stage === 'done').length
  const errors = papers.filter(p => p.stage === 'error').length
  const allDone = total > 0 && (done + errors === total)
  const overallPct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="min-h-screen mesh-bg pt-20 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="section-title mb-2">Processing Papers</h1>
          <p className="text-slate-400">
            Each paper goes through: PDF parse → AI extraction → embedding → graph write
          </p>
        </div>

        {/* Overall progress */}
        <div className="glass-card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{done}</p>
                <p className="text-xs text-slate-500">Complete</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-400">{total - done - errors}</p>
                <p className="text-xs text-slate-500">Processing</p>
              </div>
              {errors > 0 && (
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">{errors}</p>
                  <p className="text-xs text-slate-500">Errors</p>
                </div>
              )}
            </div>
            <span className="text-3xl font-bold text-brand-400">{overallPct}%</span>
          </div>
          <div className="h-2 bg-surface-500 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-600 via-accent-purple to-accent-cyan rounded-full transition-all duration-1000 progress-glow"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          {allDone && (
            <p className="mt-3 text-sm text-accent-green font-semibold">
              ✅ All papers processed! Ready to explore the knowledge graph.
            </p>
          )}
        </div>

        {/* Paper cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {papers.map(p => (
            <PaperProgressCard key={p.paper_id} paper={p} />
          ))}
        </div>

        {/* Actions */}
        {allDone && (
          <div className="flex gap-4 animate-slide-up">
            <button
              id="view-graph-btn"
              onClick={() => setPage('graph')}
              className="btn-primary flex-1 justify-center"
            >
              🕸️ View Knowledge Graph
            </button>
            <button
              id="view-gaps-btn"
              onClick={() => setPage('gaps')}
              className="btn-secondary flex-1 justify-center text-sm"
            >
              🔬 Discover Research Gaps
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
