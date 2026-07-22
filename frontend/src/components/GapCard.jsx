import { useState } from 'react'
import { useToast } from './Toast'

// ── Icons (Clean Professional SVGs) ──────────────────────────────────────────
function MethodIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function DomainIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  )
}

function CopyIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    </svg>
  )
}

function SectionIcon({ type, className = "w-5 h-5" }) {
  switch (type) {
    case 'why':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )
    case 'opps':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'impact':
    case 'impact_fallback':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    case 'steps':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    default:
      return null
  }
}

// ── Parse structured bullet output from the AI ──────────────────────────────
function parseStructuredSuggestion(text) {
  if (!text) return null

  const sections = {
    'WHY THIS GAP EXISTS':   { key: 'why',     color: 'text-amber-400',  bg: 'bg-amber-900/20',  border: 'border-amber-700/30' },
    'RESEARCH OPPORTUNITY':  { key: 'opps',    color: 'text-cyan-400',   bg: 'bg-cyan-900/20',   border: 'border-cyan-700/30'  },
    'EXPECTED PARAMETER OUTCOMES': { key: 'impact',  color: 'text-green-400',  bg: 'bg-green-900/20',  border: 'border-green-700/30' },
    'EXPECTED IMPACT':       { key: 'impact_fallback', color: 'text-green-400',  bg: 'bg-green-900/20',  border: 'border-green-700/30' },
    'FIRST STEPS':           { key: 'steps',   color: 'text-purple-400', bg: 'bg-purple-900/20', border: 'border-purple-700/30' },
  }

  const result = {}
  let currentKey = null
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const sectionMatch = Object.keys(sections).find(s => trimmed.startsWith(s))
    if (sectionMatch) {
      currentKey = sectionMatch
      result[sectionMatch] = []
    } else if (currentKey && (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*'))) {
      const bullet = trimmed.replace(/^[•\-*]\s*/, '').trim()
      if (bullet) result[currentKey].push(bullet)
    } else if (currentKey && trimmed) {
      result[currentKey] = result[currentKey] || []
      result[currentKey].push(trimmed)
    }
  }

  const hasContent = Object.values(result).some(v => Array.isArray(v) && v.length > 0)
  if (!hasContent) return null

  return Object.entries(sections)
    .filter(([label]) => result[label]?.length > 0)
    .map(([label, meta]) => ({ label, ...meta, bullets: result[label] }))
}

// ── Mini horizontal bar ──────────────────────────────────────────────────────
function FrequencyBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 w-20 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-500 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-bold text-slate-400 w-6 text-right shrink-0">{value}</span>
    </div>
  )
}

// ── Score gauge ring ────────────────────────────────────────────────────────
function ScoreRing({ score, maxScore }) {
  const pct = maxScore > 0 ? Math.min(1, score / maxScore) : 0
  const r = 18
  const circ = 2 * Math.PI * r
  const dash = circ * pct
  const gap  = circ - dash

  const color = pct > 0.66 ? '#6172f3' : pct > 0.33 ? '#22d3ee' : '#a78bfa'

  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg width="48" height="48" className="-rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="#1e2235" strokeWidth="4" />
        <circle
          cx="24" cy="24" r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white rotate-0">
        {Math.round(pct * 100)}%
      </span>
    </div>
  )
}

