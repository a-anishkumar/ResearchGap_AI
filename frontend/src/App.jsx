import useStore from './api/store'
import Navbar from './components/Navbar'
import UploadPage from './pages/UploadPage'
import ProcessingPage from './pages/ProcessingPage'
import GraphPage from './pages/GraphPage'
import GapsPage from './pages/GapsPage'
import DashboardPage from './pages/DashboardPage'
import SearchPage from './pages/SearchPage'
import ProjectsPage from './pages/ProjectsPage'
import CompareModal from './components/CompareModal'
import { ToastProvider } from './components/Toast'

import { useEffect } from 'react'

function FloatingCompareBar() {
  const { comparePaperIds, clearComparePaperIds, setCompareModalOpen } = useStore()

  if (comparePaperIds.length === 0) return null

  const canCompare = comparePaperIds.length === 2

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface-900/90 border border-brand-500/40 backdrop-blur-md rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4 animate-slide-up">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping" />
        <p className="text-xs font-semibold text-white">
          {comparePaperIds.length} paper{comparePaperIds.length > 1 ? 's' : ''} selected for comparison
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setCompareModalOpen(true)}
          disabled={!canCompare}
          className={`text-xs font-bold px-4 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
            canCompare
              ? 'bg-gradient-to-r from-brand-600 to-accent-cyan text-white shadow-lg shadow-brand-500/20 hover:brightness-110 cursor-pointer'
              : 'bg-surface-700 text-slate-400 cursor-not-allowed border border-white/5'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          {canCompare ? 'Compare Now (2/2)' : `Select 1 More (${comparePaperIds.length}/2)`}
        </button>

        <button
          onClick={clearComparePaperIds}
          className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  )
}

function App() {
  const { page, setPage, activeProject } = useStore()

  // Redirect to projects page if no project is active
  useEffect(() => {
    if (!activeProject && page !== 'projects') {
      setPage('projects')
    }
  }, [activeProject, page, setPage])

  const renderPage = () => {
    switch (page) {
      case 'dashboard':  return <DashboardPage />
      case 'upload':     return <UploadPage />
      case 'processing': return <ProcessingPage />
      case 'graph':      return <GraphPage />
      case 'gaps':       return <GapsPage />
      case 'search':     return <SearchPage />
      case 'projects':   return <ProjectsPage />
      default:           return <ProjectsPage />
    }
  }

  return (
    <ToastProvider>
      <div className="min-h-screen relative">
        {page !== 'projects' && <Navbar />}
        <main>{renderPage()}</main>
        <FloatingCompareBar />
        <CompareModal />
      </div>
    </ToastProvider>
  )
}

export default App
