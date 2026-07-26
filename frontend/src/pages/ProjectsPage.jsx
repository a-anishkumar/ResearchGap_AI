import React, { useEffect, useState, useCallback } from 'react'
import useStore from '../api/store'
import { getProjects, deleteProject } from '../api/client'
import { useToast } from '../components/Toast'

// Icons
function FolderIcon({ className = "w-6 h-6" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function PlusIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

function TrashIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function CalendarIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function PaperIcon({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

export default function ProjectsPage() {
  const { activeProject, setActiveProject, projects, setProjects, setPage } = useStore()
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [deletingName, setDeletingName] = useState(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await getProjects()
      setProjects(data)
    } catch (e) {
      toast.error('Failed to load projects list')
    } finally {
      setLoading(false)
    }
  }, [setProjects, toast])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Select project
  const handleSelectProject = (name) => {
    setActiveProject(name)
    toast.success(`Switched active project to "${name}"`)
    setPage('dashboard')
  }

  // Create project
  const handleCreateProject = (e) => {
    e.preventDefault()
    const name = newProjectName.trim().toLowerCase()
    if (!name) return

    // Sanitize name
    const sanitized = name.replace(/[^a-z0-9-_]/g, '')
    if (!sanitized) {
      toast.error('Project name can only contain letters, numbers, hyphens, and underscores.')
      return
    }

    if (projects.some(p => p.name === sanitized)) {
      toast.error(`Project "${sanitized}" already exists!`)
      return
    }

    // Set active in frontend store (the backend context middleware will auto-create on first request)
    setActiveProject(sanitized)
    setNewProjectName('')
    toast.success(`Project "${sanitized}" created and selected!`)
    setPage('dashboard')
  }

  // Delete project
  const handleDeleteProject = async (e, name) => {
    e.stopPropagation() // Don't trigger select
    if (!window.confirm(`Are you absolutely sure you want to delete project "${name}"? This will permanently delete all raw PDF documents, database records, and AI models associated with it.`)) {
      return
    }

    setDeletingName(name)
    try {
      await deleteProject(name)
      toast.success(`Project "${name}" deleted successfully`)
      
      // If we deleted the active project, switch to default
      if (activeProject === name) {
        setActiveProject('default')
      }
      
      fetchProjects()
    } catch (err) {
      toast.error(`Failed to delete project: ${err.message}`)
    } finally {
      setDeletingName(null)
    }
  }

  // Helper to format ISO timestamp
  const formatDate = (isoStr) => {
    if (!isoStr) return 'N/A'
    try {
      const date = new Date(isoStr)
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch (e) {
      return isoStr
    }
  }

  return (
    <div className="min-h-screen mesh-bg pt-20 px-6 py-10">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-950/60 border border-brand-800/40 text-brand-300 text-xs font-semibold mb-4">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Workspace Manager
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-2">
            Research Projects
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-xl">
            Organize your research papers into isolated workspace projects to analyze them separately.
          </p>
        </div>

        {/* Create new project widget */}
        <div className="glass-card p-5 mb-8 border border-white/5 animate-slide-up">
          <form onSubmit={handleCreateProject} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
            <div className="flex-1 w-full">
              <label htmlFor="new-proj-name" className="text-xs font-semibold text-slate-400 block mb-1.5 uppercase tracking-wider">
                Create New Research Project
              </label>
              <input
                id="new-proj-name"
                type="text"
                placeholder="e.g. quantum-nlp, biomed-imaging"
                value={newProjectName}
                onChange={e => setNewProjectName(e.target.value)}
                className="input-base text-sm w-full py-2.5"
                required
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full sm:w-auto text-xs py-3 px-6 shrink-0 flex items-center justify-center gap-1.5"
            >
              <PlusIcon />
              Create Project
            </button>
          </form>
        </div>

        {/* Project List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white mb-3">Your Projects ({projects.length})</h2>

          {loading && projects.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {projects.map((proj, idx) => {
                const isActive = activeProject === proj.name
                const isDeleting = deletingName === proj.name

                return (
                  <div
                    key={proj.name}
                    onClick={() => handleSelectProject(proj.name)}
                    className={`glass-card p-5 flex flex-wrap items-center justify-between gap-4 border transition-all cursor-pointer relative overflow-hidden group
                      ${isActive 
                        ? 'border-brand-500 bg-brand-900/10 shadow-glow-brand' 
                        : 'border-white/5 hover:border-white/10 hover:bg-white/[0.02]'
                      }
                      animate-slide-up`}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    {/* Active banner glow */}
                    {isActive && (
                      <div className="absolute top-0 left-0 bottom-0 w-1 bg-brand-500" />
                    )}

                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border
                        ${isActive 
                          ? 'bg-brand-950/80 border-brand-700/50 text-brand-400' 
                          : 'bg-surface-600/60 border-white/5 text-slate-500 group-hover:text-slate-300'
                        }
                        transition-transform duration-200 group-hover:scale-105`}
                      >
                        <FolderIcon className="w-6 h-6" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-bold text-white text-base leading-snug truncate max-w-[200px] md:max-w-xs">
                            {proj.name}
                          </h3>
                          {isActive && (
                            <span className="badge bg-brand-500/20 text-brand-300 border border-brand-500/30 text-[9px] px-1.5 py-0">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3.5 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1.5 shrink-0">
                            <PaperIcon />
                            {proj.paper_count} paper{proj.paper_count !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <CalendarIcon />
                            Uploaded: {formatDate(proj.uploaded_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Delete project button */}
                      <button
                        onClick={(e) => handleDeleteProject(e, proj.name)}
                        disabled={isDeleting}
                        className="p-2.5 rounded-xl border border-white/5 bg-surface-500 hover:bg-red-950/20 hover:border-red-800/40 text-slate-400 hover:text-red-400 transition-all duration-150"
                        title={proj.name === 'default' ? 'Clear all papers in Default project' : 'Delete Project'}
                      >
                        {isDeleting ? (
                          <span className="w-4 h-4 border border-slate-500 border-t-transparent rounded-full animate-spin inline-block" />
                        ) : (
                          <TrashIcon />
                        )}
                      </button>
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