// ── Main GapCard ─────────────────────────────────────────────────────────────
export default function GapCard({ gap, rank, maxScore = 1 }) {
  const toast = useToast()
  const [expanded, setExpanded] = useState(rank <= 2)

  const structured = parseStructuredSuggestion(gap.suggestion)

  const [validation, setValidation] = useState(null)
  const [validating, setValidating] = useState(false)

  const handleCopy = () => {
    const text = gap.suggestion || ''
    navigator.clipboard.writeText(text)
    toast?.success('Research opportunity copied!')
  }

  const handleExportBibTeX = async () => {
    try {
      const res = await fetch(`/api/gaps/export/bibtex?method=${encodeURIComponent(gap.method)}&domain=${encodeURIComponent(gap.domain)}`)
      if (!res.ok) throw new Error('BibTeX export failed')
      const text = await res.text()
      navigator.clipboard.writeText(text)
      toast?.success('BibTeX references copied to clipboard!')
    } catch (err) {
      toast?.error(`Export error: ${err.message}`)
    }
  }

  const handleExportLaTeX = async () => {
    try {
      const res = await fetch(`/api/gaps/export/latex?method=${encodeURIComponent(gap.method)}&domain=${encodeURIComponent(gap.domain)}`)
      if (!res.ok) throw new Error('LaTeX export failed')
      const text = await res.text()
      navigator.clipboard.writeText(text)
      toast?.success('LaTeX proposal template copied to clipboard!')
    } catch (err) {
      toast?.error(`Export error: ${err.message}`)
    }
  }

  const handleVerifyArxiv = async () => {
    setValidating(true)
    try {
      const res = await fetch(`/api/gaps/validate?method=${encodeURIComponent(gap.method)}&domain=${encodeURIComponent(gap.domain)}`)
      if (!res.ok) throw new Error('Validation failed')
      const data = await res.json()
      setValidation(data)
      toast?.info(`arXiv check: ${data.status}`)
    } catch (err) {
      toast?.error(`Validation error: ${err.message}`)
    } finally {
      setValidating(false)
    }
  }

  const scoreValue = gap.score || 0

  return (
    <div
      className={`glass-card overflow-hidden transition-all duration-300 animate-slide-up hover:border-brand-700/40 group`}
      style={{ animationDelay: `${(rank - 1) * 60}ms` }}
    >
      {/* ── Header ── */}
      <div className="p-5 pb-4">
        <div className="flex items-start gap-4">

          {/* Rank + Ring */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-brand-900/80 border border-brand-700/40 flex items-center justify-center text-xs font-bold text-brand-300">
              {rank}
            </div>
            <ScoreRing score={scoreValue} maxScore={maxScore} />
          </div>

          {/* Title + Badges */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="badge-method text-sm px-3 py-1 flex items-center gap-1.5">
                <MethodIcon className="w-3.5 h-3.5 text-brand-400" />
                {gap.method}
              </span>
              <span className="text-slate-600 font-bold">×</span>
              <span className="badge-domain text-sm px-3 py-1 flex items-center gap-1.5">
                <DomainIcon className="w-3.5 h-3.5 text-cyan-400" />
                {gap.domain}
              </span>

              {validation && (
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  validation.external_presence 
                    ? 'bg-amber-950/40 text-amber-300 border-amber-800/40' 
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                }`}>
                  {validation.status}
                </span>
              )}
            </div>

            {/* Frequency bars */}
            <div className="space-y-1 mt-3">
              <FrequencyBar
                label={gap.method}
                value={gap.method_frequency}
                max={Math.max(gap.method_frequency, gap.domain_frequency)}
                color="bg-brand-500"
              />
              <FrequencyBar
                label={gap.domain}
                value={gap.domain_frequency}
                max={Math.max(gap.method_frequency, gap.domain_frequency)}
                color="bg-cyan-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleVerifyArxiv}
                disabled={validating}
                className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-white bg-surface-600/50 hover:bg-surface-500 border border-white/5 transition-all"
                title="Verify gap against arXiv literature API"
              >
                {validating ? 'Checking...' : 'Verify arXiv'}
              </button>
              <button
                onClick={handleExportBibTeX}
                className="px-2 py-1 rounded-md text-[11px] font-medium text-brand-400 hover:text-brand-300 bg-brand-950/40 hover:bg-brand-900/60 border border-brand-800/30 transition-all"
                title="Copy BibTeX references"
              >
                BibTeX
              </button>
              <button
                onClick={handleExportLaTeX}
                className="px-2 py-1 rounded-md text-[11px] font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/30 transition-all"
                title="Copy LaTeX research proposal template"
              >
                LaTeX
              </button>
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-white/5 border border-white/5 transition-all flex items-center justify-center"
                title="Copy research opportunity"
              >
                <CopyIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => setExpanded(v => !v)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-all border font-medium
                ${expanded
                  ? 'text-brand-300 bg-brand-900/40 border-brand-700/30'
                  : 'text-slate-400 hover:text-white border-white/5 hover:bg-white/5'
                }`}
            >
              {expanded ? '▲ Less' : '▼ Details'}
            </button>
          </div>
        </div>
      </div>


      {/* ── Expandable body ── */}
      {expanded && (
        <div className="border-t border-white/5 animate-fade-in">

          {/* Structured sections */}
          {structured ? (
            <div className="p-5 space-y-4">
              {structured.map(section => (
                <div
                  key={section.key}
                  className={`rounded-xl p-4 ${section.bg} border ${section.border}`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <SectionIcon type={section.key} className={`w-4 h-4 ${section.color}`} />
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${section.color}`}>
                      {section.label}
                    </h4>
                  </div>
                  <ul className="space-y-2">
                    {section.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className={`${section.color} text-sm shrink-0 mt-0.5 font-bold`}>•</span>
                        <span className="text-sm text-slate-200 leading-relaxed">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            /* Fallback: prose with left border */
            <div className="p-5">
              <div className="bg-surface-600/60 rounded-xl p-4 border-l-2 border-brand-600">
                <p className="text-sm text-slate-200 leading-relaxed">{gap.suggestion}</p>
              </div>
            </div>
          )}

          {/* Evidence grid */}
          {(gap.method_papers?.length > 0 || gap.domain_papers?.length > 0) && (
            <div className="grid grid-cols-2 gap-4 px-5 pb-5">
              {gap.method_papers?.length > 0 && (
                <div className="bg-surface-700/40 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Method Evidence
                  </p>
                  {gap.method_papers.slice(0, 3).map((p, i) => (
                    <p key={i} className="text-xs text-slate-400 truncate mb-1 flex items-center gap-1.5" title={p}>
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                      {p}
                    </p>
                  ))}
                </div>
              )}
              {gap.domain_papers?.length > 0 && (
                <div className="bg-surface-700/40 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    Domain Evidence
                  </p>
                  {gap.domain_papers.slice(0, 3).map((p, i) => (
                    <p key={i} className="text-xs text-slate-400 truncate mb-1 flex items-center gap-1.5" title={p}>
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                      {p}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
