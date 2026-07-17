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

export default function PaperProgressCard({ paper }) {
  const cfg = STAGE_CONFIG[paper.stage] || STAGE_CONFIG.uploaded
  const pct = paper.progress ?? cfg.progress

  return (
    <div className="glass-card p-4 animate-slide-up">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{paper.filename}</p>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">{paper.paper_id?.slice(0, 8)}…</p>
        </div>
        <span className={`text-xs font-semibold shrink-0 ${cfg.color}`}>
          {cfg.label}
        </span>
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
