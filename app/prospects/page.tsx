'use client'
import { useState, useEffect } from 'react'
import CRMLayout from '@/components/CRMLayout'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import { useAuth } from '@/context/AuthContext'
import { supabase, type Prospect } from '@/lib/supabase'
import { Mail, Phone, MapPin, MessageSquare, Ship, Calendar, Check, UserPlus, Trash2, Loader2 } from 'lucide-react'

const emptyForm = {
  nom: '', prenom: '', email: '', mobile: '', pays: '', zone_navigation: '',
  budget: 0, type_bateau: '', coque: '', longueur: '', commentaire: '',
}

export default function ProspectsPage() {
  const { user, isAdmin } = useAuth()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTraite, setFilterTraite] = useState('')
  const [noteModal, setNoteModal] = useState(false)
  const [convertModal, setConvertModal] = useState(false)
  const [addModal, setAddModal] = useState(false)
  const [selected, setSelected] = useState<Prospect | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadProspects() }, [user])

  const loadProspects = async () => {
    setLoading(true)
    let q = supabase.from('prospects').select('*').order('date_saisie', { ascending: false })
    if (!isAdmin && user) q = q.eq('broker_id', user.broker_id)
    const { data } = await q
    if (data) setProspects(data as Prospect[])
    setLoading(false)
  }

  const filtered = prospects.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${p.nom} ${p.prenom} ${p.email} ${p.pays}`.toLowerCase().includes(q)
    const matchTraite = filterTraite === '' ? true : filterTraite === '1' ? p.traite : !p.traite
    return matchSearch && matchTraite
  })

  const toggleTraite = async (p: Prospect) => {
    await supabase.from('prospects').update({ traite: !p.traite }).eq('id', p.id)
    setProspects(prev => prev.map(x => x.id === p.id ? { ...x, traite: !x.traite } : x))
  }

  const saveNote = async () => {
    if (!selected) return
    setSavingNote(true)
    await supabase.from('prospects').update({ note_broker: noteText }).eq('id', selected.id)
    setProspects(prev => prev.map(p => p.id === selected.id ? { ...p, note_broker: noteText } : p))
    setSavingNote(false)
    setNoteModal(false)
  }

  const deleteProspect = async (id: number) => {
    await supabase.from('prospects').delete().eq('id', id)
    setProspects(prev => prev.filter(p => p.id !== id))
  }

  const convertToClient = async () => {
    if (!selected) return
    await supabase.from('clients').insert({
      broker_id: selected.broker_id || user?.broker_id,
      nom: selected.nom, prenom: selected.prenom,
      email: selected.email, mobile: selected.mobile,
      pays: selected.pays, zone_navigation: selected.zone_navigation,
      budget: selected.budget, type_bateau: selected.type_bateau,
      coque: selected.coque, statut: 1,
    })
    await toggleTraite(selected)
    setConvertModal(false)
  }

  const handleAddProspect = async () => {
    setSaving(true)
    await supabase.from('prospects').insert({ ...form, broker_id: user?.broker_id ?? 1 })
    await loadProspects()
    setAddModal(false)
    setForm({ ...emptyForm })
    setSaving(false)
  }

  return (
    <CRMLayout>
      <Header title="Prospects"
        subtitle={loading ? 'Chargement...' : `${prospects.length.toLocaleString()} demandes reçues`}
        action={{ label: 'Ajouter un prospect', onClick: () => setAddModal(true) }} />

      <div className="px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total',         value: prospects.length,                       color: 'var(--accent)' },
            { label: 'Non traités',   value: prospects.filter(p=>!p.traite).length,  color: 'var(--amber)' },
            { label: 'Traités',       value: prospects.filter(p=>p.traite).length,   color: 'var(--green)' },
            { label: 'Avec budget',   value: prospects.filter(p=>p.budget>0).length, color: 'var(--purple)' },
          ].map(s => (
            <div key={s.label} className="card px-4 py-3 flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text-2)' }}>{s.label}</span>
              <span className="font-mono font-bold text-lg" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 relative">
            <input className="field pl-9" placeholder="Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <select className="field" style={{ width: '180px' }} value={filterTraite} onChange={e=>setFilterTraite(e.target.value)}>
            <option value="">Tous</option>
            <option value="0">Non traités</option>
            <option value="1">Traités</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-3)' }}>
            <Loader2 size={28} className="animate-spin mr-3"/>Chargement depuis Supabase...
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(p => (
              <div key={p.id} className="card p-4 transition-all"
                style={{ opacity: p.traite ? 0.65 : 1, borderLeft: `3px solid ${p.traite ? 'var(--green)' : 'var(--border)'}` }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white"
                    style={{ background: p.traite ? 'var(--green)' : '#7c3aed' }}>
                    {p.traite ? <Check size={16}/> : (p.prenom?.[0]||'')+(p.nom?.[0]||'')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{p.prenom} {p.nom}</span>
                      {p.occasion_id && (
                        <span className="badge badge-blue text-xs flex items-center gap-1">
                          <Ship size={9}/>Réf. #{p.occasion_id}
                        </span>
                      )}
                      {p.budget > 0 && (
                        <span className="badge badge-gray font-mono text-xs">
                          {p.budget.toLocaleString('fr-FR')} €
                        </span>
                      )}
                      {p.traite && <span className="badge badge-green text-xs">✓ Traité</span>}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mb-2">
                      {p.pays && <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-2)' }}><MapPin size={10}/>{p.pays}</div>}
                      {p.email && <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-2)' }}><Mail size={10}/>{p.email}</div>}
                      {p.mobile && <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-2)' }}><Phone size={10}/>{p.mobile}</div>}
                      <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-3)' }}>
                        <Calendar size={10}/>
                        {new Date(p.date_saisie).toLocaleDateString('fr-FR')}
                      </div>
                    </div>

                    {p.commentaire && (
                      <div className="text-xs p-2.5 rounded-lg flex gap-2 mb-2"
                        style={{ background: 'var(--bg)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                        <MessageSquare size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--text-3)' }}/>
                        <span className="line-clamp-2">{p.commentaire}</span>
                      </div>
                    )}

                    {p.note_broker && (
                      <div className="text-xs p-2.5 rounded-lg flex gap-2"
                        style={{ background: '#fef9c3', color: '#92400e', border: '1px solid #fde68a' }}>
                        <span className="font-semibold flex-shrink-0">Note :</span>
                        <span>{p.note_broker}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button className={`btn btn-sm ${p.traite ? 'btn-outline' : 'btn-primary'}`}
                      style={p.traite ? { borderColor: 'var(--green)', color: 'var(--green)' } : {}}
                      onClick={() => toggleTraite(p)}>
                      <Check size={12}/>{p.traite ? 'Réouvrir' : 'Traité'}
                    </button>
                    <button className="btn btn-outline btn-sm"
                      onClick={() => { setSelected(p); setNoteText(p.note_broker||''); setNoteModal(true) }}>
                      <MessageSquare size={12}/>Note
                    </button>
                    <button className="btn btn-outline btn-sm"
                      style={{ color: 'var(--purple)', borderColor: 'var(--purple-bg)' }}
                      onClick={() => { setSelected(p); setConvertModal(true) }}>
                      <UserPlus size={12}/>Convertir
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }}
                      onClick={() => deleteProspect(p.id)}>
                      <Trash2 size={12}/>Supprimer
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filtered.length === 0 && !loading && (
              <div className="text-center py-16" style={{ color: 'var(--text-3)' }}>
                <MessageSquare size={32} className="mx-auto mb-2 opacity-30"/>
                <p className="text-sm">Aucun prospect trouvé</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* NOTE MODAL */}
      <Modal isOpen={noteModal} onClose={()=>setNoteModal(false)} title="Note interne"
        subtitle={selected?`${selected.prenom} ${selected.nom}`:''} size="sm"
        footer={<>
          <button className="btn btn-outline" onClick={()=>setNoteModal(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={saveNote} disabled={savingNote}>
            {savingNote?<><Loader2 size={13} className="animate-spin"/>Sauvegarde...</>:'Enregistrer'}
          </button>
        </>}>
        <div>
          <label className="field-label">Note (visible par votre équipe)</label>
          <textarea className="field" rows={4} value={noteText} onChange={e=>setNoteText(e.target.value)}
            placeholder="Ex: Intéressé, budget confirmé, visite à programmer..." />
        </div>
      </Modal>

      {/* CONVERT MODAL */}
      <Modal isOpen={convertModal} onClose={()=>setConvertModal(false)} title="Convertir en client ?" size="sm"
        footer={<>
          <button className="btn btn-outline" onClick={()=>setConvertModal(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={convertToClient}>
            <UserPlus size={13}/>Créer la fiche client
          </button>
        </>}>
        <div className="space-y-3">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Une fiche client sera créée avec les informations de contact de ce prospect.
          </p>
          {selected && (
            <div className="rounded-lg p-3 space-y-1" style={{ background: 'var(--bg)' }}>
              {[['Nom', `${selected.prenom} ${selected.nom}`], ['Email', selected.email||'—'],
                ['Pays', selected.pays||'—'], ['Mobile', selected.mobile||'—']].map(([l,v])=>(
                <div key={l} className="flex gap-2 text-sm">
                  <span style={{ color: 'var(--text-3)', minWidth: '50px' }}>{l}</span>
                  <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ADD PROSPECT */}
      <Modal isOpen={addModal} onClose={()=>setAddModal(false)} title="Nouveau prospect" size="md"
        footer={<>
          <button className="btn btn-outline" onClick={()=>setAddModal(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={handleAddProspect} disabled={saving||!form.nom}>
            {saving?<><Loader2 size={13} className="animate-spin"/>Enregistrement...</>:'Enregistrer'}
          </button>
        </>}>
        <div className="grid grid-cols-2 gap-4">
          {[['Prénom *','prenom'],['Nom *','nom'],['Email','email'],['Mobile','mobile'],
            ['Pays','pays'],['Zone navigation','zone_navigation']].map(([l,f])=>(
            <div key={f}><label className="field-label">{l}</label>
              <input className="field" value={(form as any)[f]} onChange={e=>setForm(p=>({...p,[f]:e.target.value}))} />
            </div>
          ))}
          <div><label className="field-label">Budget max (€)</label>
            <input type="number" className="field" value={form.budget} onChange={e=>setForm(p=>({...p,budget:+e.target.value}))} />
          </div>
          <div className="col-span-2"><label className="field-label">Message / Commentaire</label>
            <textarea className="field" rows={3} value={form.commentaire} onChange={e=>setForm(p=>({...p,commentaire:e.target.value}))} />
          </div>
        </div>
      </Modal>
    </CRMLayout>
  )
}
