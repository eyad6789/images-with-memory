import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('memoryink_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      if (typeof window !== 'undefined') {
        localStorage.removeItem('memoryink_token')
        window.location.href = '/auth/login'
      }
    }
    return Promise.reject(error)
  }
)

// API functions
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),
  
  getMe: () => api.get('/auth/me'),
  
  updateSettings: (settings: { encryptionEnabled?: boolean }) =>
    api.patch('/auth/settings', settings),
}

export const imageAPI = {
  upload: (formData: FormData) =>
    api.post('/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  getImages: (params?: {
    page?: number
    limit?: number
    search?: string
    tags?: string[]
  }) => api.get('/images', { params }),
  
  getImage: (id: string) => api.get(`/images/${id}`),
  
  updateImage: (id: string, data: {
    isPrivate?: boolean
    isPublic?: boolean
    tags?: string[]
  }) => api.patch(`/images/${id}`, data),
  
  deleteImage: (id: string) => api.delete(`/images/${id}`),
}

export const noteAPI = {
  createNote: (imageId: string, data: {
    content: string
    encrypt?: boolean
    password?: string
  }) => api.post(`/notes/${imageId}`, data),
  
  getNote: (imageId: string, password?: string) =>
    api.get(`/notes/${imageId}`, { params: { password } }),
  
  getNoteHistory: (imageId: string) =>
    api.get(`/notes/${imageId}/history`),
  
  deleteNote: (imageId: string) => api.delete(`/notes/${imageId}`),
  
  searchNotes: (query: string, page = 1, limit = 20) =>
    api.get('/notes', { params: { q: query, page, limit } }),
}

export const shareAPI = {
  createShare: (imageId: string, data: {
    password?: string
    expiresIn?: number
  }) => api.post(`/shares/${imageId}/share`, data),
  
  getShares: () => api.get('/shares'),
  
  deleteShare: (shareToken: string) => api.delete(`/shares/${shareToken}`),
  
  accessShare: (shareToken: string, password?: string) =>
    api.get(`/shares/${shareToken}`, { params: { password } }),
}

export const downloadAPI = {
  downloadImage: (imageId: string, password?: string) => {
    const params = password ? `?password=${encodeURIComponent(password)}` : ''
    return `${API_URL}/api/download/image/${imageId}${params}`
  },
  
  exportData: (password?: string) => {
    const params = password ? `?password=${encodeURIComponent(password)}` : ''
    return `${API_URL}/api/download/export${params}`
  },
}
