'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { imageAPI, noteAPI, downloadAPI } from '@/lib/api'
import Navbar from '@/components/layout/navbar'
import { ArrowLeft, Download, Edit, Save, X, Lock, Unlock, Eye, EyeOff, Share2, Trash2 } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface ImageData {
  id: string
  filename: string
  url: string
  format: string
  width: number
  height: number
  createdAt: string
  isPrivate: boolean
  tags: { name: string }[]
  notes: {
    id: string
    content: string
    isEncrypted: boolean
    version: number
    createdAt: string
    updatedAt: string
  }[]
}

export default function ImageDetailPage({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [image, setImage] = useState<ImageData | null>(null)
  const [loadingImage, setLoadingImage] = useState(true)
  const [editingNote, setEditingNote] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [encryptNote, setEncryptNote] = useState(false)
  const [notePassword, setNotePassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [viewPassword, setViewPassword] = useState('')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user && params.id) {
      loadImage()
    }
  }, [user, params.id])

  const loadImage = async () => {
    try {
      setLoadingImage(true)
      const response = await imageAPI.getImage(params.id)
      setImage(response.data)
      
      // Try to load note
      if (response.data.notes.length > 0) {
        const latestNote = response.data.notes[0]
        if (latestNote.isEncrypted) {
          setNeedsPassword(true)
        } else {
          setNoteContent(latestNote.content)
        }
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast.error('Image not found')
        router.push('/gallery')
      } else {
        toast.error('Failed to load image')
      }
    } finally {
      setLoadingImage(false)
    }
  }

  const loadNote = async (password?: string) => {
    try {
      const response = await noteAPI.getNote(params.id, password)
      setNoteContent(response.data.note.content)
      setNeedsPassword(false)
      setViewPassword('')
    } catch (error: any) {
      if (error.response?.data?.isEncrypted) {
        setNeedsPassword(true)
        toast.error('Password required to view encrypted note')
      } else {
        toast.error(error.response?.data?.error || 'Failed to load note')
      }
    }
  }

  const handleSaveNote = async () => {
    if (!noteContent.trim()) {
      toast.error('Note content cannot be empty')
      return
    }

    if (encryptNote && !notePassword) {
      toast.error('Password required for encryption')
      return
    }

    setSavingNote(true)

    try {
      await noteAPI.createNote(params.id, {
        content: noteContent,
        encrypt: encryptNote,
        password: encryptNote ? notePassword : undefined
      })

      toast.success('Note saved successfully')
      setEditingNote(false)
      setNotePassword('')
      setEncryptNote(false)
      loadImage() // Reload to get updated note
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  const handleDownload = () => {
    const hasEncryptedNote = image?.notes.some(note => note.isEncrypted)
    let password = ''
    
    if (hasEncryptedNote) {
      password = prompt('Enter password for encrypted note (leave empty to download without note):') || ''
    }
    
    const downloadUrl = downloadAPI.downloadImage(params.id, password)
    window.open(downloadUrl, '_blank')
  }

  const handleDeleteImage = async () => {
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return
    }

    try {
      await imageAPI.deleteImage(params.id)
      toast.success('Image deleted successfully')
      router.push('/gallery')
    } catch (error) {
      toast.error('Failed to delete image')
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  if (loadingImage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-12">
          <div className="loading-spinner"></div>
        </div>
      </div>
    )
  }

  if (!image) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="text-center py-12">
          <p className="text-gray-500">Image not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Gallery
          </button>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="btn-secondary"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </button>
            <button
              onClick={handleDeleteImage}
              className="btn-danger"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="aspect-square relative">
              <Image
                src={`${process.env.NEXT_PUBLIC_API_URL}${image.url}`}
                alt={image.filename}
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="p-4">
              <h2 className="text-lg font-medium text-gray-900 mb-2">{image.filename}</h2>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>{image.width} × {image.height}</span>
                <span>{new Date(image.createdAt).toLocaleDateString()}</span>
              </div>
              {image.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {image.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Note Section */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Memory Note</h3>
                {!editingNote && (
                  <button
                    onClick={() => {
                      setEditingNote(true)
                      if (image.notes.length === 0) {
                        setNoteContent('')
                      }
                    }}
                    className="btn-secondary"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {image.notes.length > 0 ? 'Edit' : 'Add Note'}
                  </button>
                )}
              </div>

              {needsPassword ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">This note is encrypted. Enter password to view:</p>
                  <div className="flex space-x-2">
                    <input
                      type="password"
                      placeholder="Enter password"
                      className="input flex-1"
                      value={viewPassword}
                      onChange={(e) => setViewPassword(e.target.value)}
                    />
                    <button
                      onClick={() => loadNote(viewPassword)}
                      className="btn-primary"
                    >
                      Unlock
                    </button>
                  </div>
                </div>
              ) : editingNote ? (
                <div className="space-y-4">
                  <textarea
                    className="note-editor"
                    placeholder="Write your memory about this photo..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    rows={8}
                  />
                  
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        id="encryptNote"
                        type="checkbox"
                        checked={encryptNote}
                        onChange={(e) => setEncryptNote(e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="encryptNote" className="ml-2 block text-sm text-gray-700">
                        Encrypt this note with password
                      </label>
                    </div>

                    {encryptNote && (
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter encryption password"
                          className="input pr-10"
                          value={notePassword}
                          onChange={(e) => setNotePassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-gray-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setEditingNote(false)
                        setNotePassword('')
                        setEncryptNote(false)
                        // Reset content if there was an existing note
                        if (image.notes.length > 0) {
                          const latestNote = image.notes[0]
                          if (!latestNote.isEncrypted) {
                            setNoteContent(latestNote.content)
                          }
                        }
                      }}
                      className="btn-secondary"
                      disabled={savingNote}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNote}
                      disabled={savingNote}
                      className="btn-primary"
                    >
                      {savingNote ? (
                        <div className="loading-spinner mr-2"></div>
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Note
                    </button>
                  </div>
                </div>
              ) : image.notes.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">
                        {image.notes[0].isEncrypted ? (
                          <span className="flex items-center">
                            <Lock className="h-3 w-3 mr-1" />
                            Encrypted Note
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <Unlock className="h-3 w-3 mr-1" />
                            Plain Text Note
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-gray-500">
                        Updated {new Date(image.notes[0].updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-900 whitespace-pre-wrap">{noteContent}</p>
                  </div>
                  
                  {image.notes[0].version > 1 && (
                    <p className="text-xs text-gray-500">
                      Version {image.notes[0].version} • View history to see previous versions
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No memory note yet</p>
                  <p className="text-sm text-gray-400">
                    Add a personal memory or story about this photo
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
