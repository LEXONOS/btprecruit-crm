'use client'
import { useState, useEffect } from 'react'
import CRMLayout from '@/components/CRMLayout'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import { supabase } from '@/lib/supabase'
import { Globe, MapPin, Loader2, Pencil, Trash2 } from 'lucide-react'

const emptyForm = { nom: '', pays: 'France', ville: '', url: '', email: '', tel: '' }

export default function FabricantsPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPays, setFilterPays] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('fabricants').select('*').order('nom')
    if (data) setItems(data)
    setLoading(false)
  }

  const pays = Array.from(new Set(items.map(f => f.pays).filter(Boolean))).sort()
  const filtered = items.filter(f => {
    const q = search.toLowerCase()
    return (!q || `${f.nom} ${f.pays} ${f.ville}`.toLowerCase().includes(q)) && (!filterPays || f.pays === filterPays)
  })

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('fabricants').insert(form)
    if (!error) { await load(); setShowAdd(false); setForm({ ...emptyForm }) }
    setSaving(false)
  }
  const handleUpdate = async () => {
    if (!selected) return; setSaving(true)
    const { error } = await supabase.from('fabricants').update(form).eq('id', selected.id)
    if (!error) { await load(); setShowEdit(false) }
    setSaving(false)
  }
  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce fabricant ?')) return
    await supabase.from('fabricants').delete().eq('id', id)
    await load()
  }

  const FabForm = () => (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2"><label className="field-label">Nom *</label><input className="field" value={form.nom} onChange={e => setForm(p=>({...p,nom:e.target.value}))} placeholder="Fountaine Pajot"/></div>
      <div><label className="field-label">Pays</label><input className="field" value={form.pays} onChange={e => setForm(p=>({...p,pays:e.target.value}))}/></div>
      <div><label className="field-label">Ville</label><input className="field" value={form.ville} onChange={e => setForm(p=>({...p,ville:e.target.value}))}/></div>
      <div className="col-span-2"><label className="field-label">Site web</label><input className="field" value={form.url} onChange={e => setForm(p=>({...p,url:e.target.value}))} placeholder="https://..."/></div>
      <div><label className="field-label">Email</label><input type="email" className="field" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))}/></div>
      <div><label className="field-label">Téléphone</label><input className="field" value={form.tel} onChange={e => setForm(p=>({...p,tel:e.target.value}))}/></div>
    </div>
  )

  return (
    <CRMLayout>
      <Header title="Fabricants" subtitle={`${items.length} chantiers navals`} action={{ label: 'Ajouter', onClick: () => { setForm({ ...emptyForm }); setShowAdd(true) } }} />
      <div className="px-8 py-6">
        <div className="flex gap-3 mb-5">
          <div className="flex-1 relative">
            <input className="field pl-9" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}/>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <select className="field" style={{ width: '160px' }} value={filterPays} onChange={e => setFilterPays(e.target.value)}>
            <option value="">Tous les pays</option>{pays.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-3)' }}><Loader2 size={24} className="animate-spin mr-2"/>Chargement...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(f => (
              <div key={f.id} className="card card-hover p-4 group">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: 'var(--gold)' }}>{f.nom.slice(0,2).toUpperCase()}</div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="btn btn-ghost btn-sm p-1" onClick={() => { setSelected(f); setForm({ nom: f.nom, pays: f.pays||'', ville: f.ville||'', url: f.url||'', email: f.email||'', tel: f.tel||'' }); setShowEdit(true) }}><Pencil size={11}/></button>
                    <button className="btn btn-ghost btn-sm p-1 hover:text-red-500" onClick={() => handleDelete(f.id)}><Trash2 size={11}/></button>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{f.nom}</div>
                  <div className="flex items-center gap-1 text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                    <MapPin size={10}/>{f.ville ? `${f.ville}, ` : ''}{f.pays}
                  </div>
                  {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs mt-1 hover:underline" style={{ color: 'var(--accent)' }} onClick={e => e.stopPropagation()}><Globe size={10}/>Site web</a>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Nouveau fabricant" size="md"
        footer={<><button className="btn btn-outline" onClick={() => setShowAdd(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.nom}>{saving ? <><Loader2 size={13} className="animate-spin"/> Enregistrement...</> : 'Enregistrer'}</button></>}>
        <FabForm />
      </Modal>
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Modifier" subtitle={selected?.nom} size="md"
        footer={<><button className="btn btn-outline" onClick={() => setShowEdit(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={handleUpdate} disabled={saving}>{saving ? <><Loader2 size={13} className="animate-spin"/> Enregistrement...</> : 'Enregistrer'}</button></>}>
        <FabForm />
      </Modal>
    </CRMLayout>
  )
}
