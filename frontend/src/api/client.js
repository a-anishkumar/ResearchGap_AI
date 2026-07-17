import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
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

// Graph data
export const getGraphStats = () => api.get('/graph/stats')
export const getGraphData  = () => api.get('/graph/data')

// Gap analysis
export const analyzeGaps  = (topN = 20) => api.get(`/gaps/analyze?top_n=${topN}`)
export const suggestGaps  = (topN = 10) => api.post(`/gaps/suggest?top_n=${topN}`)

// Health
export const getHealth = () => api.get('/health')
