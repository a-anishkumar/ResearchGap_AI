import { useState, useEffect } from 'react'
import { polishProposal, generateProposal } from '../api/client'
import { useToast } from './Toast'

function SparklesIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}

function WarningIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  )
}

function CheckIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

export default function ProposalModal({ gap, onClose }) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [polishing, setPolishing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [proposal, setProposal] = useState(null)
  const [polishData, setPolishData] = useState(null)

  // Local state for active section views (original vs polished)
  const [probMode, setProbMode] = useState('polished') // 'original' | 'polished'
  const [expMode, setExpMode] = useState('polished')   // 'original' | 'polished'
  const [activeTitle, setActiveTitle] = useState('')
  const [currentProbText, setCurrentProbText] = useState('')
  const [currentExpText, setCurrentExpText] = useState('')
  const [appliedFlags, setAppliedFlags] = useState({})

  // Fetch or generate proposal on mount
  useEffect(() => {
    let isMounted = true
    async function loadProposal() {
      setLoading(true)
      try {
        const { data } = await generateProposal(gap.method, gap.domain, gap.suggestion || '')
        if (isMounted) {
          setProposal(data)
          setActiveTitle(data.title)
          setCurrentProbText(data.problem_statement)
          setCurrentExpText(data.expected_contributions)
          if (data.polish_result) {
            setPolishData(data.polish_result)
            if (data.polish_result.polished_sections?.problem_statement?.polished) {
              setCurrentProbText(data.polish_result.polished_sections.problem_statement.polished)
            }
            if (data.polish_result.polished_sections?.expected_contributions?.polished) {
              setCurrentExpText(data.polish_result.polished_sections.expected_contributions.polished)
            }
          }
        }
      } catch (err) {
        if (isMounted) toast?.error(`Failed loading proposal: ${err.message}`)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadProposal()
    return () => { isMounted = false }
  }, [gap])

  // Trigger 3-pass LLM polish
  const handlePolish = async () => {
    if (!proposal?.id) return
    setPolishing(true)
    try {
      const { data } = await polishProposal(proposal.id)
      setPolishData(data)
      if (data.polished_sections?.problem_statement?.polished) {
        setCurrentProbText(data.polished_sections.problem_statement.polished)
        setProbMode('polished')
      }
      if (data.polished_sections?.expected_contributions?.polished) {
        setCurrentExpText(data.polished_sections.expected_contributions.polished)
        setExpMode('polished')
      }
      toast?.success('Proposal polished across 3 academic passes!')
    } catch (err) {
      toast?.error(`Polish failed: ${err.message}`)
    } finally {
      setPolishing(false)
    }
  }

  // Handle section diff accept/revert
  const handleAcceptProb = (mode) => {
    setProbMode(mode)
    if (mode === 'polished' && polishData?.polished_sections?.problem_statement?.polished) {
      setCurrentProbText(polishData.polished_sections.problem_statement.polished)
    } else if (mode === 'original') {
      setCurrentProbText(proposal.problem_statement)
    }
    toast?.info(`Problem Statement set to ${mode}`)
  }

  const handleAcceptExp = (mode) => {
    setExpMode(mode)
    if (mode === 'polished' && polishData?.polished_sections?.expected_contributions?.polished) {
      setCurrentExpText(polishData.polished_sections.expected_contributions.polished)
    } else if (mode === 'original') {
      setCurrentExpText(proposal.expected_contributions)
    }
    toast?.info(`Expected Contributions set to ${mode}`)
  }

  // Apply citation flag inline action
  const handleApplyCitationAction = (flagIndex, actionType, flag) => {
    if (actionType === 'citation') {
      const citationText = ` ${flag.suggested_citation_or_softening.replace('Cite corpus paper:', '').replace('Cite corpus paper ID:', '').trim()}`
      setCurrentProbText(prev => prev.includes(flag.sentence) ? prev.replace(flag.sentence, `${flag.sentence} ${citationText}`) : `${prev} ${citationText}`)
      setAppliedFlags(prev => ({ ...prev, [flagIndex]: 'citation' }))
      toast?.success('Inserted citation reference into proposal text!')
    } else if (actionType === 'soften') {
      const softenedText = `Preliminary literature indicates that ${flag.sentence.toLowerCase()}`
      setCurrentProbText(prev => prev.includes(flag.sentence) ? prev.replace(flag.sentence, softenedText) : `${prev} ${softenedText}`)
      setAppliedFlags(prev => ({ ...prev, [flagIndex]: 'soften' }))
      toast?.success('Softened claim wording!')
    }
  }

  // Export proposal as PDF
  const handleExportPdf = async () => {
    if (!proposal?.id) {
      toast?.error('Proposal not loaded yet. Please wait.')
      return
    }
    setExporting(true)
    try {
      const response = await fetch(`/api/gaps/proposals/${proposal.id}/export`, {
        method: 'GET',
        headers: { 'X-Project-Name': localStorage.getItem('currentProject') || 'default' },
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Export failed')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeName = (proposal.title || `${gap.method}_${gap.domain}`).replace(/[^a-z0-9]/gi, '_').slice(0, 60)
      a.href = url
      a.download = `proposal_${safeName}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast?.success('PDF downloaded!')
    } catch (e) {
      toast?.error(`PDF export failed: ${e.message}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-brand-500/30">

        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-surface-700/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge-method text-xs px-2.5 py-0.5">{gap.method}</span>
              <span className="text-slate-600 font-bold">×</span>
              <span className="badge-domain text-xs px-2.5 py-0.5">{gap.domain}</span>
              <span className="text-xs text-brand-400 font-semibold bg-brand-950/50 border border-brand-800/40 px-2 py-0.5 rounded-full ml-2">
                Proposal Blueprint
              </span>
            </div>
            <h2 className="text-xl font-bold text-white font-display">
              Research Proposal & Academic Polish
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePolish}
              disabled={polishing || loading}
              className="btn-primary py-2 px-4 flex items-center gap-2 shadow-glow-brand"
            >
              <SparklesIcon className="w-4 h-4 text-amber-300 animate-spin-slow" />
              {polishing ? 'Running 3 Polish Passes…' : polishData ? 'Re-Polish Proposal' : '✨ Polish Proposal'}
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exporting || loading || !proposal}
              title="Export proposal as PDF"
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-brand-500/40 text-brand-400 hover:bg-brand-900/30 hover:text-brand-300 transition-all duration-150 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              {exporting ? 'Exporting…' : 'Export PDF'}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">

          {loading ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-400">Building RAG-Grounded Research Proposal Blueprint…</p>
            </div>
          ) : (
            <>
              {/* Title Section */}
              <div className="space-y-3 bg-surface-600/40 p-4 rounded-xl border border-white/5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Proposal Title
                </label>
                <input
                  type="text"
                  value={activeTitle}
                  onChange={(e) => setActiveTitle(e.target.value)}
                  className="input-base w-full font-bold text-lg text-white"
                />

                {/* Title Variants Chips */}
                {polishData?.title_variants?.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <p className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
                      <SparklesIcon className="w-3.5 h-3.5" />
                      AI Title Variants (Select to apply):
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {polishData.title_variants.map((v, i) => {
                        const isSelected = activeTitle === v.title
                        return (
                          <div
                            key={i}
                            onClick={() => {
                              setActiveTitle(v.title)
                              toast?.info(`Applied title variant #${i+1}`)
                            }}
                            className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-brand-900/60 border-brand-500 text-white shadow-glow-brand'
                                : 'bg-surface-700/60 border-white/5 text-slate-300 hover:border-brand-700/40 hover:bg-surface-600'
                            }`}
                          >
                            <p className="text-xs font-bold leading-snug mb-1">{v.title}</p>
                            <p className="text-[10px] text-slate-400 line-clamp-2">{v.rationale}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Problem Statement Section with Diff */}
              <div className="space-y-2 bg-surface-600/30 p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    Problem Statement
                  </h3>
                  {polishData?.polished_sections?.problem_statement && (
                    <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-white/10 text-xs">
                      <button
                        onClick={() => handleAcceptProb('original')}
                        className={`px-2 py-0.5 rounded ${probMode === 'original' ? 'bg-surface-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                      >
                        Original
                      </button>
                      <button
                        onClick={() => handleAcceptProb('polished')}
                        className={`px-2 py-0.5 rounded ${probMode === 'polished' ? 'bg-brand-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                      >
                        Polished ✨
                      </button>
                    </div>
                  )}
                </div>

                {probMode === 'polished' && polishData?.polished_sections?.problem_statement ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-200 leading-relaxed bg-brand-950/20 p-3 rounded-lg border border-brand-800/30">
                      {currentProbText}
                    </p>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
                      <span>Diff view: Academic register pass applied.</span>
                      <button
                        onClick={() => handleAcceptProb('original')}
                        className="text-amber-400 hover:underline"
                      >
                        Revert to Original
                      </button>
                    </div>
                  </div>
                ) : (
                  <textarea
                    rows={3}
                    value={currentProbText}
                    onChange={(e) => setCurrentProbText(e.target.value)}
                    className="input-base w-full text-sm leading-relaxed"
                  />
                )}
              </div>

              {/* Hypothesis */}
              <div className="space-y-2 bg-surface-600/30 p-4 rounded-xl border border-white/5">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Core Hypothesis
                </h3>
                <p className="text-sm text-slate-200 leading-relaxed bg-surface-700/40 p-3 rounded-lg border border-white/5">
                  {proposal?.hypothesis}
                </p>
              </div>

              {/* Methodology Blueprint */}
              <div className="space-y-2 bg-surface-600/30 p-4 rounded-xl border border-white/5">
                <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                  Methodology Blueprint
                </h3>
                <ul className="space-y-2">
                  {proposal?.methodology_blueprint?.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="w-5 h-5 rounded-full bg-purple-950/60 border border-purple-800/40 flex items-center justify-center text-xs text-purple-300 font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Expected Contributions Section with Diff */}
              <div className="space-y-2 bg-surface-600/30 p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-green-400 uppercase tracking-wider">
                    Expected Contributions & Impact
                  </h3>
                  {polishData?.polished_sections?.expected_contributions && (
                    <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-white/10 text-xs">
                      <button
                        onClick={() => handleAcceptExp('original')}
                        className={`px-2 py-0.5 rounded ${expMode === 'original' ? 'bg-surface-500 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                      >
                        Original
                      </button>
                      <button
                        onClick={() => handleAcceptExp('polished')}
                        className={`px-2 py-0.5 rounded ${expMode === 'polished' ? 'bg-brand-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                      >
                        Polished ✨
                      </button>
                    </div>
                  )}
                </div>

                {expMode === 'polished' && polishData?.polished_sections?.expected_contributions ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line bg-green-950/20 p-3 rounded-lg border border-green-800/30">
                      {currentExpText}
                    </p>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
                      <span>Diff view: Formalized contributions list.</span>
                      <button
                        onClick={() => handleAcceptExp('original')}
                        className="text-amber-400 hover:underline"
                      >
                        Revert to Original
                      </button>
                    </div>
                  </div>
                ) : (
                  <textarea
                    rows={3}
                    value={currentExpText}
                    onChange={(e) => setCurrentExpText(e.target.value)}
                    className="input-base w-full text-sm leading-relaxed"
                  />
                )}
              </div>

              {/* Citation-Need Flagging List */}
              {polishData?.citation_flags?.length > 0 && (
                <div className="space-y-3 bg-amber-950/20 p-4 rounded-xl border border-amber-800/30">
                  <div className="flex items-center gap-2">
                    <WarningIcon className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Citation-Need & Claim Softening Warnings ({polishData.citation_flags.length})
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {polishData.citation_flags.map((flag, idx) => {
                      const isApplied = appliedFlags[idx]
                      return (
                        <div key={idx} className="p-3 rounded-lg bg-slate-900/80 border border-amber-700/30 text-xs space-y-2">
                          <p className="text-slate-200 font-mono text-[11px] bg-slate-950/60 p-2 rounded">
                            "{flag.sentence}"
                          </p>
                          <p className="text-amber-300/90 leading-normal">
                            <strong className="text-amber-400">Reason:</strong> {flag.reason}
                          </p>
                          <p className="text-slate-300">
                            <strong className="text-cyan-300">RAG Suggestion:</strong> {flag.suggested_citation_or_softening}
                          </p>

                          <div className="flex items-center gap-2 pt-1">
                            {isApplied ? (
                              <span className="text-green-400 text-[11px] font-semibold flex items-center gap-1">
                                <CheckIcon className="w-3.5 h-3.5" /> Action Applied ({isApplied})
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleApplyCitationAction(idx, 'citation', flag)}
                                  className="px-2.5 py-1 rounded bg-cyan-950/80 border border-cyan-800/40 text-cyan-300 hover:bg-cyan-900 transition-colors"
                                >
                                  + Insert Suggested Citation
                                </button>
                                <button
                                  onClick={() => handleApplyCitationAction(idx, 'soften', flag)}
                                  className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-800/40 text-amber-300 hover:bg-amber-900 transition-colors"
                                >
                                  ~ Soften Claim Wording
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Literature Justification & Citation Seeds */}
              <div className="space-y-2 bg-surface-600/30 p-4 rounded-xl border border-white/5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Literature Justification & Citation Seeds
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-2">
                  {proposal?.literature_justification}
                </p>
                {proposal?.citation_seeds?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {proposal.citation_seeds.map((seed, idx) => (
                      <span key={idx} className="text-[11px] px-2.5 py-1 rounded-md bg-surface-700 text-slate-300 border border-white/5 truncate max-w-xs" title={seed}>
                        📄 {seed}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-surface-700/50 flex items-center justify-between text-xs text-slate-400">
          <span>Corpus-Grounded Academic Proposal Engine</span>
          <button
            onClick={onClose}
            className="btn-secondary py-1.5 px-4"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  )
}
