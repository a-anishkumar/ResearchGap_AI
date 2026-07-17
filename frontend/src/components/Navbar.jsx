import { useEffect } from 'react'
import { getHealth } from '../api/client'
import useStore from '../api/store'

const NAV_ITEMS = [
  { id: 'upload',     label: 'Upload Papers', icon: '📄' },
  { id: 'processing', label: 'Processing',    icon: '⚙️' },
  { id: 'graph',      label: 'Knowledge Graph', icon: '🕸️' },
  { id: 'gaps',       label: 'Research Gaps',  icon: '🔬' },
]

export default function Navbar() {
  const { page, setPage, health, setHealth } = useStore()

  useEffect(() => {
    getHealth()
      .then(r => setHealth(r.data))
      .catch(() => setHealth({ status: 'error' }))
  }, [setHealth])

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-surface-900/80 backdrop-blur-xl">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center text-base">
            🔭
          </div>
          <div>
            <span className="font-display font-bold text-white text-lg leading-none">ResearchGap</span>
            <span className="text-brand-400 font-bold text-lg"> AI</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => setPage(item.id)}
              className={`nav-link ${page === item.id ? 'active' : ''}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Health indicator */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              health?.neo4j === 'connected' ? 'bg-accent-green animate-pulse-slow' : 'bg-amber-400'
            }`}
          />
          <span className="text-slate-400">
            {health?.neo4j === 'connected' ? 'Neo4j connected' : 'Neo4j pending'}
          </span>
          {health?.gemini_key_set && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-accent-green">Gemini ✓</span>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
