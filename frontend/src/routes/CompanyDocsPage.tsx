import React, { useState, useEffect, useRef } from 'react'
import {
  FileText,
  Upload,
  RefreshCw,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Search,
  Save,
  X,
  FileCode,
  ShieldCheck,
} from 'lucide-react'
import { api, type DocumentItem } from '../lib/api'

export const CompanyDocsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClassification, setSelectedClassification] = useState('ALL')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadClassification, setUploadClassification] = useState('standard_operating_procedure')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit modal state
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editFilename, setEditFilename] = useState('')
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editStatusMessage, setEditStatusMessage] = useState<string | null>(null)

  const WORKSPACE_ID = 'company_shared'

  const fetchDocuments = async () => {
    try {
      setIsLoading(true)
      const docs = await api.getDocuments(WORKSPACE_ID)
      setDocuments(docs)
      setActionError(null)
    } catch (err: any) {
      console.error('Failed to fetch company documents:', err)
      setActionError(err.message || 'Failed to load company documents')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  const showSuccess = (msg: string) => {
    setActionSuccess(msg)
    setTimeout(() => setActionSuccess(null), 3500)
  }

  const handleOpenEdit = async (doc: DocumentItem) => {
    setEditingDoc(doc)
    setEditFilename(doc.filename)
    setEditContent('')
    setEditStatusMessage(null)
    setIsLoadingContent(true)

    try {
      const data = await api.getDocumentContent(WORKSPACE_ID, doc.id)
      setEditContent(data.content)
    } catch (err: any) {
      console.error('Failed to load document content:', err)
      setEditContent(`[Error loading content: ${err.message}]`)
    } finally {
      setIsLoadingContent(false)
    }
  }

  const handleSaveAndReindex = async () => {
    if (!editingDoc) return
    setIsSaving(true)
    setEditStatusMessage('Updating disk file and re-indexing in ChromaDB...')

    try {
      const res = await api.updateDocumentContent(
        WORKSPACE_ID,
        editingDoc.id,
        editContent,
        editFilename
      )
      setEditStatusMessage(`Successfully indexed into ${res.total_chunks} chunks!`)
      showSuccess(`"${editFilename}" updated and re-indexed into ChromaDB vector store`)
      await fetchDocuments()
      setTimeout(() => {
        setEditingDoc(null)
        setEditStatusMessage(null)
      }, 1000)
    } catch (err: any) {
      console.error('Failed to update and reindex:', err)
      setEditStatusMessage(`Error: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (doc: DocumentItem) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${doc.filename}"?\nThis will purge all vector chunks from ChromaDB and delete the file from disk.`
    )
    if (!confirmed) return

    try {
      await api.deleteDocument(WORKSPACE_ID, doc.id)
      showSuccess(`Deleted "${doc.filename}" and purged all associated vectors`)
      await fetchDocuments()
    } catch (err: any) {
      console.error('Failed to delete document:', err)
      setActionError(err.message || 'Failed to delete document')
    }
  }

  const handleReindex = async (doc: DocumentItem) => {
    try {
      setActionSuccess(`Re-indexing "${doc.filename}"...`)
      await api.reindexDocument(WORKSPACE_ID, doc.id)
      showSuccess(`Re-indexed "${doc.filename}" successfully`)
      await fetchDocuments()
    } catch (err: any) {
      console.error('Failed to re-index document:', err)
      setActionError(err.message || 'Failed to re-index document')
    }
  }

  const handleFileUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) return

    setIsUploading(true)
    try {
      await api.uploadDocument(WORKSPACE_ID, uploadFile)
      showSuccess(`Uploaded "${uploadFile.name}". Ingestion pipeline running...`)
      setIsUploadOpen(false)
      setUploadFile(null)
      await fetchDocuments()
    } catch (err: any) {
      console.error('Upload failed:', err)
      setActionError(err.message || 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const classifications = [
    'ALL',
    'standard_operating_procedure',
    'safety_policy',
    'engineering_blueprint',
    'compliance_spec',
  ]

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.classification && doc.classification.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesClass =
      selectedClassification === 'ALL' || doc.classification === selectedClassification
    return matchesSearch && matchesClass
  })

  const totalChunks = documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0)

  return (
    <div className="flex-1 w-full h-full overflow-y-auto px-6 md:px-10 lg:px-12 py-8 space-y-6 select-none">
      {/* Header */}
      <div className="border-b border-border/80 pb-5 space-y-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-3xl font-medium tracking-tight text-text-primary">
                Company Knowledge Base
              </h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] bg-accent-primary/10 border border-accent-primary/30 text-accent-primary font-mono text-[10px] uppercase font-bold tracking-wider">
                <ShieldCheck className="h-3 w-3" />
                Air-Gapped Sovereign Vector Store
              </span>
            </div>
            <p className="font-display text-sm italic text-text-muted mt-1">
              Authoritative blueprints, industrial SOPs, and compliance standards indexed into ChromaDB.
              These documents ground AI responses across all team sessions while keeping private user chats strictly isolated.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={fetchDocuments}
              className="flex items-center gap-1.5 rounded-[3px] border border-border bg-surface-1 px-3 py-1.5 text-xs text-text-muted hover:text-text-primary hover:border-accent-primary/40 transition-all cursor-pointer font-mono"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-accent-primary' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-1.5 rounded-[3px] border border-accent-primary/60 bg-accent-primary/15 hover:bg-accent-primary/25 text-accent-primary px-3.5 py-1.5 text-xs font-semibold font-mono tracking-tight transition-all cursor-pointer shadow-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Document</span>
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {actionSuccess && (
          <div className="flex items-center gap-2 p-2.5 rounded-[3px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="flex items-center gap-2 p-2.5 rounded-[3px] bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Knowledge Base Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="rounded-[4px] border border-border/80 bg-surface-1/70 p-2.5">
            <div className="text-[10px] font-mono uppercase text-text-muted">Total Documents</div>
            <div className="text-lg font-bold font-mono text-text-primary">{documents.length}</div>
          </div>
          <div className="rounded-[4px] border border-border/80 bg-surface-1/70 p-2.5">
            <div className="text-[10px] font-mono uppercase text-text-muted">Vector Embeddings</div>
            <div className="text-lg font-bold font-mono text-accent-primary">{totalChunks} Chunks</div>
          </div>
          <div className="rounded-[4px] border border-border/80 bg-surface-1/70 p-2.5">
            <div className="text-[10px] font-mono uppercase text-text-muted">Chroma Collection</div>
            <div className="text-xs font-semibold font-mono text-emerald-400 mt-1">ws_company_shared</div>
          </div>
          <div className="rounded-[4px] border border-border/80 bg-surface-1/70 p-2.5">
            <div className="text-[10px] font-mono uppercase text-text-muted">Embedding Model</div>
            <div className="text-xs font-semibold font-mono text-text-primary mt-1">nomic-embed-text (768d)</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-border/60 pb-3">
        {/* Classification Tabs */}
        <div className="flex items-center gap-2 font-mono text-xs overflow-x-auto">
          {classifications.map((cat) => {
            const isActive = selectedClassification === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedClassification(cat)}
                className={`px-3 py-1 uppercase tracking-wider rounded-[2px] transition-colors cursor-pointer text-[10.5px] shrink-0 ${
                  isActive
                    ? 'border-b-2 border-accent-primary text-text-primary font-bold bg-surface-1'
                    : 'text-text-muted hover:text-text-body hover:bg-surface-1/40'
                }`}
              >
                {cat.replace(/_/g, ' ')}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search blueprints, SOPs, specs..."
            className="w-64 bg-transparent border-b border-border/80 px-2 py-1 font-body text-xs text-text-primary placeholder:italic placeholder:text-text-placeholder focus:border-accent-primary focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Document Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
          <span className="font-mono text-xs text-text-muted tracking-wider uppercase">
            Loading sovereign knowledge base...
          </span>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-[4px] p-8 text-center space-y-3">
          <FileText className="h-10 w-10 text-text-muted/40" />
          <div className="font-mono text-sm text-text-primary">No company documents found</div>
          <p className="font-body text-xs text-text-muted max-w-sm">
            Upload authoritative manuals, safety guidelines, and architectural blueprints to enable
            grounded citations across the workbench.
          </p>
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="mt-2 flex items-center gap-2 rounded-[3px] border border-accent-primary bg-accent-primary/20 text-accent-primary px-3 py-1.5 font-mono text-xs font-semibold cursor-pointer hover:bg-accent-primary/30"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload First Blueprint
          </button>
        </div>
      ) : (
        <div className="border border-border rounded-[4px] bg-surface-1 overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse font-body text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-2/60 font-mono text-[10.5px] uppercase tracking-wider text-text-muted">
                <th className="py-2.5 px-4">Document / File</th>
                <th className="py-2.5 px-4">Classification</th>
                <th className="py-2.5 px-4 text-center">Chunks</th>
                <th className="py-2.5 px-4 text-center">Vector Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredDocs.map((doc) => {
                const isIndexed = doc.status === 'indexed'
                const isFailed = doc.status === 'failed'

                return (
                  <tr key={doc.id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <FileCode className="h-4 w-4 text-accent-primary shrink-0" />
                        <div>
                          <div className="font-mono font-semibold text-text-primary text-xs hover:text-accent-primary cursor-pointer transition-colors"
                            onClick={() => handleOpenEdit(doc)}
                          >
                            {doc.filename}
                          </div>
                          <div className="font-mono text-[10px] text-text-muted">
                            Type: {doc.file_type?.toUpperCase() || 'MD'} · ID: {doc.id.slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[2px] border border-accent-primary/30 bg-accent-primary/10 text-accent-primary">
                        {(doc.classification || 'STANDARD').replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-bold text-text-body">
                      {doc.chunk_count || 0}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-[2px] ${
                          isIndexed
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : isFailed
                              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isIndexed ? 'bg-emerald-400' : isFailed ? 'bg-red-400' : 'bg-amber-400'
                          }`}
                        />
                        {doc.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 font-mono">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(doc)}
                          title="Edit text content & re-index"
                          className="p-1.5 rounded-[3px] border border-border bg-surface-2/60 text-text-muted hover:text-accent-primary hover:border-accent-primary/50 transition-all cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReindex(doc)}
                          title="Force re-indexing into ChromaDB"
                          className="p-1.5 rounded-[3px] border border-border bg-surface-2/60 text-text-muted hover:text-text-primary hover:border-accent-primary/40 transition-all cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(doc)}
                          title="Delete file and purge vectors"
                          className="p-1.5 rounded-[3px] border border-border bg-surface-2/60 text-text-muted hover:text-red-400 hover:border-red-400/50 transition-all cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Document Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 sm:p-6">
          <div className="flex flex-col w-full max-w-4xl h-[85vh] rounded-[4px] border border-border bg-[#14100D] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border bg-surface-2/80 px-5 py-3">
              <div className="flex items-center gap-3">
                <Edit3 className="h-4 w-4 text-accent-primary" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-text-primary">
                      Edit & Re-Index Document
                    </span>
                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 rounded bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
                      ChromaDB Dynamic Sync
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-text-muted">
                    Modifying this text immediately updates the vector store embeddings.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="p-1 text-text-muted hover:text-text-primary rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filename Field */}
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-border/60 bg-surface-1/40">
              <span className="font-mono text-[11px] text-text-muted uppercase tracking-wider">
                Filename:
              </span>
              <input
                type="text"
                value={editFilename}
                onChange={(e) => setEditFilename(e.target.value)}
                className="flex-1 bg-transparent border-b border-border/80 px-2 py-0.5 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
              />
            </div>

            {/* Text Editor Area */}
            <div className="flex-1 p-5 overflow-hidden flex flex-col space-y-2 bg-[#0E0A08]">
              {isLoadingContent ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="font-mono text-xs text-text-muted">Loading file content...</span>
                </div>
              ) : (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Enter or modify document markdown/text content..."
                  className="flex-1 w-full h-full bg-[#110D0A] text-text-primary font-mono text-xs p-4 rounded-[2px] border border-border/80 resize-none focus:outline-none focus:border-accent-primary leading-relaxed"
                />
              )}

              {/* Status Message */}
              {editStatusMessage && (
                <div className="font-mono text-xs text-accent-primary bg-accent-primary/10 border border-accent-primary/30 p-2 rounded-[2px]">
                  {editStatusMessage}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border bg-surface-2/60 px-5 py-3">
              <div className="font-mono text-[11px] text-text-muted">
                {editContent.length} chars · {editContent.split(/\s+/).filter(Boolean).length} words
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  disabled={isSaving}
                  className="px-3 py-1.5 rounded-[3px] border border-border text-text-muted hover:text-text-primary font-mono text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndReindex}
                  disabled={isSaving || isLoadingContent}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-[3px] border border-accent-primary bg-accent-primary text-background font-mono text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSaving ? 'Re-Indexing...' : 'Save & Re-Index'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="flex flex-col w-full max-w-lg rounded-[4px] border border-border bg-[#14100D] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border bg-surface-2/80 px-5 py-3">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold text-text-primary">
                <Upload className="h-4 w-4 text-accent-primary" />
                <span>Upload Company Document / Blueprint</span>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="p-1 text-text-muted hover:text-text-primary rounded cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFileUploadSubmit} className="p-5 space-y-4 font-body text-xs">
              {/* Classification Selector */}
              <div className="space-y-1">
                <label className="font-mono text-[11px] text-text-muted uppercase">
                  Document Classification
                </label>
                <select
                  value={uploadClassification}
                  onChange={(e) => setUploadClassification(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-[3px] px-3 py-2 text-text-primary font-mono text-xs focus:border-accent-primary focus:outline-none cursor-pointer"
                >
                  <option value="standard_operating_procedure">Standard Operating Procedure (SOP)</option>
                  <option value="engineering_blueprint">Engineering Blueprint / Specs</option>
                  <option value="safety_policy">Safety & Air-Gap Compliance Policy</option>
                  <option value="compliance_spec">ASME / ISO Compliance Specification</option>
                </select>
              </div>

              {/* File Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/80 hover:border-accent-primary/60 rounded-[4px] p-6 text-center cursor-pointer transition-colors bg-surface-1/40"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.txt,.pdf,.docx,.json,.py"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <FileText className="h-8 w-8 text-accent-primary/80 mx-auto mb-2" />
                {uploadFile ? (
                  <div className="font-mono text-xs text-text-primary font-semibold">
                    Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                  </div>
                ) : (
                  <div>
                    <span className="font-mono text-xs text-accent-primary font-bold">
                      Click to choose file
                    </span>
                    <p className="font-body text-[11px] text-text-muted mt-1">
                      Supports Markdown, PDF, DOCX, Plain Text, or JSON specifications.
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={isUploading}
                  className="px-3 py-1.5 rounded-[3px] border border-border text-text-muted hover:text-text-primary font-mono text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-[3px] border border-accent-primary bg-accent-primary text-background font-mono text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{isUploading ? 'Ingesting...' : 'Upload & Index'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default CompanyDocsPage
