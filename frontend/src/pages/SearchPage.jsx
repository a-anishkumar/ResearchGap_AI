import { useState, useRef, useEffect } from 'react'
import { searchPapers, askQuestion, searchOnline } from '../api/client'

const EXAMPLE_QUERIES = [
  'What methods are used for text classification?',
  'Which papers use transformer architectures?',
  'What datasets are used for sentiment analysis?',
  'How is deep learning applied in medical imaging?',
]

function ChunkResult({ result, rank }) {
  return (
    <div className="glass-card p-4 hover:border-white/10 transition-all duration-200 animate-slide-up">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-surface-500 flex items-center justify-center text-xs text-slate-400 font-bold shrink-0">
            {rank}
          </span>
          <p className="text-xs font-semibold text-slate-300 truncate">{result.title || `Paper ${result.paper_id?.slice(0, 8)}`}</p>
        </div>
        <span className={`text-xs font-bold shrink-0 ${
          result.relevance > 70 ? 'text-green-400' : result.relevance > 40 ? 'text-amber-400' : 'text-slate-500'
        }`}>
          {result.relevance?.toFixed(0)}% match
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{result.text}</p>
    </div>
  )
}

function OnlinePaperCard({ paper, rank }) {
  return (
    <div className="glass-card p-5 hover:border-brand-500/20 hover:bg-white/[0.01] transition-all duration-200 animate-slide-up flex flex-col justify-between h-full relative overflow-hidden group">
      <div>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-5 h-5 rounded-full bg-brand-900/40 border border-brand-800/30 flex items-center justify-center text-[10px] text-brand-300 font-bold shrink-0">
              {rank}
            </span>
            <h4 className="font-bold text-white text-sm leading-snug group-hover:text-brand-300 transition-colors truncate" title={paper.title}>
              {paper.title}
            </h4>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {paper.source && (
              <span className="text-[9px] text-brand-300 font-bold bg-brand-950/50 border border-brand-800/30 px-2 py-0.5 rounded uppercase tracking-wider">
                {paper.source}
              </span>
            )}
            {paper.published && (
              <span className="text-[10px] text-slate-500 font-mono bg-surface-600 px-2 py-0.5 rounded">
                {paper.published}
              </span>
            )}
          </div>
        </div>

        {paper.authors && paper.authors.length > 0 && (
          <p className="text-[10px] text-slate-400 mb-3 truncate leading-normal pl-7">
            By <span className="font-semibold text-slate-300">{paper.authors.join(', ')}</span>
          </p>
        )}

        <p className="text-xs text-slate-400 leading-relaxed pl-7 mb-4 line-clamp-3">
          {paper.summary}
        </p>
      </div>

      <div className="pt-3 border-t border-white/5 flex items-center justify-end pl-7">
        <a
          href={paper.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary py-1 px-3 text-[11px] inline-flex items-center gap-1 hover:bg-surface-400"
        >
          Open {paper.source || 'Publisher'}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  )
}

export default function SearchPage() {
  const [mode, setMode] = useState('search') // 'search' | 'ask' | 'online'
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [onlineResults, setOnlineResults] = useState(null)
  const [answer, setAnswer] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [mode])

  const handleSearch = async (q = query) => {
    if (!q.trim()) return
    setLoading(true)
    setError(null)
    setResults(null)
    setOnlineResults(null)
    setAnswer(null)
    try {
      if (mode === 'search') {
        const { data } = await searchPapers(q, 8)
        setResults(data.results)
      } else if (mode === 'ask') {
        const { data } = await askQuestion(q, 5)
        setAnswer(data)
      } else if (mode === 'online') {
        const { data } = await searchOnline(q, 30)
        setOnlineResults(data.results)
      }
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  return (
    <div className="min-h-screen mesh-bg pt-20 px-6 py-12">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="section-title mb-2">Search & Research</h1>
          <p className="text-slate-400">Search your local corpus, ask questions, or discover related papers online.</p>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-2 mb-6 p-1 bg-surface-700/60 rounded-xl w-fit mx-auto border border-white/5">
          {[
            { 
              id: 'search', 
              label: 'Semantic Search',
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )
            },
            { 
              id: 'ask',    
              label: 'Ask AI',
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              )
            },
            {
              id: 'online',
              label: 'Find Online',
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              )
            }
          ].map(m => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); setResults(null); setOnlineResults(null); setAnswer(null); setError(null) }}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 flex items-center gap-2 ${
                mode === m.id
                  ? 'bg-brand-600 text-white shadow-glow-brand'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative mb-6">
          <textarea
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            rows={2}
            className="input-base w-full resize-none pr-28 text-sm"
            placeholder={
              mode === 'search'
                ? 'Search for papers, methods, topics…'
                : mode === 'ask'
                  ? 'Ask a question about your research corpus…'
                  : 'Search for related papers online (arXiv)…'
            }
          />
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="absolute right-3 top-3 btn-primary text-xs px-4 py-2"
          >
            {loading
              ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Searching…</>
              : mode === 'online' ? 'Find' : mode === 'search' ? 'Search' : 'Ask'
            }
          </button>
        </div>

        {/* Example queries */}
        {!results && !answer && !onlineResults && !loading && (
          <div className="mb-8 animate-fade-in">
            <p className="text-xs text-slate-500 mb-3 text-center">Try an example:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_QUERIES.map(q => (
                <button
                  key={q}
                  onClick={() => { setQuery(q); handleSearch(q) }}
                  className="text-xs px-3 py-1.5 rounded-full border border-white/10 text-slate-400 hover:text-white hover:border-brand-600/50 transition-all duration-150"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="glass-card p-4 border border-red-800/40 bg-red-950/20 mb-6">
            <p className="text-sm text-red-400">⚠ {error}</p>
          </div>
        )}

        {/* AI Answer */}
        {answer && (
          <div className="mb-8 animate-fade-in">
            <div className="glass-card p-6 border-l-4 border-brand-500 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="text-xs font-semibold text-brand-300 uppercase tracking-wider">AI Answer</span>
                <span className="text-xs text-slate-600 ml-auto">{answer.chunks_used} sources used</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{answer.answer}</p>
            </div>
            {answer.sources?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-slate-500">Sources:</span>
                {answer.sources.map(s => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-surface-600/60 border border-white/5 text-slate-400">{s}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Local Search results */}
        {results && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-400">
                <span className="text-white font-semibold">{results.length}</span> results for "{query}"
              </p>
            </div>
            {results.length === 0 ? (
              <div className="glass-card p-12 text-center flex flex-col items-center">
                <svg className="w-12 h-12 text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-white font-semibold mb-2">No results found</p>
                <p className="text-slate-400 text-sm">Try different keywords, or upload more papers.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((r, i) => <ChunkResult key={i} result={r} rank={i + 1} />)}
              </div>
            )}
          </div>
        )}

        {/* Online Search results */}
        {onlineResults && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-400">
                <span className="text-white font-semibold">{onlineResults.length}</span> online papers for "{query}"
              </p>
            </div>
            {onlineResults.length === 0 ? (
              <div className="glass-card p-12 text-center flex flex-col items-center">
                <svg className="w-12 h-12 text-slate-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-white font-semibold mb-2">No related papers found</p>
                <p className="text-slate-400 text-sm">Try broader keywords or topics.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {onlineResults.map((r, i) => <OnlinePaperCard key={i} paper={r} rank={i + 1} />)}
              </div>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3 animate-fade-in">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="skeleton w-5 h-5 rounded-full" />
                  <div className="skeleton h-3 w-48 rounded" />
                  <div className="skeleton h-3 w-16 rounded ml-auto" />
                </div>
                <div className="space-y-2">
                  <div className="skeleton h-3 rounded w-full" />
                  <div className="skeleton h-3 rounded w-4/5" />
                  <div className="skeleton h-3 rounded w-3/5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
