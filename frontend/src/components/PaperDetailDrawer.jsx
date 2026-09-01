import { useEffect, useState, useRef } from 'react'
import { getPaper, reprocessPaper, analyzePaper, chatWithPaper, getPaperChatHistory, explainSelection, deletePaper } from '../api/client'
import useStore from '../api/store'
import { useToast } from './Toast'
import { formatNodeLabel } from '../utils/textUtils'

export default function PaperDetailDrawer() {
  const { 
    selectedPaper, 
    setSelectedPaper, 
    updatePaper, 
    removePaper,
    setGraphData,
    setGraphStats,
    setGapAnalysis,
    setGapSuggestions,
    toggleComparePaperId, 
    comparePaperIds, 
    setCompareModalOpen 
  } = useStore()
  const toast = useToast()
  
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingPaper, setDeletingPaper] = useState(false)
  
  // Tab state: 'meta' | 'analysis' | 'chat'
  const [activeTab, setActiveTab] = useState('meta')
  
  // Analysis state
  const [analysis, setAnalysis] = useState(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)

  // Chat state
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [conversationId, setConversationId] = useState(null)
  const [sendingChat, setSendingChat] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [activeCitation, setActiveCitation] = useState(null)
  const chatEndRef = useRef(null)

  // Highlight-to-explain state
  const [selectionPopover, setSelectionPopover] = useState(null) // { text, x, y }
  const [explaining, setExplaining] = useState(false)
  const [explanationResult, setExplanationResult] = useState(null)


  useEffect(() => {
    if (!selectedPaper) { 
      setDetail(null)
      setAnalysis(null)
      setChatMessages([])
      setConversationId(null)
      setActiveTab('meta')
      setSelectionPopover(null)
      setExplanationResult(null)
      setShowDeleteConfirm(false)
      return 
    }
    setDetail(null)
    setAnalysis(null)
    setShowDeleteConfirm(false)
    setLoading(true)

    getPaper(selectedPaper.paper_id)
      .then(r => setDetail(r.data))
      .catch(e => {
        toast.error(e?.response?.data?.detail || 'Failed to load paper details')
        setSelectedPaper(null)
      })
      .finally(() => setLoading(false))
  }, [selectedPaper?.paper_id])

  // Fetch deep analysis when switching to 'analysis' tab
  useEffect(() => {
    if (activeTab === 'analysis' && selectedPaper && !analysis && !loadingAnalysis) {
      setLoadingAnalysis(true)
      analyzePaper(selectedPaper.paper_id)
        .then(res => setAnalysis(res.data))
        .catch(err => toast.error(err?.response?.data?.detail || 'Failed to generate paper analysis'))
        .finally(() => setLoadingAnalysis(false))
    }
  }, [activeTab, selectedPaper?.paper_id])

  // Fetch chat history when switching to 'chat' tab
  useEffect(() => {
    if (activeTab === 'chat' && selectedPaper && chatMessages.length === 0) {
      setLoadingHistory(true)
      getPaperChatHistory(selectedPaper.paper_id, conversationId)
        .then(res => {
          if (res.data && res.data.length > 0) {
            setChatMessages(res.data)
            setConversationId(res.data[0].conversation_id)
          }
        })
        .catch(err => console.warn('Failed loading chat history:', err))

        .finally(() => setLoadingHistory(false))
    }
  }, [activeTab, selectedPaper?.paper_id])

  // Auto scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, activeTab])

  const handleSendMessage = async (e) => {
    e?.preventDefault()
    if (!chatInput.trim() || sendingChat || !selectedPaper) return

    const userText = chatInput.trim()
    setChatInput('')

    const tempUserTurn = { role: 'user', content: userText }
    setChatMessages(prev => [...prev, tempUserTurn])
    setSendingChat(true)

    try {
      const res = await chatWithPaper(selectedPaper.paper_id, userText, conversationId)
      const assistantTurn = {
        role: 'assistant',
        content: res.data.answer,
        citations: res.data.citations || [],
        conversation_id: res.data.conversation_id,
      }
      setConversationId(res.data.conversation_id)
      setChatMessages(prev => [...prev, assistantTurn])
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send message')
    } finally {
      setSendingChat(false)
    }
  }

  const handleReprocess = async () => {
    if (!selectedPaper) return
    setReprocessing(true)
    try {
      await reprocessPaper(selectedPaper.paper_id)
      toast.success(`Re-extraction started for "${selectedPaper.filename}"`)
      updatePaper(selectedPaper.paper_id, { stage: 'uploaded', progress: 5, error: null })
      setSelectedPaper(null)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to start re-extraction')
    } finally {
      setReprocessing(false)
    }
  }

  const handleDeletePaper = async () => {
    if (!selectedPaper) return
    setDeletingPaper(true)
    try {
      await deletePaper(selectedPaper.paper_id)
      removePaper(selectedPaper.paper_id)
      setGraphData(null) // clear graph cache so it reloads
      setGraphStats(null)
      setGapAnalysis(null) // clear gaps cache so it reloads
      setGapSuggestions(null)
      toast.success(`Deleted paper "${detail?.title || selectedPaper.filename}"`)
      setSelectedPaper(null)
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || 'Failed to delete paper')
    } finally {
      setDeletingPaper(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleCompareClick = () => {
    if (!selectedPaper) return
    toggleComparePaperId(selectedPaper.paper_id)
    if (comparePaperIds.length === 1 && !comparePaperIds.includes(selectedPaper.paper_id)) {
      setCompareModalOpen(true)
    } else {
      toast.info(`Paper added for comparison. Select one more paper to view side-by-side comparison.`)
    }
  }

  // Text Selection / Highlight handler
  const handleTextSelection = (e) => {
    const sel = window.getSelection()
    const text = sel ? sel.toString().trim() : ''
    if (text.length >= 8) {
      setSelectionPopover({
        text,
        x: e.clientX,
        y: e.clientY - 40,
      })
    } else {
      setSelectionPopover(null)
    }
  }

  const handleRequestExplanation = async () => {
    if (!selectionPopover?.text || !selectedPaper) return
    const textToExplain = selectionPopover.text
    setExplaining(true)
    try {
      const res = await explainSelection(selectedPaper.paper_id, textToExplain)
      setExplanationResult({
        selected_text: textToExplain,
        explanation: res.data.explanation,
      })
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to explain selection')
    } finally {
      setExplaining(false)
      setSelectionPopover(null)
    }
  }

  if (!selectedPaper) return null

  const isSelectedForCompare = comparePaperIds.includes(selectedPaper.paper_id)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm animate-fade-in"
        onClick={() => { setSelectedPaper(null); setSelectionPopover(null); setExplanationResult(null) }}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-surface-900 border-l border-white/10 flex flex-col shadow-2xl relative"
           style={{ animation: 'slideInRight 0.25s ease-out' }}>

        {/* Delete Confirmation Overlay */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-50 bg-surface-900/95 backdrop-blur-md p-6 flex flex-col justify-between animate-fade-in">
            <div className="space-y-4 pt-8">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Research Paper?</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-white">"{detail?.title || selectedPaper.filename}"</strong>?
                </p>
              </div>
              <p className="text-xs text-slate-400 leading-normal bg-red-950/30 border border-red-500/20 p-3 rounded-xl">
                ⚠️ This action cannot be undone. It will permanently delete this paper's graph relationships, extracted entities, vector embeddings, and PDF raw storage.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-white/10">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary text-xs flex-1 justify-center py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePaper}
                disabled={deletingPaper}
                className="text-xs font-bold px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white flex-1 justify-center flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {deletingPaper ? (
                  <><span className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" /> Deleting...</>
                ) : (
                  'Yes, Delete Paper'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-white/5 bg-surface-850">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-white truncate max-w-xs">
                  {detail?.title || selectedPaper.filename}
                </p>
                <p className="text-xs text-slate-500 font-mono">{selectedPaper.paper_id?.slice(0, 8)}…</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedPaper(null)}
              className="text-slate-400 hover:text-white text-xl leading-none p-1 transition-colors"
            >
              ×
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-2 border-t border-white/5 pt-3 overflow-x-auto">
            <button
              onClick={() => setActiveTab('meta')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'meta'
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Taxonomy & Meta
            </button>

            <button
              onClick={() => setActiveTab('analysis')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'analysis'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-accent-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Deep AI Analysis
              {analysis && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'chat'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Chat with Paper
              {chatMessages.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-purple-500/40 text-[10px] text-purple-200">
                  {chatMessages.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5 space-y-6 relative"
          onMouseUp={handleTextSelection}
        >

          {/* Floating Highlight-to-Explain Trigger Popover */}
          {selectionPopover && (
            <div className="fixed z-50 animate-bounce">
              <button
                onClick={handleRequestExplanation}
                className="bg-gradient-to-r from-purple-600 to-brand-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 hover:brightness-110 border border-white/20"
                style={{
                  position: 'fixed',
                  left: Math.min(selectionPopover.x, window.innerWidth - 180),
                  top: Math.max(10, selectionPopover.y),
                }}
              >
                <svg className="w-3.5 h-3.5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 01-2 2h-4a2 2 0 01-2-2v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {explaining ? 'Explaining...' : '💡 Explain Selection'}
              </button>
            </div>
          )}

          {/* Explanation Result Card Modal */}
          {explanationResult && (
            <div className="glass-card p-4 border-purple-500/40 bg-purple-950/30 animate-fade-in relative">
              <button
                onClick={() => setExplanationResult(null)}
                className="absolute top-2 right-2 text-slate-400 hover:text-white text-sm"
              >
                ×
              </button>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block mb-1">
                💡 Simplified Text Explanation
              </span>
              <p className="text-xs text-slate-300 italic mb-2 border-l-2 border-purple-500/40 pl-2 line-clamp-2">
                "{explanationResult.selected_text}"
              </p>
              <p className="text-xs text-white leading-relaxed font-medium">
                {explanationResult.explanation}
              </p>
            </div>
          )}

          {/* Tab 1: Metadata & Taxonomy */}
          {activeTab === 'meta' && (
            <>
              {loading && (
                <div className="space-y-4 animate-fade-in">
                  <div className="skeleton h-5 w-3/4 rounded" />
                  <div className="skeleton h-4 w-1/2 rounded" />
                  <div className="grid grid-cols-2 gap-3">
                    {[1,2,3,4].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}
                  </div>
                  <div className="skeleton h-32 rounded-xl" />
                </div>
              )}

              {detail && (
                <>
                  {/* Tip banner */}
                  <div className="bg-surface-800/60 border border-white/5 rounded-lg p-2.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span>💡 Tip: Highlight any text in this drawer to get an instant AI explanation.</span>
                  </div>

                  {/* Meta */}
                  <div className="glass-card p-4">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Metadata</h3>
                    <div className="space-y-2">
                      {detail.title && (
                        <div>
                          <p className="text-xs text-slate-500">Title</p>
                          <p className="text-sm text-white font-medium leading-snug">{detail.title}</p>
                        </div>
                      )}
                      {detail.year && (
                        <div>
                          <p className="text-xs text-slate-500">Year</p>
                          <p className="text-sm text-white">{detail.year}</p>
                        </div>
                      )}
                      {detail.authors?.length > 0 && (
                        <div>
                          <p className="text-xs text-slate-500">Authors</p>
                          <p className="text-sm text-slate-300">{detail.authors.join(', ')}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Methods */}
                  {detail.methods?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Methods</h3>
                      <div className="flex flex-wrap gap-2">
                        {detail.methods.map(m => (
                          <span key={m} className="badge-method flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {formatNodeLabel(m)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Domains */}
                  {detail.domains?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Domains</h3>
                      <div className="flex flex-wrap gap-2">
                        {detail.domains.map(d => (
                          <span key={d} className="badge-domain flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                            {formatNodeLabel(d)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Datasets */}
                  {detail.datasets?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Datasets</h3>
                      <div className="flex flex-wrap gap-2">
                        {detail.datasets.map(d => (
                          <span key={d} className="badge-dataset flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                            </svg>
                            {formatNodeLabel(d)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Related papers */}
                  {detail.related_papers?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Related Papers</h3>
                      <div className="space-y-2">
                        {detail.related_papers.map(rp => (
                          <div key={rp.paper_id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-600/50 border border-white/5">
                            <p className="text-xs text-slate-300 truncate flex-1">{rp.title || rp.paper_id.slice(0, 12)}</p>
                            <span className="text-xs text-brand-400 font-semibold ml-3 shrink-0">{rp.relevance?.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Tab 2: Deep AI Analysis */}
          {activeTab === 'analysis' && (
            <div className="space-y-5 animate-fade-in">
              {loadingAnalysis && (
                <div className="py-10 text-center space-y-3">
                  <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-cyan-300 font-medium animate-pulse">
                    Synthesizing paper chunks & cross-referencing research gaps via AI…
                  </p>
                </div>
              )}

              {analysis && (
                <>
                  {/* Executive Summary */}
                  <div className="glass-card p-4 space-y-2 border-brand-500/20">
                    <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Executive Summary
                    </h4>
                    <p className="text-xs text-slate-200 leading-relaxed font-medium">
                      {analysis.summary}
                    </p>
                  </div>

                  {/* Contributions vs Incremental */}
                  <div className="grid grid-cols-1 gap-3">
                    {/* Key Contributions */}
                    <div className="bg-surface-800/80 p-4 rounded-xl border border-emerald-500/20">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Key Contribution(s)
                      </h4>
                      <ul className="space-y-1.5">
                        {analysis.key_contributions?.map((item, idx) => (
                          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Incremental Aspects */}
                    <div className="bg-surface-800/80 p-4 rounded-xl border border-amber-500/20">
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        Incremental / Standard Elements
                      </h4>
                      <ul className="space-y-1.5">
                        {analysis.incremental_aspects?.map((item, idx) => (
                          <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                            <span className="text-amber-400 font-bold">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Methodology Evaluation */}
                  <div className="glass-card p-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Methodology Evaluation
                    </h4>
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20">
                        <span className="text-[11px] font-bold text-emerald-400 block mb-1">Strengths</span>
                        <ul className="space-y-1">
                          {analysis.strengths?.map((s, idx) => (
                            <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5">
                              <span className="text-emerald-400">✓</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-2.5 rounded-lg bg-red-950/30 border border-red-500/20">
                        <span className="text-[11px] font-bold text-red-400 block mb-1">Limitations & Weaknesses</span>
                        <ul className="space-y-1">
                          {analysis.weaknesses?.map((w, idx) => (
                            <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5">
                              <span className="text-red-400">⚠</span> {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Gap Relation */}
                  <div className="bg-surface-800/90 p-4 rounded-xl border border-cyan-500/30">
                    <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Relation to Corpus Research Gaps
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {analysis.gap_relation}
                    </p>
                  </div>

                  {/* Follow-up Questions */}
                  <div className="glass-card p-4 space-y-2">
                    <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                      Suggested Follow-up Questions
                    </h4>
                    <div className="space-y-2">
                      {analysis.followup_questions?.map((q, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-surface-700/50 border border-white/5 text-xs text-slate-200">
                          <span className="font-bold text-purple-400 mr-2">Q{idx + 1}:</span>
                          {q}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab 3: Chat with Paper */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-[520px] bg-surface-950/60 rounded-xl border border-white/5 overflow-hidden animate-fade-in">
              {/* Chat Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingHistory && (
                  <p className="text-center text-xs text-slate-500 py-4">Loading past conversation history…</p>
                )}

                {!loadingHistory && chatMessages.length === 0 && (
                  <div className="py-12 text-center space-y-3 px-4">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-bold text-white">Ask Anything About This Paper</h4>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Questions are answered using RAG over the exact chunks of this PDF, complete with source citations.
                    </p>
                    <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                      {['What is the primary methodology?', 'What datasets were used?', 'What are the main performance metrics?'].map((sample, idx) => (
                        <button
                          key={idx}
                          onClick={() => setChatInput(sample)}
                          className="text-[11px] text-purple-300 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 px-2.5 py-1 rounded-full transition-colors"
                        >
                          "{sample}"
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatMessages.map((msg, idx) => {
                  const isUser = msg.role === 'user'
                  return (
                    <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                          isUser
                            ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-br-none'
                            : 'bg-surface-800 border border-white/10 text-slate-200 rounded-bl-none shadow-md'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>

                      {/* Assistant Citations */}
                      {!isUser && msg.citations?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 max-w-[85%]">
                          {msg.citations.map((cit, cIdx) => (
                            <div key={cIdx} className="relative">
                              <button
                                onClick={() => setActiveCitation(activeCitation === cit ? null : cit)}
                                className="text-[10px] font-semibold bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors"
                              >
                                📌 {cit.section || `Chunk ${cit.chunk_id?.slice(-3)}`}
                              </button>
                              {activeCitation === cit && (
                                <div className="absolute left-0 bottom-7 z-20 w-64 bg-surface-900 border border-purple-500/50 p-2.5 rounded-xl shadow-2xl text-[11px] text-slate-200 animate-fade-in">
                                  <p className="font-bold text-purple-300 mb-1">Source Snippet ({cit.section}):</p>
                                  <p className="text-slate-300 italic line-clamp-4">"{cit.text_snippet}"</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {sendingChat && (
                  <div className="flex items-center gap-2 text-xs text-purple-400 animate-pulse py-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                    Searching paper chunks & generating answer…
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-surface-900 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question about this paper..."
                  disabled={sendingChat}
                  className="flex-1 bg-surface-800 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || sendingChat}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors shrink-0"
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-white/5 flex gap-2 flex-wrap">
          <button
            onClick={handleCompareClick}
            className={`text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-colors ${
              isSelectedForCompare
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'btn-secondary text-slate-300'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            {isSelectedForCompare ? 'Selected ✓' : 'Add to Compare'}
          </button>

          <button
            onClick={handleReprocess}
            disabled={reprocessing}
            className="btn-secondary text-xs flex-1 justify-center flex items-center gap-1.5"
          >
            {reprocessing ? (
              <><span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> Re-extracting…</>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18" />
                </svg>
                Re-extract
              </>
            )}
          </button>
          
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition-colors bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30"
            title="Delete paper from project"
          >
            <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
          
          <button
            onClick={() => setSelectedPaper(null)}
            className="btn-secondary text-xs px-4"
          >
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}
