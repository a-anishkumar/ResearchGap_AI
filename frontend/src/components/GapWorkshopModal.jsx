import React, { useState } from 'react'
import { generateProposal } from '../api/client'

export default function GapWorkshopModal({ isOpen, onClose }) {
  const [method, setMethod] = useState('')
  const [domain, setDomain] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [proposalResult, setProposalResult] = useState(null)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!method.trim() || !domain.trim()) return

    setLoading(true)
    setError(null)
    setProposalResult(null)
    setStreamingText('')

    try {
      const res = await generateProposal(method.trim(), domain.trim(), suggestion.trim())
      setProposalResult(res.data)

      // Connect to SSE stream endpoint for real-time elaboration
      if (res.data?.id) {
        const eventSource = new EventSource(`/api/gaps/proposals/${res.data.id}/stream`)
        eventSource.onmessage = (event) => {
          if (event.data === '[DONE]') {
            eventSource.close()
            setLoading(false)
            return
          }
          try {
            const data = JSON.parse(event.data)
            if (data.token) {
              setStreamingText((prev) => prev + data.token)
            }
          } catch (e) {}
        }
        eventSource.onerror = (err) => {
          console.error('SSE error:', err)
          eventSource.close()
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    } catch (err) {
      console.error('Failed workshop proposal generation:', err)
      setError(err.response?.data?.detail || 'Failed generating research gap proposal.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl font-bold">
              🔬
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">Interactive Research Gap Workshop</h2>
              <p className="text-xs text-slate-400">Brainstorm, test, and elaborate custom Method × Domain combinations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Method / Algorithm Primitives
            </label>
            <input
              type="text"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="e.g. Graph Convolutional Networks, Diffusion Models"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Target Application Domain
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g. Clinical Trial Outcome Prediction, Quantum Chemistry"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Optional Rationale / Initial Hypothesis
            </label>
            <textarea
              rows={2}
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Why might this combination be promising? (Optional)"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={loading || !method.trim() || !domain.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl text-xs transition shadow-lg flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Generating Workshop Proposal...
                </>
              ) : (
                '🚀 Generate Gap Proposal Blueprint'
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Generated Proposal Blueprint Card */}
        {proposalResult && (
          <div className="space-y-4 bg-slate-800/50 border border-slate-700/60 rounded-xl p-5">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                  Workshop Generated Proposal Blueprint
                </span>
                <h3 className="text-base font-bold text-white">{proposalResult.title}</h3>
              </div>
              <a
                href={`/api/gaps/proposals/${proposalResult.id}/export`}
                target="_blank"
                rel="noreferrer"
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition"
              >
                📄 PDF Export
              </a>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <h4 className="font-semibold text-slate-300 mb-1">Problem Statement</h4>
                <p className="text-slate-400 leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                  {proposalResult.problem_statement}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-300 mb-1">Core Hypothesis</h4>
                <p className="text-slate-400 leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                  {proposalResult.hypothesis}
                </p>
              </div>

              {proposalResult.methodology_blueprint?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-300 mb-1">Methodology Blueprint</h4>
                  <ul className="list-disc list-inside text-slate-400 space-y-1 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                    {proposalResult.methodology_blueprint.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Streaming Real-Time Elaboration */}
              {streamingText && (
                <div>
                  <h4 className="font-semibold text-indigo-400 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                    Real-Time Token Streaming Elaboration
                  </h4>
                  <div className="bg-slate-950 p-3 rounded-lg border border-indigo-500/30 text-indigo-200 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                    {streamingText}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
