'use client'

import { useAuth } from '@/lib/auth-context'
import { Camera, Search, Upload, User, LogOut, Settings } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)

  if (!user) return null

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/gallery" className="flex items-center">
              <Camera className="h-8 w-8 text-primary-600 mr-3" />
              <span className="text-xl font-bold text-gray-900">MemoryInk</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/search"
              className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md"
              title="Search"
            >
              <Search className="h-5 w-5" />
            </Link>
            
            <Link
              href="/upload"
              className="btn-primary"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Link>

            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md"
              >
                <User className="h-5 w-5" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                  <div className="px-4 py-2 text-sm text-gray-700 border-b">
                    {user.email}
                  </div>
                  <Link
                    href="/settings"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Link>
                  <button
                    onClick={() => {
                      logout()
                      setShowUserMenu(false)
                    }}
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
