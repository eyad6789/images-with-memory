'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'

interface User {
  id: string
  email: string
  createdAt: string
  encryptionEnabled: boolean
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('memoryink_token')
    if (storedToken) {
      setToken(storedToken)
      api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
      
      // Verify token and get user info
      api.get('/auth/me')
        .then(response => {
          setUser(response.data.user)
        })
        .catch(() => {
          // Token is invalid, remove it
          localStorage.removeItem('memoryink_token')
          setToken(null)
          delete api.defaults.headers.common['Authorization']
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password })
      const { user, token } = response.data
      
      setUser(user)
      setToken(token)
      localStorage.setItem('memoryink_token', token)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed')
    }
  }

  const register = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/register', { email, password })
      const { user, token } = response.data
      
      setUser(user)
      setToken(token)
      localStorage.setItem('memoryink_token', token)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Registration failed')
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('memoryink_token')
    delete api.defaults.headers.common['Authorization']
  }

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      register,
      logout,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
