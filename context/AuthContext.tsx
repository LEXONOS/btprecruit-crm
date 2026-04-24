'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export type UserRole = 'admin' | 'broker'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  bureau: string
  broker_id: number
  avatar: string
  color: string
}

const USERS: (User & { password: string })[] = [
  {
    id: 1,
    name: 'Jean Paul Bahuaud',
    email: 'jp@caraibe-yachts.com',
    password: 'admin2024',
    role: 'admin',
    bureau: 'Guadeloupe',
    broker_id: 3,
    avatar: 'JP',
    color: '#c9943a',
  },
  {
    id: 2,
    name: 'Stéphanie Moreau',
    email: 'stmartin@caraibe-yachts.com',
    password: 'broker2024',
    role: 'broker',
    bureau: 'Saint-Martin',
    broker_id: 8,
    avatar: 'SM',
    color: '#22d3ee',
  },
  {
    id: 3,
    name: 'Marie Lefebvre',
    email: 'martinique@caraibe-yachts.com',
    password: 'broker2024',
    role: 'broker',
    bureau: 'Martinique',
    broker_id: 6,
    avatar: 'ML',
    color: '#a78bfa',
  },
  {
    id: 4,
    name: 'Louis Renault',
    email: 'guadeloupe@caraibe-yachts.com',
    password: 'broker2024',
    role: 'broker',
    bureau: 'Guadeloupe',
    broker_id: 15,
    avatar: 'LR',
    color: '#34d399',
  },
]

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  isAdmin: boolean
  allUsers: Omit<User, 'password'>[]
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loaded, setLoaded] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const stored = localStorage.getItem('crm_user')
    if (stored) {
      setUser(JSON.parse(stored))
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    if (!user && pathname !== '/login') {
      router.push('/login')
    }
    if (user && pathname === '/login') {
      router.push('/')
    }
  }, [user, loaded, pathname, router])

  const login = async (email: string, password: string): Promise<boolean> => {
    const found = USERS.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    )
    if (found) {
      const { password: _p, ...userClean } = found
      setUser(userClean)
      localStorage.setItem('crm_user', JSON.stringify(userClean))
      return true
    }
    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('crm_user')
    router.push('/login')
  }

  if (!loaded) return null

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAdmin: user?.role === 'admin',
        allUsers: USERS.map(({ password: _p, ...u }) => u),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
