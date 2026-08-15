import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
})

// Request interceptor to dynamically inject the active project header
api.interceptors.request.use((config) => {
  try {
    const activeProject = localStorage.getItem('activeProject') || 'default'
    config.headers['X-Project'] = activeProject
  } catch (e) {
    console.error('Failed reading activeProject from localStorage:', e)
  }
  return config
})

// Upload papers
export const uploadPapers = (files, onUploadProgress) => {
  const form = new FormData()
  files.forEach(f => form.append('files', f))
  return api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  })
}

// Poll status for all papers
export const getAllStatus = () => api.get('/upload/status')

// Poll status for a single paper
export const getPaperStatus = (paperId) => api.get(`/upload/status/${paperId}`)

// Graph data & S2 features
export const getGraphStats    = () => api.get('/graph/stats')
export const getGraphData     = () => api.get('/graph/data')
export const getEntities      = () => api.get('/graph/entities')
export const getNodeDetail    = (nodeId, nodeType) => api.get(`/graph/node/${encodeURIComponent(nodeId)}`, { params: { node_type: nodeType } })
export const getTimeline       = () => api.get('/graph/timeline')
export const connectPapers    = (paperIdA, paperIdB) => api.post('/graph/connect', { paper_id_a: paperIdA, paper_id_b: paperIdB })
export const getAuthorNetwork = () => api.get('/graph/authors')
export const getAuthorDetail  = (name) => api.get(`/graph/authors/${encodeURIComponent(name)}`)


// Gap analysis
export const analyzeGaps  = (topN = 20) => api.get(`/gaps/analyze?top_n=${topN}`)
export const suggestGaps  = (topN = 10) => api.post(`/gaps/suggest?top_n=${topN}`)

// Health
export const getHealth = () => api.get('/health')

// Delete paper
export const deletePaper = (paperId) => api.delete(`/upload/${paperId}`)

// Search / RAG chat
export const searchPapers = (query, topK = 8) => api.post('/search', { query, top_k: topK })
export const askQuestion  = (question, topK = 5) => api.post('/search/ask', { question, top_k: topK })
export const searchOnline = (query, maxResults = 10) => api.get('/search/online', { params: { query, max_results: maxResults } })

// Paper detail, analysis, comparison & chat
export const getPaper       = (paperId) => api.get(`/papers/${paperId}`)
export const reprocessPaper = (paperId) => api.post(`/papers/${paperId}/reprocess`)
export const analyzePaper   = (paperId) => api.post(`/papers/${paperId}/analyze`)
export const comparePapers  = (paperIdA, paperIdB) => api.post('/papers/compare', { paper_id_a: paperIdA, paper_id_b: paperIdB })
export const chatWithPaper  = (paperId, message, conversationId) => api.post(`/papers/${paperId}/chat`, { message, conversation_id: conversationId })
export const getPaperChatHistory = (paperId, conversationId) => api.get(`/papers/${paperId}/chat/history`, { params: { conversation_id: conversationId } })
export const explainSelection    = (paperId, selectedText) => api.post(`/papers/${paperId}/explain-selection`, { selected_text: selectedText })

// Proposal & Polish
export const generateProposal = (method, domain, suggestion = '') => api.post(`/gaps/proposals/generate?method=${encodeURIComponent(method)}&domain=${encodeURIComponent(domain)}&suggestion=${encodeURIComponent(suggestion)}`)
export const getProposal      = (id) => api.get(`/gaps/proposals/${encodeURIComponent(id)}`)
export const polishProposal   = (id) => api.post(`/gaps/proposals/${encodeURIComponent(id)}/polish`)

// Projects Management
export const getProjects    = () => api.get('/projects')
export const deleteProject  = (name) => api.delete(`/projects/${encodeURIComponent(name)}`)

// Ollama Management & Controls
export const getOllamaStatus = () => api.get('/ollama/status')
export const getOllamaModels = () => api.get('/ollama/models')
export const updateOllamaConfig = (config) => api.post('/ollama/config', config)

// Export helpers
export const exportProposalPDF = (id) => `/api/gaps/proposals/${encodeURIComponent(id)}/export`
export const exportProposalMarkdown = (id) => `/api/gaps/proposals/${encodeURIComponent(id)}/export/markdown`
export const exportProposalLatex = (id) => `/api/gaps/proposals/${encodeURIComponent(id)}/export/latex`




