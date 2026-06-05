import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import api, { setAccessToken, getAccessToken } from '@/lib/api'
import type { CurrentUser, LoginResponse } from '@/types/api'

interface AuthContextValue {
  user: CurrentUser | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<LoginResponse>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    try {
      const resp = await api.get<CurrentUser>('/auth/me')
      setUser(resp.data)
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('refresh_token')
    if (!token) { setIsLoading(false); return }

    // Try to restore session via refresh
    api.post<LoginResponse>('/auth/refresh', { refresh_token: token })
      .then((resp) => {
        setAccessToken(resp.data.access_token)
        localStorage.setItem('refresh_token', resp.data.refresh_token)
        return fetchMe()
      })
      .catch(() => {
        localStorage.removeItem('refresh_token')
        setAccessToken(null)
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [fetchMe])

  // Listen for session-expired events from the axios interceptor
  useEffect(() => {
    const handler = () => {
      setUser(null)
      setAccessToken(null)
    }
    window.addEventListener('session-expired', handler)
    return () => window.removeEventListener('session-expired', handler)
  }, [])

  const login = useCallback(async (username: string, password: string): Promise<LoginResponse> => {
    const form = new URLSearchParams()
    form.append('username', username)
    form.append('password', password)
    const resp = await api.post<LoginResponse>('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    setAccessToken(resp.data.access_token)
    localStorage.setItem('refresh_token', resp.data.refresh_token)
    await fetchMe()
    return resp.data
  }, [fetchMe])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch { /* ignore */ }
    setAccessToken(null)
    localStorage.removeItem('refresh_token')
    setUser(null)
  }, [])

  const refreshToken = useCallback(async () => {
    const token = localStorage.getItem('refresh_token')
    if (!token) return
    const resp = await api.post<LoginResponse>('/auth/refresh', { refresh_token: token })
    setAccessToken(resp.data.access_token)
    localStorage.setItem('refresh_token', resp.data.refresh_token)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useAccessToken() { return getAccessToken() }
