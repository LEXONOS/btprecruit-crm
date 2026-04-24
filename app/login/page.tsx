'use client'
import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Eye, EyeOff, Waves, Lock, Mail, ArrowRight, Shield } from 'lucide-react'

const QUICK_ACCESS = [
  { name: 'JP Bahuaud', email: 'jp@caraibe-yachts.com', password: 'admin2024', role: 'Directeur', color: '#c9943a', initials: 'JP' },
  { name: 'Saint-Martin', email: 'stmartin@caraibe-yachts.com', password: 'broker2024', role: 'Courtier', color: '#22d3ee', initials: 'SM' },
  { name: 'Martinique', email: 'martinique@caraibe-yachts.com', password: 'broker2024', role: 'Courtier', color: '#a78bfa', initials: 'ML' },
  { name: 'Guadeloupe', email: 'guadeloupe@caraibe-yachts.com', password: 'broker2024', role: 'Courtier', color: '#34d399', initials: 'LR' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const ok = await login(email, password)
    if (!ok) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
    }
  }

  const quickLogin = async (u: typeof QUICK_ACCESS[0]) => {
    setLoading(true)
    await login(u.email, u.password)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #010d1a 0%, #04111f 40%, #071c30 100%)' }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0891b2, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #c9943a, transparent 70%)' }}
        />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Waves SVG at bottom */}
        <svg
          className="absolute bottom-0 left-0 right-0 w-full"
          viewBox="0 0 1440 120"
          fill="none"
          preserveAspectRatio="none"
          style={{ opacity: 0.06 }}
        >
          <path d="M0,60 C240,100 480,20 720,60 C960,100 1200,20 1440,60 L1440,120 L0,120 Z" fill="#0891b2" />
          <path d="M0,80 C360,40 720,100 1080,60 C1260,40 1380,80 1440,80 L1440,120 L0,120 Z" fill="#22d3ee" />
        </svg>
      </div>

      <div className="relative w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
            style={{
              background: 'linear-gradient(135deg, #c9943a, #e0b060)',
              boxShadow: '0 8px 32px rgba(201,148,58,0.35)',
            }}
          >
            <Waves size={28} className="text-white" strokeWidth={2} />
          </div>
          <h1
            className="font-display text-4xl font-semibold leading-tight"
            style={{ color: '#f0e8d8', letterSpacing: '-0.02em' }}
          >
            Caraibe Yachts
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(148,163,184,0.6)', fontFamily: 'var(--font-karla)' }}>
            CRM Professionnel — Espace sécurisé
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(7,28,48,0.75)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          }}
        >
          <h2
            className="font-display text-xl font-semibold mb-1"
            style={{ color: '#f0cc8a' }}
          >
            Connexion
          </h2>
          <p className="text-sm mb-7" style={{ color: 'rgba(148,163,184,0.55)' }}>
            Accédez à votre tableau de bord
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: 'rgba(148,163,184,0.7)' }}>
                Adresse email
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.4)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="votre@caraibe-yachts.com"
                  className="crm-input pl-9"
                  required
                  style={{ paddingLeft: '36px' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-medium mb-2 block" style={{ color: 'rgba(148,163,184,0.7)' }}>
                Mot de passe
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgba(148,163,184,0.4)' }} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="crm-input pl-9 pr-10"
                  required
                  style={{ paddingLeft: '36px', paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-100"
                  style={{ color: 'rgba(148,163,184,0.4)' }}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="text-sm px-3 py-2.5 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all hover:brightness-110 disabled:opacity-60 mt-2"
              style={{
                background: 'linear-gradient(135deg, #c9943a, #e0b060)',
                color: '#020b18',
                fontFamily: 'var(--font-karla)',
                boxShadow: '0 4px 20px rgba(201,148,58,0.3)',
              }}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  Se connecter
                  <ArrowRight size={15} strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span className="text-xs" style={{ color: 'rgba(148,163,184,0.35)' }}>Accès rapide démo</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Quick access */}
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACCESS.map(u => (
              <button
                key={u.email}
                onClick={() => quickLogin(u)}
                disabled={loading}
                className="flex items-center gap-2.5 p-3 rounded-xl text-left transition-all hover:bg-white/5 disabled:opacity-50"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: `${u.color}18`,
                    color: u.color,
                    border: `1px solid ${u.color}30`,
                  }}
                >
                  {u.initials}
                </div>
                <div>
                  <div className="text-xs font-medium leading-tight" style={{ color: '#e2e8f0' }}>{u.name}</div>
                  <div className="text-xs leading-tight" style={{ color: 'rgba(148,163,184,0.4)' }}>{u.role}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <Shield size={12} style={{ color: 'rgba(148,163,184,0.3)' }} />
          <span className="text-xs" style={{ color: 'rgba(148,163,184,0.3)' }}>
            Connexion sécurisée · Données protégées · Caraibe Yachts © 2026
          </span>
        </div>
      </div>
    </div>
  )
}
