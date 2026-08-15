import { useEffect, useState, useRef } from 'react'
import { getProjects } from '../api/client'
import useStore from '../api/store'
import OllamaControlModal from './OllamaControlModal'

// ── Icons ──────────────────────────────────────────────────────────────────────
function Icon({ d, d2, className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
      {d2 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d2} />}
    </svg>
  )
}

const ICONS = {
  dashboard:  "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
  upload:     "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  processing: { d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z", d2: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  graph:      "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
  timeline:   "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  authors:    "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  gaps:       "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  search:     "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  projects:   "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
  chevronDown:"M19 9l-7 7-7-7",
  folder:     "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z",
  eye:        { d: "M15 12a3 3 0 11-6 0 3 3 0 016 0z", d2: "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" },
}

// Core nav items always visible
const CORE_NAV = [
  { id: 'dashboard',  label: 'Dashboard',   icon: ICONS.dashboard },
  { id: 'upload',     label: 'Upload',      icon: ICONS.upload },
  { id: 'processing', label: 'Processing',  icon: ICONS.processing },
]

// Analytics items in "More" dropdown on small screens
const ANALYTICS_NAV = [
  { id: 'graph',    label: 'Knowledge Graph', icon: ICONS.graph },
  { id: 'timeline', label: 'Timeline',        icon: ICONS.timeline },
  { id: 'authors',  label: 'Authors',         icon: ICONS.authors },
  { id: 'gaps',     label: 'Research Gaps',   icon: ICONS.gaps },
  { id: 'search',   label: 'Search',          icon: ICONS.search },
  { id: 'projects', label: 'Projects',        icon: ICONS.projects },
]

function NavBtn({ item, isActive, isDisabled, onClick }) {
  const icon = item.icon
  return (
    <button
      id={`nav-${item.id}`}
      disabled={isDisabled}
      onClick={onClick}
      title={isDisabled ? 'Select a project first' : item.label}
      className={`nav-link ${isActive ? 'active' : ''} ${
        isDisabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-slate-400' : ''
      }`}
    >
      <span className="shrink-0">
        <Icon d={typeof icon === 'string' ? icon : icon.d} d2={typeof icon === 'object' ? icon.d2 : undefined} />
      </span>
      <span className="whitespace-nowrap">{item.label}</span>
    </button>
  )
}

