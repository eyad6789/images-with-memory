'use client'

import { useAuth } from '@/lib/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { imageAPI } from '@/lib/api'
import Navbar from '@/components/layout/navbar'
import { Plus, Search, Filter, Grid, List, Eye, Lock } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface ImageItem {
  id: string
  filename: string
  url: string
  format: string
  width: number
  height: number
  createdAt: string
  isPrivate: boolean
  tags: { name: string }[]
  latestNote?: {
    id: string
    content: string
    isEncrypted: boolean
  }
  _count: {
    notes: number
  }
}

export default function GalleryPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [images, setImages] = useState<ImageItem[]>([])
  const [loadingImages, setLoadingImages] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      loadImages()
    }
  }, [user, page, searchQuery])

  const loadImages = async () => {
    try {
      setLoadingImages(true)
      const response = await imageAPI.getImages({
        page,
        limit: 20,
        search: searchQuery || undefined
      })
      
      if (page === 1) {
        setImages(response.data.images)
      } else {
        setImages(prev => [...prev, ...response.data.images])
      }
      
      setHasMore(response.data.pagination.page < response.data.pagination.pages)
    } catch (error) {
      toast.error('Failed to load images')
    } finally {
      setLoadingImages(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setImages([])
    loadImages()
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
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Gallery</h1>
            <p className="mt-1 text-sm text-gray-500">
              {images.length} photos with memories
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <Link href="/upload" className="btn-primary">
              <Plus className="h-4 w-4 mr-2" />
              Add Photo
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search photos and memories..."
                  className="input pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-2 text-gray-400 hover:text-gray-600 border border-gray-300 rounded-md"
              >
                {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              </button>
              <button type="submit" className="btn-primary">
                Search
              </button>
            </div>
          </form>
        </div>

        {/* Images Grid/List */}
        {loadingImages && images.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="loading-spinner"></div>
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-12">
            <Camera className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No photos yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by uploading your first photo with a memory.
            </p>
            <div className="mt-6">
              <Link href="/upload" className="btn-primary">
                <Plus className="h-4 w-4 mr-2" />
                Upload Photo
              </Link>
            </div>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {images.map((image) => (
                  <Link
                    key={image.id}
                    href={`/image/${image.id}`}
                    className="group bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-square relative">
                      <Image
                        src={`${process.env.NEXT_PUBLIC_API_URL}${image.url}`}
                        alt={image.filename}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute top-2 right-2 flex space-x-1">
                        {image.isPrivate && (
                          <div className="bg-black bg-opacity-50 rounded-full p-1">
                            <Lock className="h-3 w-3 text-white" />
                          </div>
                        )}
                        {image._count.notes > 0 && (
                          <div className="bg-primary-500 bg-opacity-90 rounded-full p-1">
                            <Eye className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {image.filename}
                      </p>
                      {image.latestNote && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {image.latestNote.isEncrypted ? '🔒 Encrypted note' : image.latestNote.content}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          {new Date(image.createdAt).toLocaleDateString()}
                        </span>
                        {image.tags.length > 0 && (
                          <div className="flex space-x-1">
                            {image.tags.slice(0, 2).map((tag, index) => (
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
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                {images.map((image, index) => (
                  <Link
                    key={image.id}
                    href={`/image/${image.id}`}
                    className={`flex items-center p-4 hover:bg-gray-50 ${
                      index !== images.length - 1 ? 'border-b border-gray-200' : ''
                    }`}
                  >
                    <div className="flex-shrink-0 w-16 h-16 relative rounded-lg overflow-hidden">
                      <Image
                        src={`${process.env.NEXT_PUBLIC_API_URL}${image.url}`}
                        alt={image.filename}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="ml-4 flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {image.filename}
                        </p>
                        <div className="flex items-center space-x-2 ml-2">
                          {image.isPrivate && <Lock className="h-4 w-4 text-gray-400" />}
                          {image._count.notes > 0 && <Eye className="h-4 w-4 text-primary-500" />}
                        </div>
                      </div>
                      {image.latestNote && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                          {image.latestNote.isEncrypted ? '🔒 Encrypted note' : image.latestNote.content}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          {new Date(image.createdAt).toLocaleDateString()}
                        </span>
                        {image.tags.length > 0 && (
                          <div className="flex space-x-1">
                            {image.tags.slice(0, 3).map((tag, tagIndex) => (
                              <span
                                key={tagIndex}
                                className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded"
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Load More */}
            {hasMore && (
              <div className="text-center mt-8">
                <button
                  onClick={() => setPage(prev => prev + 1)}
                  disabled={loadingImages}
                  className="btn-secondary"
                >
                  {loadingImages ? (
                    <div className="loading-spinner"></div>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
