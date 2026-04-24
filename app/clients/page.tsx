'use client'
import { useState, useEffect } from 'react'
import CRMLayout from '@/components/CRMLayout'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import { useAuth } from '@/context/AuthContext'
import { supabase, type Client } from '@/lib/supabase'
import { typesBateau, typesCoque, zonesNavigation } from '@/data/referentials'
import { Users, Mail, Phone, MapPin, Building2, Euro, Pencil, Trash2, Eye, Loader2 } from 'lucide-react'

const statusMap: Record<number, { label: string; cls: string }> = {
  1: { label: 'Nouveau', cls: 'badge-blue' },
  2: { label: 'En cours', cls: 'badge-amber' },
  3: { label: 'Chaud',    cls: 'badge-green' },
  4: { label: 'Froid',    cls: 'badge-gray' },
  5: { label: 'Vendu',    cls: 'badge-purple' },
}

const emptyForm = {
  nom: '', prenom: '', societe: '', email: '', tel: '', mobile: '',
  adresse: '', cp: '', ville: '', pays: 'France', is_pro: false,
  budget: 0, type_bateau: '', coque: '', longueur: '',
  zone_navigation: '', quille: '', statut: 1,
}

export default function ClientsPage() {
  const { user, isAdmin } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCoque, setFilterCoque] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [selected, setSelected] = useState<Client | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadClients() }, [user])

  const loadClients = async () => {
    setLoading(true)
    let q = supabase.from('clients').select('*').order('date_saisie', { ascending: false })
    if (!isAdmin && user) q = q.eq('broker_id', user.broker_id)
    const { data } = await q
    if (data) setClients(data as Client[])
    setLoading(false)
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${c.nom} ${c.prenom} ${c.email} ${c.ville} ${c.pays} ${c.societe}`.toLowerCase().includes(q)
    const matchCoque = !filterCoque || c.coque === filterCoque
    const matchStatut = !filterStatut || String(c.statut) === filterStatut
    return matchSearch && matchCoque && matchStatut
  })

  const openEdit = (c: Client) => {
    setSelected(c)
    setForm({ nom: c.nom, prenom: c.prenom||'', societe: c.societe||'', email: c.email||'',
      tel: c.tel||'', mobile: c.mobile||'', adresse: c.adresse||'', cp: c.cp||'',
      ville: c.ville||'', pays: c.pays||'France', is_pro: c.is_pro||false,
      budget: c.budget||0, type_bateau: c.type_bateau||'', coque: c.coque||'',
      longueur: c.longueur||'', zone_navigation: c.zone_navigation||'',
      quille: c.quille||'', statut: c.statut||1 })
    setShowEdit(true)
  }

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('clients').insert({ ...form, broker_id: user?.broker_id ?? 1 })
    if (!error) { await loadClients(); setShowAdd(false); setForm({ ...emptyForm }) }
    setSaving(false)
  }

  const handleUpdate = async () => {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('clients').update(form).eq('id', selected.id)
    if (!error) { await loadClients(); setShowEdit(false) }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!selected) return
    await supabase.from('clients').delete().eq('id', selected.id)
    await loadClients()
    setShowDelete(false)
  }

  const F = ({ label, field, type = 'text', placeholder = '' }: { label: string; field: keyof typeof emptyForm; type?: string; placeholder?: string }) => (
    <div>
      <label className="field-label">{label}</label>
      <input type={type} className="field" placeholder={placeholder}
        value={String(form[field])}
        onChange={e => setForm(p => ({ ...p, [field]: type === 'number' ? +e.target.value : e.target.value }))} />
    </div>
  )

  const ClientForm = () => (
    <div className="grid grid-cols-2 gap-4">
      <F label="Prénom *" field="prenom" placeholder="Jean" />
      <F label="Nom *" field="nom" placeholder="DUPONT" />
      <div className="col-span-2"><label className="field-label">Société</label>
        <input className="field" value={form.societe} onChange={e => setForm(p=>({...p,societe:e.target.value}))} />
      </div>
      <F label="Email" field="email" type="email" placeholder="email@exemple.com" />
      <F label="Mobile" field="mobile" placeholder="+33 6 ..." />
      <F label="Téléphone" field="tel" />
      <F label="Ville" field="ville" />
      <F label="Code postal" field="cp" />
      <div><label className="field-label">Pays</label>
        <input className="field" value={form.pays} onChange={e=>setForm(p=>({...p,pays:e.target.value}))} />
      </div>

      {/* Séparateur */}
      <div className="col-span-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-2)' }}>Projet d'achat</div>
      </div>

      <div><label className="field-label">Type de bateau</label>
        <select className="field" value={form.type_bateau} onChange={e=>setForm(p=>({...p,type_bateau:e.target.value}))}>
          <option value="">—</option>{typesBateau.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
      <div><label className="field-label">Type de coque</label>
        <select className="field" value={form.coque} onChange={e=>setForm(p=>({...p,coque:e.target.value}))}>
          <option value="">—</option>{typesCoque.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>
      <div><label className="field-label">Zone de navigation</label>
        <select className="field" value={form.zone_navigation} onChange={e=>setForm(p=>({...p,zone_navigation:e.target.value}))}>
          <option value="">—</option>{zonesNavigation.map(z=><option key={z}>{z}</option>)}
        </select>
      </div>
      <F label="Budget max (€)" field="budget" type="number" placeholder="150000" />

      <div><label className="field-label">Statut</label>
        <select className="field" value={form.statut} onChange={e=>setForm(p=>({...p,statut:+e.target.value}))}>
          {Object.entries(statusMap).map(([v,s])=><option key={v} value={v}>{s.label}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 pt-6">
        <input type="checkbox" id="is_pro" checked={form.is_pro} onChange={e=>setForm(p=>({...p,is_pro:e.target.checked}))}
          className="w-4 h-4" style={{ accentColor: 'var(--accent)' }} />
        <label htmlFor="is_pro" className="text-sm cursor-pointer" style={{ color: 'var(--text-2)' }}>Client professionnel</label>
      </div>
    </div>
  )

  return (
    <CRMLayout>
      <Header title="Clients"
        subtitle={loading ? 'Chargement...' : `${filtered.length.toLocaleString()} client${filtered.length>1?'s':''}`}
        action={{ label: 'Nouveau client', onClick: () => { setForm({ ...emptyForm }); setShowAdd(true) } }} />

      <div className="px-8 py-6">
        {/* Filters */}
        <div className="flex gap-3 mb-5 flex-wrap">
          <div className="flex-1 min-w-52 relative">
            <input className="field pl-9" placeholder="Rechercher par nom, email, ville..."
              value={search} onChange={e=>setSearch(e.target.value)} />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <select className="field" style={{ width: '160px' }} value={filterCoque} onChange={e=>setFilterCoque(e.target.value)}>
            <option value="">Toutes les coques</option>{typesCoque.map(t=><option key={t}>{t}</option>)}
          </select>
          <select className="field" style={{ width: '140px' }} value={filterStatut} onChange={e=>setFilterStatut(e.target.value)}>
            <option value="">Tous statuts</option>
            {Object.entries(statusMap).map(([v,s])=><option key={v} value={v}>{s.label}</option>)}
          </select>
          {(search||filterCoque||filterStatut) && (
            <button className="btn btn-outline btn-sm" onClick={()=>{setSearch('');setFilterCoque('');setFilterStatut('')}}>Effacer</button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-3)' }}>
            <Loader2 size={28} className="animate-spin mr-3" />Chargement depuis Supabase...
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {['Client','Contact','Localisation','Projet d\'achat','Budget','Statut','Actions'].map(h=>(
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c,i) => {
                  const s = statusMap[c.statut] || statusMap[1]
                  return (
                    <tr key={c.id} className="table-row" style={{ borderBottom: i<filtered.length-1?'1px solid var(--border)':'none' }}>
                      <td className="px-5 py-3.5 cursor-pointer" onClick={()=>{setSelected(c);setShowDetail(true)}}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                            style={{ background: c.is_pro ? 'var(--gold)' : 'var(--accent)' }}>
                            {(c.prenom?.[0]||'') + (c.nom?.[0]||'')}
                          </div>
                          <div>
                            <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{c.prenom} {c.nom}</div>
                            {c.societe && <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-3)' }}><Building2 size={10}/>{c.societe}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 cursor-pointer" onClick={()=>{setSelected(c);setShowDetail(true)}}>
                        <div className="space-y-0.5">
                          {c.email && <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-2)' }}><Mail size={11}/>{c.email}</div>}
                          {(c.mobile||c.tel) && <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-2)' }}><Phone size={11}/>{c.mobile||c.tel}</div>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 cursor-pointer" onClick={()=>{setSelected(c);setShowDetail(true)}}>
                        <div className="flex items-center gap-1 text-sm" style={{ color: 'var(--text-2)' }}>
                          <MapPin size={12} style={{ color: 'var(--text-3)' }}/>
                          {c.ville?`${c.ville}, `:''}{c.pays}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 cursor-pointer" onClick={()=>{setSelected(c);setShowDetail(true)}}>
                        {c.type_bateau
                          ? <div><div className="text-xs font-medium" style={{ color: 'var(--text-1)' }}>{c.type_bateau}</div>
                              {c.coque && <div className="text-xs" style={{ color: 'var(--text-3)' }}>{c.coque}{c.longueur?` · ${c.longueur}`:''}</div>}
                            </div>
                          : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </td>
                      <td className="px-5 py-3.5 cursor-pointer" onClick={()=>{setSelected(c);setShowDetail(true)}}>
                        {c.budget>0
                          ? <div className="flex items-center gap-1 font-mono text-sm font-medium"><Euro size={12} style={{ color: 'var(--gold)' }}/>{c.budget.toLocaleString('fr-FR')}</div>
                          : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </td>
                      <td className="px-5 py-3.5"><span className={`badge ${s.cls}`}>{s.label}</span></td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button className="btn btn-ghost btn-sm p-1.5" onClick={()=>{setSelected(c);setShowDetail(true)}}><Eye size={13}/></button>
                          <button className="btn btn-ghost btn-sm p-1.5" onClick={()=>openEdit(c)}><Pencil size={13}/></button>
                          <button className="btn btn-ghost btn-sm p-1.5" style={{ color: 'var(--red)' }} onClick={()=>{setSelected(c);setShowDelete(true)}}><Trash2 size={13}/></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filtered.length===0 && (
              <div className="text-center py-16" style={{ color: 'var(--text-3)' }}>
                <Users size={32} className="mx-auto mb-2 opacity-30"/><p className="text-sm">Aucun client trouvé</p>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={showAdd} onClose={()=>setShowAdd(false)} title="Nouveau client" size="lg"
        footer={<>
          <button className="btn btn-outline" onClick={()=>setShowAdd(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving||!form.nom}>
            {saving?<><Loader2 size={13} className="animate-spin"/>Enregistrement...</>:'Enregistrer'}
          </button>
        </>}><ClientForm/></Modal>

      <Modal isOpen={showEdit} onClose={()=>setShowEdit(false)} title="Modifier le client"
        subtitle={selected?`${selected.prenom} ${selected.nom}`:''} size="lg"
        footer={<>
          <button className="btn btn-outline" onClick={()=>setShowEdit(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={handleUpdate} disabled={saving}>
            {saving?<><Loader2 size={13} className="animate-spin"/>Enregistrement...</>:'Enregistrer'}
          </button>
        </>}><ClientForm/></Modal>

      <Modal isOpen={showDetail} onClose={()=>setShowDetail(false)}
        title={selected?`${selected.prenom} ${selected.nom}`:''}
        subtitle={selected?.societe||selected?.pays} size="md"
        footer={<>
          <button className="btn btn-outline" onClick={()=>{setShowDetail(false);if(selected)openEdit(selected)}}>
            <Pencil size={13}/> Modifier
          </button>
          <button className="btn btn-outline" onClick={()=>setShowDetail(false)}>Fermer</button>
        </>}>
        {selected && (
          <div className="grid grid-cols-2 gap-3">
            {[['Email',selected.email],['Mobile',selected.mobile||selected.tel],
              ['Ville',selected.ville],['Pays',selected.pays],
              ['Type bateau',selected.type_bateau],['Coque',selected.coque],
              ['Zone',selected.zone_navigation],
              ['Budget',selected.budget>0?`${selected.budget.toLocaleString('fr-FR')} €`:'—']
            ].filter(([,v])=>v).map(([l,v])=>(
              <div key={String(l)} className="rounded-lg p-3" style={{ background: 'var(--bg)' }}>
                <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{l}</div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal isOpen={showDelete} onClose={()=>setShowDelete(false)} title="Supprimer ce client ?" size="sm"
        footer={<>
          <button className="btn btn-outline" onClick={()=>setShowDelete(false)}>Annuler</button>
          <button className="btn btn-danger" onClick={handleDelete}>Supprimer</button>
        </>}>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          Supprimer <strong>{selected?.prenom} {selected?.nom}</strong> ? Cette action est irréversible.
        </p>
      </Modal>
    </CRMLayout>
  )
}
