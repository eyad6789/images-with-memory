'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { imageAPI } from '@/lib/api'
import Navbar from '@/components/layout/navbar'
import { Upload, Camera, X, Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import toast from 'react-hot-toast'
import { extractNote, fileToDataURL } from '@/lib/metadata'

export default function UploadPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [isPrivate, setIsPrivate] = useState(true)
  const [tags, setTags] = useState<string>('')
  const [extractedNotes, setExtractedNotes] = useState<{ [key: number]: { note: string; isEncrypted: boolean } }>({})

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.slice(0, 10 - files.length) // Max 10 files
    setFiles(prev => [...prev, ...newFiles])

    // Create previews and check for embedded notes
    const newPreviews: string[] = []
    const newExtractedNotes: { [key: number]: { note: string; isEncrypted: boolean } } = {}

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i]
      const dataUrl = await fileToDataURL(file)
      newPreviews.push(dataUrl)

      // Check for embedded notes
      try {
        const result = extractNote(dataUrl)
        if (result.note) {
          const fileIndex = files.length + i
          newExtractedNotes[fileIndex] = result
        }
      } catch (error) {
        console.warn('Failed to extract note from', file.name, error)
      }
    }

    setPreviews(prev => [...prev, ...newPreviews])
    setExtractedNotes(prev => ({ ...prev, ...newExtractedNotes }))
  }, [files.length])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true
  })

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
    setExtractedNotes(prev => {
      const newNotes = { ...prev }
      delete newNotes[index]
      // Reindex remaining notes
      const reindexed: { [key: number]: { note: string; isEncrypted: boolean } } = {}
      Object.entries(newNotes).forEach(([key, value]) => {
        const oldIndex = parseInt(key)
        if (oldIndex > index) {
          reindexed[oldIndex - 1] = value
        } else if (oldIndex < index) {
          reindexed[oldIndex] = value
        }
      })
      return reindexed
    })
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one image')
      return
    }

    setUploading(true)

    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData()
        formData.append('image', file)
        formData.append('isPrivate', isPrivate.toString())
        
        if (tags.trim()) {
          const tagArray = tags.split(',').map(tag => tag.trim()).filter(Boolean)
          tagArray.forEach(tag => formData.append('tags', tag))
        }

        return imageAPI.upload(formData)
      })

      await Promise.all(uploadPromises)
      
      toast.success(`Successfully uploaded ${files.length} image${files.length > 1 ? 's' : ''}`)
      router.push('/gallery')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Upload Photos</h1>
          <p className="mt-1 text-sm text-gray-500">
            Add photos to your memory collection. Supported formats: JPEG, PNG, WebP (max 10MB each)
          </p>
        </div>

        {/* Upload Area */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? 'active' : ''} ${files.length > 0 ? 'mb-6' : ''}`}
          >
            <input {...getInputProps()} />
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              {isDragActive ? (
                <p className="text-lg text-primary-600">Drop the images here...</p>
              ) : (
                <>
                  <p className="text-lg text-gray-600 mb-2">
                    Drag & drop images here, or click to select
                  </p>
                  <p className="text-sm text-gray-500">
                    JPEG, PNG, WebP up to 10MB each (max 10 files)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* File Previews */}
          {files.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              {files.map((file, index) => (
                <div key={index} className="relative group">
                  <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100">
                    <Image
                      src={previews[index]}
                      alt={file.name}
                      fill
                      className="object-cover"
                    />
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {extractedNotes[index] && (
                      <div className="absolute bottom-2 left-2 bg-primary-500 text-white text-xs px-2 py-1 rounded">
                        {extractedNotes[index].isEncrypted ? '🔒 Note' : '📝 Note'}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 truncate">{file.name}</p>
                  {extractedNotes[index] && (
                    <p className="text-xs text-primary-600 mt-1">
                      {extractedNotes[index].isEncrypted 
                        ? 'Contains encrypted note' 
                        : `Note: ${extractedNotes[index].note.substring(0, 30)}...`
                      }
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Upload Settings */}
          {files.length > 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="vacation, family, memories..."
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>

              <div className="flex items-center">
                <input
                  id="isPrivate"
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="isPrivate" className="ml-2 block text-sm text-gray-700">
                  Keep photos private (only you can see them)
                </label>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <p className="text-sm text-gray-500">
                  {files.length} file{files.length > 1 ? 's' : ''} selected
                </p>
                <div className="space-x-3">
                  <button
                    onClick={() => {
                      setFiles([])
                      setPreviews([])
                      setExtractedNotes({})
                    }}
                    className="btn-secondary"
                    disabled={uploading}
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="btn-primary"
                  >
                    {uploading ? (
                      <>
                        <div className="loading-spinner mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload {files.length} Photo{files.length > 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">💡 Tips</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Images with embedded notes will be automatically detected</li>
            <li>• You can add personal memories to any photo after uploading</li>
            <li>• Private photos are only visible to you</li>
            <li>• Use tags to organize and find your photos easily</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
