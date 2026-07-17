import { useState } from 'react'
import useStore from '../api/store'
import { analyzeGaps, suggestGaps } from '../api/client'
import GapCard from '../components/GapCard'

export default function GapsPage() {
  const {
    gapAnalysis, setGapAnalysis,
    gapSuggestions, setGapSuggestions,
    loadingGaps, setLoadingGaps,
    loadingSuggestions, setLoadingSuggestions,
  } = useStore()

  const [topN, setTopN] = useState(10)
  const [analyzeError, setAnalyzeError] = useState(null)
  const [suggestError, setSuggestError] = useState(null)
  const [activeTab, setActiveTab] = useState('candidates') // 'candidates' | 'suggestions'

  const handleAnalyze = async () => {
    setLoadingGaps(true)
    setAnalyzeError(null)
    try {
      const { data } = await analyzeGaps(topN)
      setGapAnalysis(data)
      setActiveTab('candidates')
    } catch (e) {
      setAnalyzeError(e?.response?.data?.detail || e.message)
    } finally {
      setLoadingGaps(false)
    }
  }

  const handleSuggest = async () => {
    setLoadingSuggestions(true)
    setSuggestError(null)
    try {
      const { data } = await suggestGaps(topN)
      setGapSuggestions(data)
      setActiveTab('suggestions')
    } catch (e) {
      setSuggestError(e?.response?.data?.detail || e.message)
    } finally {
      setLoadingSuggestions(false)
    }
  }

  return (
    <div className="min-h-screen mesh-bg pt-20 px-6 py-12">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="section-title mb-2">Research Gap Discovery</h1>
          <p className="text-slate-400">
            Identify unexplored Method × Domain combinations across your paper corpus.
          </p>
        </div>

        {/* Controls */}
        <div className="glass-card p-5 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-400 font-medium">Top gaps to analyze:</label>
            <select
              id="top-n-select"
              value={topN}
              onChange={e => setTopN(Number(e.target.value))}
              className="input-base w-24"
            >
              {[5, 10, 15, 20, 30, 50].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <button
            id="analyze-gaps-btn"
            onClick={handleAnalyze}
            disabled={loadingGaps}
            className="btn-secondary"
          >
            {loadingGaps ? (
              <><span className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" /> Analyzing…</>
            ) : '📊 Analyze Gaps'}
          </button>

          <button
            id="suggest-gaps-btn"
            onClick={handleSuggest}
            disabled={loadingSuggestions}
            className="btn-primary"
          >
            {loadingSuggestions ? (
              <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</>
            ) : '🤖 Generate AI Suggestions'}
          </button>
        </div>

        {/* Summary stats */}
        {gapAnalysis && (
          <div className="grid grid-cols-3 gap-4 mb-6 animate-slide-up">
            {[
              { label: 'Possible Pairs',  value: gapAnalysis.total_possible_pairs, color: 'text-slate-300' },
              { label: 'Observed Pairs',  value: gapAnalysis.observed_pairs,        color: 'text-accent-green' },
              { label: 'Research Gaps',   value: gapAnalysis.missing_pairs,         color: 'text-brand-400' },
            ].map(s => (
              <div key={s.label} className="glass-card p-4 text-center">
                <p className={`text-3xl font-bold font-display mb-1 ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        {(gapAnalysis || gapSuggestions) && (
          <div className="flex gap-2 mb-4">
            <button
              id="tab-candidates"
              onClick={() => setActiveTab('candidates')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'candidates'
                  ? 'bg-brand-900/60 text-brand-300 border border-brand-700/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Gap Candidates {gapAnalysis && `(${gapAnalysis.top_gaps?.length})`}
            </button>
            <button
              id="tab-suggestions"
              onClick={() => setActiveTab('suggestions')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'suggestions'
                  ? 'bg-brand-900/60 text-brand-300 border border-brand-700/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              AI Suggestions {gapSuggestions && `(${gapSuggestions.suggestions?.length})`}
            </button>
          </div>
        )}

        {/* Errors */}
        {analyzeError && (
          <div className="glass-card p-4 border border-red-800/40 bg-red-950/20 mb-4">
            <p className="text-sm text-red-400">⚠ {analyzeError}</p>
          </div>
        )}
        {suggestError && (
          <div className="glass-card p-4 border border-red-800/40 bg-red-950/20 mb-4">
            <p className="text-sm text-red-400">⚠ {suggestError}</p>
          </div>
        )}

        {/* Candidates list */}
        {activeTab === 'candidates' && gapAnalysis?.top_gaps?.length > 0 && (
          <div className="space-y-3">
            {gapAnalysis.top_gaps.map((gap, i) => (
              <div key={i} className="glass-card p-4 hover:border-white/10 transition-all duration-200">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-surface-500 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    <span className="badge-method">⚙ {gap.method}</span>
                    <span className="text-slate-600 text-sm">×</span>
                    <span className="badge-domain">🌐 {gap.domain}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-brand-400">{gap.score?.toFixed(0)}</p>
                    <p className="text-xs text-slate-600">score</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-4 pl-10 text-xs text-slate-500">
                  <span>Method: <strong className="text-slate-400">{gap.method_frequency} papers</strong></span>
                  <span>Domain: <strong className="text-slate-400">{gap.domain_frequency} papers</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI Suggestions */}
        {activeTab === 'suggestions' && gapSuggestions?.suggestions?.length > 0 && (
          <div className="space-y-4">
            {gapSuggestions.suggestions.map((gap, i) => (
              <GapCard key={i} gap={gap} rank={i + 1} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!gapAnalysis && !gapSuggestions && !loadingGaps && !loadingSuggestions && (
          <div className="glass-card p-12 text-center">
            <div className="text-6xl mb-4 animate-float">🔬</div>
            <h2 className="text-xl font-display font-bold text-white mb-2">
              Discover What's Unexplored
            </h2>
            <p className="text-slate-400 max-w-md mx-auto text-sm">
              Click "Analyze Gaps" to find missing Method × Domain combinations,
              then "Generate AI Suggestions" to get research opportunity statements grounded in your corpus.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
