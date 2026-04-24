'use client'
import { useState, useEffect } from 'react'
import CRMLayout from '@/components/CRMLayout'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import { supabase } from '@/lib/supabase'
import { Loader2, Pencil, Trash2 } from 'lucide-react'

const emptyForm = { modele: '', fabricant: '', puissance: 0, carburant: 'Diesel' }

export default function MoteursPage() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterFab, setFilterFab] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('moteurs').select('*').order('fabricant').order('puissance')
    if (data) setItems(data)
    setLoading(false)
  }

  const fabList = Array.from(new Set(items.map(m => m.fabricant).filter(Boolean))).sort()
  const filtered = items.filter(m => {
    const q = search.toLowerCase()
    return (!q || `${m.modele} ${m.fabricant}`.toLowerCase().includes(q)) && (!filterFab || m.fabricant === filterFab)
  })

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('moteurs').insert(form)
    await load(); setShowAdd(false); setForm({ ...emptyForm }); setSaving(false)
  }
  const handleUpdate = async () => {
    if (!selected) return; setSaving(true)
    await supabase.from('moteurs').update(form).eq('id', selected.id)
    await load(); setShowEdit(false); setSaving(false)
  }
  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce moteur ?')) return
    await supabase.from('moteurs').delete().eq('id', id); await load()
  }

  return (
    <CRMLayout>
      <Header title="Moteurs" subtitle={`${items.length} motorisations référencées`} action={{ label: 'Ajouter un moteur', onClick: () => { setForm({ ...emptyForm }); setShowAdd(true) } }} />
      <div className="px-8 py-6">
        <div className="flex gap-3 mb-5">
          <div className="flex-1 relative">
            <input className="field pl-9" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}/>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <select className="field" style={{ width: '180px' }} value={filterFab} onChange={e => setFilterFab(e.target.value)}>
            <option value="">Tous les fabricants</option>{fabList.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-3)' }}><Loader2 size={24} className="animate-spin mr-2"/>Chargement...</div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead><tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                {['Modèle','Fabricant','Puissance','Carburant',''].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr key={m.id} className="table-row" style={{ borderBottom: i < filtered.length-1 ? '1px solid var(--border)' : 'none' }}>
                    <td className="px-5 py-3 font-mono font-medium text-sm" style={{ color: 'var(--text-1)' }}>{m.modele}</td>
                    <td className="px-5 py-3"><span className="badge badge-gray text-xs">{m.fabricant}</span></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(m.puissance / 3, 80)}px`, minWidth: '6px', background: 'linear-gradient(90deg, var(--accent), #38bdf8)' }}/>
                        <span className="font-mono text-sm font-semibold" style={{ color: 'var(--accent)' }}>{m.puissance} CV</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="badge" style={{ background: m.carburant === 'Diesel' ? '#dcfce7' : '#fef3c7', color: m.carburant === 'Diesel' ? '#16a34a' : '#d97706' }}>{m.carburant}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <button className="btn btn-ghost btn-sm p-1.5" onClick={() => { setSelected(m); setForm({ modele: m.modele, fabricant: m.fabricant||'', puissance: m.puissance, carburant: m.carburant }); setShowEdit(true) }}><Pencil size={12}/></button>
                        <button className="btn btn-ghost btn-sm p-1.5 hover:text-red-500" onClick={() => handleDelete(m.id)}><Trash2 size={12}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Nouveau moteur" size="sm"
        footer={<><button className="btn btn-outline" onClick={() => setShowAdd(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.modele}>{saving ? <><Loader2 size={13} className="animate-spin"/> Enregistrement...</> : 'Enregistrer'}</button></>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="field-label">Modèle *</label><input className="field" value={form.modele} onChange={e => setForm(p=>({...p,modele:e.target.value}))}/></div>
          <div><label className="field-label">Fabricant</label><input className="field" value={form.fabricant} onChange={e => setForm(p=>({...p,fabricant:e.target.value}))}/></div>
          <div><label className="field-label">Puissance (CV)</label><input type="number" className="field" value={form.puissance} onChange={e => setForm(p=>({...p,puissance:+e.target.value}))}/></div>
          <div><label className="field-label">Carburant</label>
            <select className="field" value={form.carburant} onChange={e => setForm(p=>({...p,carburant:e.target.value}))}>
              <option>Diesel</option><option>Essence</option><option>Électrique</option><option>Hybride</option>
            </select>
          </div>
        </div>
      </Modal>
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Modifier le moteur" subtitle={selected?.modele} size="sm"
        footer={<><button className="btn btn-outline" onClick={() => setShowEdit(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={handleUpdate} disabled={saving}>{saving ? <><Loader2 size={13} className="animate-spin"/> Enregistrement...</> : 'Enregistrer'}</button></>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="field-label">Modèle</label><input className="field" value={form.modele} onChange={e => setForm(p=>({...p,modele:e.target.value}))}/></div>
          <div><label className="field-label">Fabricant</label><input className="field" value={form.fabricant} onChange={e => setForm(p=>({...p,fabricant:e.target.value}))}/></div>
          <div><label className="field-label">Puissance (CV)</label><input type="number" className="field" value={form.puissance} onChange={e => setForm(p=>({...p,puissance:+e.target.value}))}/></div>
          <div><label className="field-label">Carburant</label>
            <select className="field" value={form.carburant} onChange={e => setForm(p=>({...p,carburant:e.target.value}))}>
              <option>Diesel</option><option>Essence</option><option>Électrique</option><option>Hybride</option>
            </select>
          </div>
        </div>
      </Modal>
    </CRMLayout>
  )
}
