import React, { useState, useEffect } from 'react'
import { getOllamaStatus, getOllamaModels, updateOllamaConfig } from '../api/client'

export default function OllamaControlModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(false)
  const [statusData, setStatusData] = useState(null)
  const [models, setModels] = useState([])
  const [activeModel, setActiveModel] = useState('')
  const [useOllama, setUseOllama] = useState(false)
  const [pullModelName, setPullModelName] = useState('')
  const [pulling, setPulling] = useState(false)
  const [pullProgress, setPullProgress] = useState('')
  const [error, setError] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [resStatus, resModels] = await Promise.all([
        getOllamaStatus(),
        getOllamaModels(),
      ])
      setStatusData(resStatus.data)
      setUseOllama(resStatus.data.enabled)
      setActiveModel(resStatus.data.active_model)
      setModels(resModels.data.models || [])
    } catch (err) {
      console.error('Failed fetching Ollama data:', err)
      setError('Could not connect to backend Ollama service endpoint.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchData()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleToggleUseOllama = async (enabled) => {
    setUseOllama(enabled)
    try {
      await updateOllamaConfig({ use_ollama: enabled })
    } catch (err) {
      console.error('Failed updating Ollama config:', err)
    }
  }

  const handleSelectModel = async (modelName) => {
    setActiveModel(modelName)
    try {
      await updateOllamaConfig({ ollama_model: modelName })
      await fetchData()
    } catch (err) {
      console.error('Failed updating Ollama model:', err)
    }
  }

  const handlePullModel = async (e) => {
    e.preventDefault()
    if (!pullModelName.trim()) return

    setPulling(true)
    setPullProgress('Initiating download from Ollama library...')
    setError(null)

    try {
      const response = await fetch('/api/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: pullModelName.trim() }),
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim()
            if (dataStr === '[DONE]') {
              setPullProgress('Model pull complete!')
              break
            }
            try {
              const parsed = JSON.parse(dataStr)
              if (parsed.status) {
                setPullProgress(`Status: ${parsed.status} ${parsed.completed ? `(${Math.round((parsed.completed / parsed.total) * 100)}%)` : ''}`)
              }
            } catch (e) {}
          }
        }
      }
      await fetchData()
      setPullModelName('')
    } catch (err) {
      setError(`Failed pulling model: ${err.message}`)
    } finally {
      setPulling(false)
    }
  }

  const isConnected = statusData?.health?.status === 'ok'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl font-bold">
              🦙
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-white">Ollama Local AI Control Center</h2>
              <p className="text-xs text-slate-400">Manage offline LLM models, connection status & inference mode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Status Card */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">Ollama Server Connection</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              isConnected
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              {isConnected ? `Online (v${statusData?.health?.version || '1.0'})` : 'Offline / Unreachable'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Endpoint Host</span>
              <span className="font-mono text-slate-200">{statusData?.ollama_host || 'http://localhost:11434'}</span>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-2.5 border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Installed Local Models</span>
              <span className="font-semibold text-slate-200">{models.length} Models Found</span>
            </div>
          </div>
        </div>

        {/* Primary Strategy Switcher */}
        <div className="bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-white">Prioritize Local Ollama Inference</h4>
            <p className="text-xs text-slate-400">Route extraction and gap analysis to local GPU/CPU before cloud API</p>
          </div>
          <button
            onClick={() => handleToggleUseOllama(!useOllama)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition shadow-lg ${
              useOllama
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/25'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
            }`}
          >
            {useOllama ? '⚡ Ollama Primary' : '☁️ Gemini Cloud Primary'}
          </button>
        </div>

        {/* Installed Models List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Local Models Library</h3>
            <button
              onClick={fetchData}
              disabled={loading}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
            >
              🔄 Refresh List
            </button>
          </div>

          {models.length === 0 ? (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 text-center text-slate-300 text-xs space-y-3">
              <p>
                No local models were detected at <code className="text-indigo-300 font-mono">http://localhost:11434</code>.
              </p>
              {!isConnected ? (
                <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3 rounded-lg text-left space-y-1">
                  <p className="font-semibold">💡 Ollama Service Offline</p>
                  <p className="text-[11px] text-amber-200/80">
                    1. Download Ollama for Windows from <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="underline font-semibold text-white">ollama.com/download</a>.<br />
                    2. Install and launch Ollama.<br />
                    3. Click <strong>Refresh List</strong> above or pull a model below.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-slate-400 text-[11px]">Click below to pull a recommended model directly into Ollama:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['llama3.2', 'mistral', 'qwen2.5', 'deepseek-r1'].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          setPullModelName(preset)
                        }}
                        className="bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-300 px-3 py-1 rounded-lg text-xs font-mono transition"
                      >
                        + Select {preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {models.map((m) => {
                const isActive = m.name === activeModel
                const sizeMb = m.size ? Math.round(m.size / (1024 * 1024)) : 0
                return (
                  <div
                    key={m.name}
                    onClick={() => handleSelectModel(m.name)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600/20 border-indigo-500/60 text-white shadow-md'
                        : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                      <div>
                        <div className="text-xs font-semibold font-mono">{m.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {sizeMb > 0 ? `${sizeMb} MB` : 'Installed'} {m.details?.parameter_size ? `• ${m.details.parameter_size}` : ''}
                        </div>
                      </div>
                    </div>
                    {isActive && (
                      <span className="text-[10px] bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                        Active Model
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Pull Model Section */}
        <form onSubmit={handlePullModel} className="space-y-2 pt-2 border-t border-slate-800">
          <label className="text-xs font-medium text-slate-300 block">
            Pull New Model from Ollama Library
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={pullModelName}
              onChange={(e) => setPullModelName(e.target.value)}
              placeholder="e.g. llama3.2, mistral, deepseek-r1, qwen2.5"
              className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              disabled={pulling}
            />
            <button
              type="submit"
              disabled={pulling || !pullModelName.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-xl text-xs transition shadow-lg"
            >
              {pulling ? 'Pulling...' : '📥 Pull Model'}
            </button>
          </div>
          {pullProgress && (
            <p className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
              {pullProgress}
            </p>
          )}
        </form>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs p-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  )
}
