import { create } from 'zustand'

const useStore = create((set, get) => ({
  // Pages: 'upload' | 'processing' | 'graph' | 'gaps'
  page: 'upload',
  setPage: (page) => set({ page }),

  // Papers being processed
  papers: [],       // [{ paper_id, filename, stage, progress, error, extraction }]
  setPapers: (papers) => set({ papers }),
  updatePaper: (paper_id, updates) =>
    set(state => ({
      papers: state.papers.map(p => p.paper_id === paper_id ? { ...p, ...updates } : p),
    })),

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
}))

export default useStore
