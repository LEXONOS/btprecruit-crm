'use client'
import { useState, useEffect } from 'react'
import CRMLayout from '@/components/CRMLayout'
import Header from '@/components/Header'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { Users, Ship, Search, TrendingUp, ArrowUpRight, Clock, MapPin, Crown, ChevronRight, Loader2 } from 'lucide-react'

const statusColor: Record<number, string> = { 1: 'var(--green)', 2: 'var(--amber)', 3: 'var(--text-3)', '-3': 'var(--accent)' }
const statusLabel: Record<number, string> = { 1: 'En vente', 2: 'Sous compromis', 3: 'Vendu', '-3': 'Charter' }

export default function DashboardPage() {
  const { user, isAdmin, allUsers } = useAuth()
  const [stats, setStats] = useState({ clients: 0, occasions: 0, prospects: 0, compromis: 0 })
  const [recentOccasions, setRecentOccasions] = useState<any[]>([])
  const [recentProspects, setRecentProspects] = useState<any[]>([])
  const [brokerStats, setBrokerStats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) loadDashboard() }, [user])

  const loadDashboard = async () => {
    setLoading(true)
    const bId = user?.broker_id

    // Stats parallèles
    const [cl, oc, pr] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).then(r => isAdmin ? r : supabase.from('clients').select('id', { count: 'exact', head: true }).eq('broker_id', bId!)),
      supabase.from('occasions').select('id,statut', { count: 'exact' }).then(r => isAdmin ? r : supabase.from('occasions').select('id,statut').eq('broker_id', bId!)),
      supabase.from('prospects').select('id', { count: 'exact', head: true }).then(r => isAdmin ? r : supabase.from('prospects').select('id', { count: 'exact', head: true }).eq('broker_id', bId!)),
    ])

    const occasions = (oc.data || []) as any[]
    setStats({
      clients: cl.count || 0,
      occasions: occasions.filter((o: any) => o.statut === 1).length,
      prospects: pr.count || 0,
      compromis: occasions.filter((o: any) => o.statut === 2).length,
    })

    // Annonces récentes
    let q1 = supabase.from('occasions').select('*, photos_occasions(url,est_principale)').order('created_at', { ascending: false }).limit(5)
    if (!isAdmin) q1 = q1.eq('broker_id', bId!)
    const { data: occ } = await q1
    setRecentOccasions(occ || [])

    // Prospects récents
    let q2 = supabase.from('prospects').select('*').order('date_saisie', { ascending: false }).limit(4)
    if (!isAdmin) q2 = q2.eq('broker_id', bId!)
    const { data: pros } = await q2
    setRecentProspects(pros || [])

    // Stats par broker (admin only)
    if (isAdmin) {
      const brokers = allUsers.filter(u => u.role === 'broker')
      const bStats = await Promise.all(brokers.map(async b => {
        const [c, o, p] = await Promise.all([
          supabase.from('clients').select('id', { count: 'exact', head: true }).eq('broker_id', b.broker_id),
          supabase.from('occasions').select('id', { count: 'exact', head: true }).eq('broker_id', b.broker_id),
          supabase.from('prospects').select('id', { count: 'exact', head: true }).eq('broker_id', b.broker_id),
        ])
        return { ...b, clients: c.count||0, occasions: o.count||0, prospects: p.count||0 }
      }))
      setBrokerStats(bStats)
    }

    setLoading(false)
  }

  if (!user) return null

  return (
    <CRMLayout>
      <Header
        title={`Bonjour, ${user.name.split(' ')[0]} 👋`}
        subtitle={isAdmin ? 'Vue globale — Tous les bureaux' : `Votre espace · ${user.bureau}`}
        action={{ label: 'Nouvelle annonce', onClick: () => window.location.href = '/occasions' }}
      />

      <div className="px-8 py-7 space-y-6">

        {/* Admin banner */}
        {isAdmin && (
          <div className="rounded-xl px-5 py-4 flex items-center gap-4"
            style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
            <Crown size={20} style={{ color: 'var(--gold)' }}/>
            <div className="flex-1">
              <div className="font-semibold text-sm" style={{ color: '#92400e' }}>Mode Supervision — Directeur</div>
              <div className="text-xs mt-0.5" style={{ color: '#b45309' }}>Vous voyez l'activité de tous les bureaux</div>
            </div>
            <div className="flex gap-2">
              {allUsers.filter(u => u.role === 'broker').map(u => (
                <div key={u.id} className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
                  style={{ background: `${u.color}15`, color: u.color, border: `1px solid ${u.color}25` }}>
                  {u.avatar} · {u.bureau}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        {loading ? (
          <div className="flex items-center justify-center py-10" style={{ color: 'var(--text-3)' }}>
            <Loader2 size={24} className="animate-spin mr-2"/>Chargement...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { label: 'Clients', value: stats.clients, icon: Users, color: '#0284c7', sub: isAdmin ? 'total base' : 'vos clients' },
                { label: 'Annonces actives', value: stats.occasions, icon: Ship, color: 'var(--gold)', sub: 'en vente' },
                { label: 'Prospects', value: stats.prospects, icon: Search, color: '#7c3aed', sub: 'demandes reçues' },
                { label: 'Sous compromis', value: stats.compromis, icon: TrendingUp, color: 'var(--amber)', sub: 'en cours' },
              ].map(s => (
                <div key={s.label} className="card p-5" style={{ position: 'relative', overflow: 'hidden' }}>
                  <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ background: s.color }}/>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${s.color}12`, border: `1px solid ${s.color}20` }}>
                      <s.icon size={18} style={{ color: s.color }} strokeWidth={1.5}/>
                    </div>
                    <span className="badge badge-green text-xs flex items-center gap-0.5">
                      <ArrowUpRight size={10}/>+12%
                    </span>
                  </div>
                  <div className="text-3xl font-bold mb-1" style={{ color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                    {s.value.toLocaleString('fr-FR')}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-2)' }}>{s.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Annonces récentes */}
              <div className="card xl:col-span-2">
                <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--text-1)' }}>
                    <Ship size={15} style={{ color: 'var(--gold)' }}/> Annonces récentes
                  </div>
                  <a href="/occasions" className="text-xs flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                    Voir tout <ChevronRight size={11}/>
                  </a>
                </div>
                <div>
                  {recentOccasions.length === 0 ? (
                    <div className="text-center py-10 text-sm" style={{ color: 'var(--text-3)' }}>Aucune annonce</div>
                  ) : recentOccasions.map((o, i) => {
                    const photo = o.photos_occasions?.find((p: any) => p.est_principale)?.url || o.photos_occasions?.[0]?.url
                    return (
                      <div key={o.id} className="flex items-center gap-4 px-6 py-3.5 table-row"
                        style={{ borderBottom: i < recentOccasions.length-1 ? '1px solid var(--border)' : 'none' }}>
                        <div className="w-12 h-10 rounded-lg overflow-hidden flex-shrink-0"
                          style={{ background: 'var(--bg)' }}>
                          {photo ? <img src={photo} alt="" className="w-full h-full object-cover"/>
                            : <div className="w-full h-full flex items-center justify-center font-bold text-xs"
                                style={{ color: 'var(--text-3)' }}>{o.fabricant?.slice(0,2)}</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>
                            {o.fabricant} {o.modele}
                            {o.nom && <span className="ml-1.5 font-normal italic" style={{ color: 'var(--text-3)' }}>«{o.nom}»</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                            <span>{o.annee}</span>
                            {o.zone && <><span>·</span><span className="flex items-center gap-0.5"><MapPin size={9}/>{o.zone}</span></>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-mono font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
                            {o.prix?.toLocaleString('fr-FR')} €
                          </div>
                          <div className="text-xs mt-0.5 font-medium" style={{ color: statusColor[o.statut] || 'var(--text-3)' }}>
                            {statusLabel[o.statut] || ''}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Prospects récents */}
              <div className="card">
                <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--text-1)' }}>
                    <Clock size={14} style={{ color: '#7c3aed' }}/> Prospects récents
                  </div>
                  <a href="/prospects" className="text-xs" style={{ color: 'var(--accent)' }}>Voir tout</a>
                </div>
                <div className="px-4 py-2">
                  {recentProspects.length === 0 ? (
                    <div className="text-center py-8 text-sm" style={{ color: 'var(--text-3)' }}>Aucun prospect</div>
                  ) : recentProspects.map(p => (
                    <div key={p.id} className="flex items-center gap-3 py-2.5 px-2 table-row rounded-lg">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                        style={{ background: '#7c3aed' }}>
                        {(p.prenom?.[0]||'')+(p.nom?.[0]||'')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>{p.prenom} {p.nom}</div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
                          {p.pays} · {p.occasion_id ? `Réf. #${p.occasion_id}` : 'Général'}
                        </div>
                      </div>
                      {p.traite && <span className="badge badge-green text-xs">✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Admin : stats par bureau */}
            {isAdmin && brokerStats.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-5 font-semibold" style={{ color: 'var(--text-1)' }}>
                  <Crown size={16} style={{ color: 'var(--gold)' }}/> Activité par bureau
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {brokerStats.map(b => (
                    <div key={b.id} className="rounded-xl p-4"
                      style={{ background: `${b.color}08`, border: `1px solid ${b.color}20` }}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
                          style={{ background: b.color }}>{b.avatar}</div>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{b.name}</div>
                          <div className="text-xs" style={{ color: 'var(--text-3)' }}>{b.bureau}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[['Annonces', b.occasions], ['Clients', b.clients], ['Prospects', b.prospects]].map(([l, v]) => (
                          <div key={String(l)} className="text-center rounded-lg py-2"
                            style={{ background: 'rgba(255,255,255,0.7)' }}>
                            <div className="font-mono font-bold text-sm" style={{ color: b.color }}>{v}</div>
                            <div className="text-xs" style={{ color: 'var(--text-3)', fontSize: '10px' }}>{l}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </CRMLayout>
  )
}
