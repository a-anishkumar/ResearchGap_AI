import { create } from 'zustand'

const useStore = create((set, get) => ({
  // Pages: 'dashboard' | 'upload' | 'processing' | 'graph' | 'gaps' | 'search' | 'projects'
  page: 'projects',
  setPage: (page) => set({ page }),

  // Papers being processed
  papers: [],       // [{ paper_id, filename, stage, progress, error, extraction }]
  setPapers: (papers) => set({ papers }),
  updatePaper: (paper_id, updates) =>
    set(state => ({
      papers: state.papers.map(p => p.paper_id === paper_id ? { ...p, ...updates } : p),
    })),
  removePaper: (paper_id) =>
    set(state => ({
      papers: state.papers.filter(p => p.paper_id !== paper_id),
    })),

  // Paper detail drawer
  selectedPaper: null,
  setSelectedPaper: (paper) => set({ selectedPaper: paper }),

  // Graph data
  graphData: null,   // { nodes: [], links: [] }
  graphStats: null,  // { papers, methods, domains, ... }
  setGraphData: (data) => set({ graphData: data }),
  setGraphStats: (stats) => set({ graphStats: stats }),

  // Gap analysis
  gapAnalysis: null,   // GapAnalysisResponse
  gapSuggestions: null, // GapSuggestResponse
  setGapAnalysis: (data) => set({ gapAnalysis: data }),
  setGapSuggestions: (data) => set({ gapSuggestions: data }),

  // Loading states
  loadingGraph: false,
  loadingGaps: false,
  loadingSuggestions: false,
  setLoadingGraph: (v) => set({ loadingGraph: v }),
  setLoadingGaps: (v) => set({ loadingGaps: v }),
  setLoadingSuggestions: (v) => set({ loadingSuggestions: v }),

  // Health
  health: null,
  setHealth: (h) => set({ health: h }),

  // Paper comparison
  comparePaperIds: [], // max 2 paper_ids
  isCompareModalOpen: false,
  toggleComparePaperId: (paperId) => set(state => {
    const current = state.comparePaperIds
    if (current.includes(paperId)) {
      return { comparePaperIds: current.filter(id => id !== paperId) }
    }
    if (current.length >= 2) {
      // Replace second paper
      return { comparePaperIds: [current[0], paperId] }
    }
    return { comparePaperIds: [...current, paperId] }
  }),
  clearComparePaperIds: () => set({ comparePaperIds: [] }),
  setCompareModalOpen: (open) => set({ isCompareModalOpen: open }),

  // Projects management
  activeProject: null,
  projects: [],
  setActiveProject: (activeProject) => {
    try { localStorage.setItem('activeProject', activeProject) }
    catch(e) {}
    set({ activeProject })
  },
  setProjects: (projects) => set({ projects }),
}))

export default useStore

