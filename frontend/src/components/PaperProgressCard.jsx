import { useState } from 'react'
import { deletePaper } from '../api/client'
import useStore from '../api/store'
import { useToast } from './Toast'

const STAGE_CONFIG = {
  uploaded:   { label: 'Uploaded',    color: 'text-slate-400', bg: 'bg-slate-700', progress: 5  },
  parsing:    { label: 'Parsing PDF', color: 'text-amber-400', bg: 'bg-amber-600', progress: 20 },
  parsed:     { label: 'Parsed',      color: 'text-amber-300', bg: 'bg-amber-500', progress: 35 },
  extracting: { label: 'Extracting',  color: 'text-blue-400',  bg: 'bg-blue-600',  progress: 55 },
  extracted:  { label: 'Extracted',   color: 'text-blue-300',  bg: 'bg-blue-500',  progress: 65 },
  embedding:  { label: 'Embedding',   color: 'text-purple-400',bg: 'bg-purple-600',progress: 75 },
  embedded:   { label: 'Embedded',    color: 'text-purple-300',bg: 'bg-purple-500',progress: 85 },
  graphing:   { label: 'Graph Write', color: 'text-cyan-400',  bg: 'bg-cyan-600',  progress: 92 },
  done:       { label: 'Complete ✓',  color: 'text-green-400', bg: 'bg-green-500', progress: 100 },
  error:      { label: 'Error',       color: 'text-red-400',   bg: 'bg-red-600',   progress: 0  },
}

export default function PaperProgressCard({ paper, onViewDetail }) {
  const { removePaper, setGraphData, setGraphStats, setGapAnalysis, setGapSuggestions, comparePaperIds, toggleComparePaperId } = useStore()
  const toast = useToast()
  const [deleting, setDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const isChecked = comparePaperIds.includes(paper.paper_id)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deletePaper(paper.paper_id)
      removePaper(paper.paper_id)
      setGraphData(null) // clear graph cache so it reloads
      setGraphStats(null)
      setGapAnalysis(null) // clear gaps cache so it reloads
      setGapSuggestions(null)
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || 'Failed to delete paper')
    } finally {
      setDeleting(false)
      setShowConfirm(false)
    }
  }

  const cfg = STAGE_CONFIG[paper.stage] || STAGE_CONFIG.uploaded
  const pct = paper.progress ?? cfg.progress
  const isFinalState = paper.stage === 'done' || paper.stage === 'error'

  return (
    <div className={`glass-card p-4 relative overflow-hidden animate-slide-up transition-all ${isChecked ? 'ring-2 ring-brand-400 bg-brand-950/20' : ''}`}>
      {/* Custom Delete Confirmation Overlay */}
      {showConfirm && (
        <div className="absolute inset-0 bg-surface-900/95 backdrop-blur-md p-4 flex flex-col justify-between z-20 animate-fade-in">
          <div>
            <p className="text-sm font-semibold text-white mb-1">Delete Research Paper?</p>
            <p className="text-xs text-slate-400 leading-normal">
              Permanently delete "{paper.filename}" from the database, ChromaDB, and raw storage.
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-surface-700 hover:bg-surface-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              {deleting ? 'Deleting...' : 'Yes, Delete'}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {paper.stage === 'done' && (
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleComparePaperId(paper.paper_id)}
              className="mt-1 w-4 h-4 rounded bg-surface-700 border-white/20 text-brand-500 focus:ring-brand-400 focus:ring-offset-surface-900 cursor-pointer shrink-0"
              title="Select for side-by-side comparison"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{paper.filename}</p>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{paper.paper_id?.slice(0, 8)}…</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold ${cfg.color}`}>
            {cfg.label}
          </span>
          {isFinalState && (
            <div className="flex items-center gap-1 shrink-0">
              {onViewDetail && (
                <button
                  onClick={onViewDetail}
                  className="text-slate-500 hover:text-brand-400 transition-colors p-1.5 rounded hover:bg-white/5 flex items-center justify-center"
                  title="View details"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setShowConfirm(true)}
                className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-white/5 flex items-center justify-center"
                title="Delete paper"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-surface-500 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${cfg.bg} ${pct > 0 ? 'progress-glow' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {paper.error && (
        <p className="mt-2 text-xs text-red-400 bg-red-950/40 rounded-lg px-3 py-2">
          ⚠ {paper.error}
        </p>
      )}

      {paper.stage === 'done' && paper.extraction && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {paper.extraction.methods?.slice(0, 3).map(m => (
            <span key={m} className="badge-method">{m}</span>
          ))}
          {paper.extraction.domains?.slice(0, 2).map(d => (
            <span key={d} className="badge-domain">{d}</span>
          ))}
        </div>
      )}
    </div>
  )
}
