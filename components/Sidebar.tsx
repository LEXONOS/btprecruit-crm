'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { LayoutDashboard, Users, Ship, Search, Anchor, Factory, BookOpen, Waves, LogOut, Crown, FileText } from 'lucide-react'

const nav = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/clients', icon: Users, label: 'Clients', count: 4373 },
  { href: '/occasions', icon: Ship, label: 'Annonces', count: 312 },
  { href: '/prospects', icon: Search, label: 'Prospects', count: 5347 },
]
const refs = [
  { href: '/catalogue', icon: Anchor, label: 'Catalogue bateaux', count: 716 },
  { href: '/fabricants', icon: Factory, label: 'Fabricants', count: 271 },
  { href: '/moteurs', icon: BookOpen, label: 'Moteurs', count: 297 },
  { href: '/documents', icon: FileText, label: 'Documents & Outils' },
]

export default function Sidebar() {
  const path = usePathname()
  const { user, logout, isAdmin } = useAuth()

  return (
    <aside className="fixed left-0 top-0 h-full w-60 flex flex-col z-40"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}>

      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--gold)' }}>
          <Waves size={15} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <div className="font-display text-sm font-semibold leading-tight" style={{ color: 'var(--text-1)' }}>
            Caraibe Yachts
          </div>
          <div className="text-xs" style={{ color: 'var(--text-3)' }}>CRM Pro</div>
        </div>
      </div>

      {/* User */}
      {user && (
        <div className="mx-3 mt-3 p-3 rounded-xl" style={{ background: 'var(--bg)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
              style={{ background: user.color }}>
              {user.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-1)' }}>{user.name}</div>
              <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                {isAdmin && <Crown size={9} style={{ color: 'var(--gold)' }} />}
                {isAdmin ? 'Directeur' : user.bureau}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <div className="nav-section">Gestion</div>
        {nav.map(({ href, icon: Icon, label, count }) => {
          const active = path === href
          return (
            <Link key={href} href={href} className={`sidebar-link ${active ? 'active' : ''}`}>
              <Icon size={16} strokeWidth={active ? 2 : 1.6} />
              <span className="flex-1">{label}</span>
              {count && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded-md"
                  style={{ background: active ? 'rgba(2,132,199,0.12)' : 'var(--border)', color: active ? 'var(--accent)' : 'var(--text-3)', fontSize: '10px' }}>
                  {count.toLocaleString()}
                </span>
              )}
            </Link>
          )
        })}

        <div className="nav-section">Référentiels</div>
        {refs.map(({ href, icon: Icon, label, count }) => {
          const active = path === href
          return (
            <Link key={href} href={href} className={`sidebar-link ${active ? 'active' : ''}`}>
              <Icon size={16} strokeWidth={active ? 2 : 1.6} />
              <span className="flex-1">{label}</span>
              {count && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded-md"
                  style={{ background: active ? 'rgba(2,132,199,0.12)' : 'var(--border)', color: active ? 'var(--accent)' : 'var(--text-3)', fontSize: '10px' }}>
                  {count.toLocaleString()}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={logout}
          className="sidebar-link w-full text-left hover:bg-red-50 hover:text-red-600 transition-colors">
          <LogOut size={15} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  )
}
