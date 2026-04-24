'use client'
import { Search, Bell, Plus } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  action?: { label: string; onClick: () => void }
}

export default function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      <div>
        <h1 className="font-semibold text-xl" style={{ color: 'var(--text-1)' }}>{title}</h1>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', width: '220px' }}>
          <Search size={14} style={{ color: 'var(--text-3)' }} />
          <input type="text" placeholder="Rechercher..." className="bg-transparent outline-none flex-1 text-sm"
            style={{ fontFamily: 'DM Sans, sans-serif', color: 'var(--text-1)' }} />
        </div>

        {/* Bell */}
        <button className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100"
          style={{ border: '1px solid var(--border)' }}>
          <Bell size={15} style={{ color: 'var(--text-2)' }} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gold)' }} />
        </button>

        {action && (
          <button onClick={action.onClick} className="btn btn-primary">
            <Plus size={14} strokeWidth={2.5} />
            {action.label}
          </button>
        )}
      </div>
    </header>
  )
}