export default function Navbar() {
  const { page, setPage, health, setHealth, activeProject, setActiveProject, projects, setProjects } = useStore()
  const [moreOpen, setMoreOpen] = useState(false)
  const [isOllamaModalOpen, setOllamaModalOpen] = useState(false)
  const moreRef = useRef(null)

  useEffect(() => {
    getProjects()
      .then(r => setProjects(r.data))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Check health
  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(d => setHealth(d))
      .catch(() => setHealth({ status: 'error' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const analyticsActive = ANALYTICS_NAV.some(i => i.id === page)

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between px-3 lg:px-5 py-2 border-b border-white/5 bg-surface-900/92 backdrop-blur-xl gap-2">

        {/* Logo */}
        <div
          className="flex items-center gap-2 shrink-0 cursor-pointer group"
          onClick={() => setPage(activeProject ? 'dashboard' : 'projects')}
          title="Go to Dashboard"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center shadow-md group-hover:shadow-brand-500/40 transition-shadow">
            <Icon d={ICONS.eye.d} d2={ICONS.eye.d2} className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-display font-bold text-white text-sm">ResearchGap</span>
            <span className="text-brand-400 font-bold text-xs tracking-wide">AI</span>
          </div>
        </div>

        {/* Core nav — always visible */}
        <nav className="flex items-center gap-0.5">
          {CORE_NAV.map(item => {
            const isDisabled = !activeProject && item.id !== 'projects' && item.id !== 'dashboard'
            return (
              <NavBtn
                key={item.id}
                item={item}
                isActive={page === item.id}
                isDisabled={isDisabled}
                onClick={() => { setPage(item.id); setMoreOpen(false) }}
              />
            )
          })}

          {/* Analytics "More" dropdown */}
          <div className="relative" ref={moreRef}>
            <button
              id="nav-more"
              onClick={() => setMoreOpen(v => !v)}
              className={`nav-link ${analyticsActive ? 'active' : ''} ${!activeProject ? 'opacity-30 cursor-not-allowed' : ''}`}
              disabled={!activeProject}
              title="Analytics tools"
            >
              <span>Analytics</span>
              <Icon d={ICONS.chevronDown} className={`w-3.5 h-3.5 transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
              {analyticsActive && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-400 ring-2 ring-surface-900" />
              )}
            </button>

            {moreOpen && activeProject && (
              <div className="absolute top-full left-0 mt-1.5 w-52 bg-surface-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
                <div className="p-1">
                  {ANALYTICS_NAV.map(item => {
                    const isActive = page === item.id
                    return (
                      <button
                        key={item.id}
                        id={`nav-${item.id}`}
                        onClick={() => { setPage(item.id); setMoreOpen(false) }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left
                          ${isActive
                            ? 'bg-brand-900/60 text-white border border-brand-700/40'
                            : 'text-slate-400 hover:text-white hover:bg-surface-600/60'
                          }`}
                      >
                        <Icon
                          d={typeof item.icon === 'string' ? item.icon : item.icon.d}
                          d2={typeof item.icon === 'object' ? item.icon.d2 : undefined}
                          className="w-4 h-4 shrink-0"
                        />
                        {item.label}
                        {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Right: Project switcher + Ollama control + health */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Ollama Control Center Trigger */}
          <button
            onClick={() => setOllamaModalOpen(true)}
            className="flex items-center gap-1.5 bg-indigo-950/40 hover:bg-indigo-900/60 px-2.5 py-1.5 rounded-xl border border-indigo-500/30 text-indigo-300 text-xs font-medium transition cursor-pointer"
            title="Open Ollama Local AI Control Center"
          >
            <span>🦙</span>
            <span className="hidden sm:inline">Ollama AI</span>
          </button>

          {/* Project switcher */}
          <div className="relative flex items-center gap-1.5 bg-surface-700/40 hover:bg-surface-600/50 px-2.5 py-1.5 rounded-xl border border-white/8 transition-colors cursor-pointer max-w-[160px] sm:max-w-[200px]"
            title="Switch active project"
          >
            <Icon d={ICONS.folder} className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={activeProject || ''}
              onChange={(e) => {
                if (e.target.value) {
                  setActiveProject(e.target.value)
                  window.location.reload()
                }
              }}
              className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer truncate w-full appearance-none"
            >
              {!activeProject && (
                <option value="" className="bg-surface-900 text-slate-400 text-xs">Select project…</option>
              )}
              {projects.map(p => (
                <option key={p.name} value={p.name} className="bg-surface-900 text-white text-xs">
                  {p.name} ({p.paper_count})
                </option>
              ))}
            </select>
            <Icon d={ICONS.chevronDown} className="w-3 h-3 text-slate-500 shrink-0 pointer-events-none" />
          </div>

          {/* Health pill */}
          <div className="hidden md:flex items-center gap-1.5 text-xs bg-surface-800/50 px-2.5 py-1.5 rounded-xl border border-white/5">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                health?.neo4j === 'connected' ? 'bg-emerald-400 animate-pulse-slow' : 'bg-amber-400'
              }`}
              title={health?.neo4j === 'connected' ? 'Neo4j Connected' : 'SQLite Fallback'}
            />
            <span className="text-slate-300 font-medium">
              {health?.neo4j === 'connected' ? 'Neo4j' : 'SQLite'}
            </span>
            {health?.gemini_key_set && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-emerald-400 font-medium">Gemini</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ollama Modal */}
      <OllamaControlModal
        isOpen={isOllamaModalOpen}
        onClose={() => setOllamaModalOpen(false)}
      />
    </header>
  )
}
