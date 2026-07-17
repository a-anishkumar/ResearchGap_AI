export default function GapCard({ gap, rank }) {
  const score = gap.score?.toFixed(0) || '0'

  return (
    <div className="glass-card p-5 hover:border-brand-700/40 transition-all duration-200 animate-slide-up group">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-brand-900/80 border border-brand-700/40 flex items-center justify-center text-sm font-bold text-brand-300 shrink-0">
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="badge-method text-sm px-3 py-1">⚙ {gap.method}</span>
            <span className="text-slate-500">×</span>
            <span className="badge-domain text-sm px-3 py-1">🌐 {gap.domain}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Method in <strong className="text-slate-300">{gap.method_frequency}</strong> papers</span>
            <span>·</span>
            <span>Domain in <strong className="text-slate-300">{gap.domain_frequency}</strong> papers</span>
            <span>·</span>
            <span>Score <strong className="text-brand-400">{score}</strong></span>
          </div>
        </div>
      </div>

      {/* Suggestion text */}
      {gap.suggestion && (
        <div className="bg-surface-600/60 rounded-xl p-4 mb-4 border-l-2 border-brand-600">
          <p className="text-sm text-slate-200 leading-relaxed">{gap.suggestion}</p>
        </div>
      )}

      {/* Evidence */}
      <div className="grid grid-cols-2 gap-3">
        {gap.method_papers?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              Method Papers
            </p>
            <div className="space-y-1">
              {gap.method_papers.slice(0, 3).map((p, i) => (
                <p key={i} className="text-xs text-slate-400 truncate" title={p}>📄 {p}</p>
              ))}
            </div>
          </div>
        )}
        {gap.domain_papers?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
              Domain Papers
            </p>
            <div className="space-y-1">
              {gap.domain_papers.slice(0, 3).map((p, i) => (
                <p key={i} className="text-xs text-slate-400 truncate" title={p}>📄 {p}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
