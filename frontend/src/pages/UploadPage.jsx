import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import useStore from '../api/store'
import { uploadPapers } from '../api/client'

export default function UploadPage() {
  const { setPapers, setPage } = useStore()
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState(null)

  const onDrop = useCallback(accepted => {
    const pdfs = accepted.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    setFiles(prev => {
      const names = new Set(prev.map(p => p.name))
      return [...prev, ...pdfs.filter(f => !names.has(f.name))]
    })
    setError(null)
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
    try {
      const { data } = await uploadPapers(files, (e) => {
        setUploadProgress(Math.round((e.loaded / e.total) * 100))
      })
      setPapers(data.papers)
      setPage('processing')
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen mesh-bg pt-20 flex flex-col items-center justify-center px-6 py-12">
      {/* Hero */}
      <div className="text-center mb-12 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-900/60 border border-brand-700/40 text-brand-300 text-sm font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          AI-Powered Research Gap Discovery
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
          className={`glass-card p-12 text-center cursor-pointer transition-all duration-200
            ${isDragActive
              ? 'border-brand-500 bg-brand-900/20 shadow-glow-brand'
              : 'border-dashed border-2 border-white/10 hover:border-brand-600/50 hover:bg-brand-900/10'
            }`}
        >
          <input {...getInputProps()} id="file-input" />
          <div className={`text-5xl mb-4 transition-transform duration-200 ${isDragActive ? 'scale-110 animate-float' : ''}`}>
            {isDragActive ? '✨' : '📁'}
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
                  <span className="text-base">📄</span>
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

        {error && (
          <div className="glass-card p-4 border border-red-800/40 bg-red-950/20">
            <p className="text-sm text-red-400">⚠ {error}</p>
          </div>
        )}

        <button
          id="upload-btn"
          onClick={handleUpload}
          disabled={!files.length || uploading}
          className="btn-primary w-full justify-center text-base py-4"
        >
          {uploading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing…
            </>
          ) : (
            <>🚀 Process {files.length > 0 ? `${files.length} Paper${files.length > 1 ? 's' : ''}` : 'Papers'}</>
          )}
        </button>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'PDF Extraction', desc: 'PyMuPDF + pdfplumber', icon: '📑' },
            { label: 'AI Analysis',    desc: 'Gemini 2.0 Flash',        icon: '🤖' },
            { label: 'Knowledge Graph',desc: 'Neo4j + ChromaDB',      icon: '🕸️' },
          ].map(item => (
            <div key={item.label} className="glass-card p-4 text-center">
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="text-xs font-semibold text-white mb-0.5">{item.label}</p>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
