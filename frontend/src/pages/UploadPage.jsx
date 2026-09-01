import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import useStore from '../api/store'
import { uploadPapers } from '../api/client'

export default function UploadPage() {
  const { setPapers, setPage, activeProject } = useStore()
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)
  const [nearDupWarning, setNearDupWarning] = useState(null)

  const onDrop = useCallback(accepted => {
    const pdfs = accepted.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    setFiles(prev => {
      const names = new Set(prev.map(p => p.name))
      return [...prev, ...pdfs.filter(f => !names.has(f.name))]
    })
    setError(null)
    setNearDupWarning(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
  })

  const removeFile = (idx) => setFiles(f => f.filter((_, i) => i !== idx))

  const handleUpload = async () => {
    if (!files.length) return
    setUploading(true)
    setError(null)
    setNearDupWarning(null)
    try {
      const { data } = await uploadPapers(files, (e) => {
        setUploadProgress(Math.round((e.loaded / e.total) * 100))
      })

      // Handle near-duplicate warning (202 response)
      if (data?.near_duplicate_warning) {
        setNearDupWarning(data.near_duplicate_warning)
      }

      if (data?.papers) {
        setPapers(data.papers)
        setPage('processing')
      }
    } catch (e) {
      const detail = e?.response?.data?.detail
      // Handle exact duplicate (409)
      if (e?.response?.status === 409 && detail?.error === 'duplicate') {
        setError(`⛔ Duplicate detected: "${detail.message || 'This PDF was already uploaded.'}"`)
      } else {
        setError(detail?.message || detail || e.message || 'Upload failed')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen mesh-bg pt-20 flex flex-col items-center justify-center px-6 py-12">
      {/* Hero */}
      <div className="text-center mb-8 animate-fade-in flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-900/60 border border-brand-700/40 text-brand-300 text-sm font-medium mb-4">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          AI-Powered Research Gap Discovery
        </div>
        
        {/* Active Project indicator/change shortcut */}
        <div
          onClick={() => setPage('projects')}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface-600/30 border border-white/5 text-xs text-slate-300 hover:border-brand-500/30 hover:bg-white/[0.02] cursor-pointer transition-all duration-200 mb-6 group"
          title="Click to manage or switch projects"
        >
          <svg className="w-4 h-4 text-slate-400 group-hover:text-brand-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Active Project: <span className="font-bold text-brand-300">"{activeProject}"</span>
          <span className="text-[10px] text-slate-500 group-hover:text-slate-400 ml-1 transition-colors">change →</span>
        </div>

        <h1 className="font-display font-bold text-5xl text-white mb-4 leading-tight">
          Upload Your<br />
          <span className="bg-gradient-to-r from-brand-400 via-accent-purple to-accent-cyan bg-clip-text text-transparent">
            Research Papers
          </span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">
          Drop 20–100 academic PDFs. We'll extract methods, build a knowledge graph,
          and surface unexplored research opportunities using AI.
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          id="dropzone-area"
          className={`glass-card p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center
            ${isDragActive
              ? 'border-brand-500 bg-brand-900/20 shadow-glow-brand'
              : 'border-dashed border-2 border-white/10 hover:border-brand-600/50 hover:bg-brand-900/10'
            }`}
        >
          <input {...getInputProps()} id="file-input" />
          <div className={`mb-4 transition-transform duration-200 ${isDragActive ? 'scale-110' : ''}`}>
            {isDragActive ? (
              <svg className="w-12 h-12 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            ) : (
              <svg className="w-12 h-12 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            )}
          </div>
          <p className="text-white font-semibold text-lg mb-1">
            {isDragActive ? 'Drop to upload!' : 'Drag & drop PDF papers here'}
          </p>
          <p className="text-slate-500 text-sm">or click to browse — up to 100 PDFs, 50MB each</p>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white">{files.length} file{files.length > 1 ? 's' : ''} selected</p>
              <button onClick={() => setFiles([])} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
                Clear all
              </button>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-600/50">
                  <svg className="w-4 h-4 text-brand-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="flex-1 text-sm text-slate-200 truncate">{f.name}</span>
                  <span className="text-xs text-slate-500">{(f.size / 1024).toFixed(0)} KB</span>
                  <button
                    onClick={() => removeFile(i)}
                    className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload progress */}
        {uploading && (
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-300">Uploading files…</span>
              <span className="text-sm font-bold text-brand-400">{uploadProgress}%</span>
            </div>
            <div className="h-2 bg-surface-500 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-300 progress-glow"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {nearDupWarning && (
          <div className="glass-card p-4 border border-amber-500/40 bg-amber-950/20">
            <p className="text-sm text-amber-300 flex items-center gap-2 font-medium">
              <span>⚠️</span> {nearDupWarning.message}
            </p>
            {nearDupWarning.similar_to && (
              <p className="text-xs text-amber-400/80 mt-1">
                Existing match: "{nearDupWarning.similar_to}" (similarity score: {Math.round((nearDupWarning.similarity || 0.85) * 100)}%)
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="glass-card p-4 border border-red-800/40 bg-red-950/20">
            <p className="text-sm text-red-400">⚠ {error}</p>
          </div>
        )}

        <button
          id="upload-btn"
          onClick={handleUpload}
          disabled={!files.length || uploading}
          className="btn-primary w-full justify-center text-base py-4 flex items-center gap-2"
        >
          {uploading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Process {files.length > 0 ? `${files.length} Paper${files.length > 1 ? 's' : ''}` : 'Papers'}
            </>
          )}
        </button>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { 
              label: 'PDF Extraction', 
              desc: 'PyMuPDF + pdfplumber', 
              icon: (
                <svg className="w-6 h-6 text-brand-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )
            },
            { 
              label: 'AI Analysis',    
              desc: 'Gemini 2.0 Flash',        
              icon: (
                <svg className="w-6 h-6 text-brand-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              )
            },
            { 
              label: 'Knowledge Graph',
              desc: 'Neo4j + ChromaDB',      
              icon: (
                <svg className="w-6 h-6 text-brand-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              )
            },
          ].map(item => (
            <div key={item.label} className="glass-card p-4 text-center">
              <div className="mb-2">{item.icon}</div>
              <p className="text-xs font-semibold text-white mb-0.5">{item.label}</p>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
