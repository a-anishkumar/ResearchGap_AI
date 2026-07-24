import { useEffect } from 'react'
import { getHealth, getProjects } from '../api/client'
import useStore from '../api/store'

// ── Clean Vector Icons ────────────────────────────────────────────────────────
function DashboardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}

function ProcessingIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function GraphIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )
}

function GapsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function ProjectsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function LogoIcon() {
  return (
    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

function TimelineIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function AuthorsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',       icon: <DashboardIcon /> },
  { id: 'upload',      label: 'Upload Papers',   icon: <UploadIcon /> },
  { id: 'processing',  label: 'Processing',      icon: <ProcessingIcon /> },
  { id: 'graph',       label: 'Knowledge Graph', icon: <GraphIcon /> },
  { id: 'timeline',    label: 'Timeline',        icon: <TimelineIcon /> },
  { id: 'authors',     label: 'Author Network',  icon: <AuthorsIcon /> },
  { id: 'gaps',        label: 'Research Gaps',   icon: <GapsIcon /> },
  { id: 'search',      label: 'Search',          icon: <SearchIcon /> },
  { id: 'projects',    label: 'Projects',        icon: <ProjectsIcon /> },
]

export default function Navbar() {
  const { page, setPage, health, setHealth, activeProject, setActiveProject, projects, setProjects } = useStore()

  useEffect(() => {
    getHealth()
      .then(r => setHealth(r.data))
      .catch(() => setHealth({ status: 'error' }))

    getProjects()
      .then(r => setProjects(r.data))
      .catch(() => {})
  }, [setHealth, setProjects])

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between px-3 lg:px-6 py-2.5 border-b border-white/5 bg-surface-900/90 backdrop-blur-xl gap-2">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0 cursor-pointer" onClick={() => setPage('dashboard')}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-purple flex items-center justify-center shadow-md">
            <LogoIcon />
          </div>
          <div className="hidden sm:block">
            <span className="font-display font-bold text-white text-base lg:text-lg leading-none">ResearchGap</span>
            <span className="text-brand-400 font-bold text-base lg:text-lg"> AI</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-0.5 lg:gap-1 overflow-x-auto no-scrollbar py-0.5">
          {NAV_ITEMS.map(item => {
            const isDisabled = !activeProject && item.id !== 'projects'
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                disabled={isDisabled}
                onClick={() => setPage(item.id)}
                className={`nav-link ${page === item.id ? 'active' : ''} ${
                  isDisabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-slate-400' : ''
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Right tools: Switcher + Health */}
        <div className="flex items-center gap-2 lg:gap-3 shrink-0">
          {/* Project selection */}
          <div className="flex items-center gap-1.5 bg-surface-600/40 px-2.5 py-1 rounded-xl border border-white/5 max-w-[140px] sm:max-w-[180px]">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline shrink-0">Project:</span>
            <select
              value={activeProject || ''}
              onChange={(e) => {
                if (e.target.value) {
                  setActiveProject(e.target.value)
                  window.location.reload()
                }
              }}
              className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer py-0.5 pr-1 truncate w-full"
            >
              {!activeProject && <option value="" className="bg-surface-900 text-slate-400 text-xs">Select Project...</option>}
              {projects.length > 0 ? (
                projects.map(p => (
                  <option key={p.name} value={p.name} className="bg-surface-900 text-white text-xs">
                    {p.name} ({p.paper_count})
                  </option>
                ))
              ) : (
                <option value="default" className="bg-surface-900 text-white text-xs">default (0)</option>
              )}
            </select>
          </div>

          {/* Health indicator */}
          <div className="hidden md:flex items-center gap-2 text-xs shrink-0 bg-surface-800/50 px-2.5 py-1 rounded-xl border border-white/5">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                health?.neo4j === 'connected' ? 'bg-accent-green animate-pulse-slow' : 'bg-amber-400'
              }`}
              title={health?.neo4j === 'connected' ? 'Neo4j Connected' : 'SQLite Fallback Active'}
            />
            <span className="text-slate-300 font-medium">
              {health?.neo4j === 'connected' ? 'Neo4j' : 'SQLite'}
            </span>
            {health?.gemini_key_set && (
              <>
                <span className="text-slate-600">·</span>
                <span className="text-accent-green font-medium">Gemini</span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
