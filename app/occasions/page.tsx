'use client'
import { useState, useEffect } from 'react'
import CRMLayout from '@/components/CRMLayout'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import { useAuth } from '@/context/AuthContext'
import { supabase, type Occasion } from '@/lib/supabase'
import { fabricants as fabricantsList, statusOccasions } from '@/data/referentials'
import { Ship, MapPin, Calendar, Bed, Pencil, Trash2, Eye, ImageOff, Upload, Loader2 } from 'lucide-react'

const statusStyle: Record<string, { label: string; cls: string }> = {
  '1':  { label: 'En vente',       cls: 'badge-green' },
  '2':  { label: 'Sous compromis', cls: 'badge-amber' },
  '3':  { label: 'Vendu',          cls: 'badge-gray' },
  '-1': { label: 'Retiré',         cls: 'badge-red' },
  '-3': { label: 'Charter',        cls: 'badge-blue' },
}

const emptyForm = {
  fabricant: '', modele: '', annee: new Date().getFullYear(), nom: '',
  prix: 0, devise: 'TTC', zone: '', pays: 'France', nb_cabines: 0,
  nb_couchages: 0, statut: 1, description_fr: '', visible_site: false,
}

export default function OccasionsPage() {
  const { user, isAdmin } = useAuth()
  const [occasions, setOccasions] = useState<Occasion[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [selected, setSelected] = useState<Occasion | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photos, setPhotos] = useState<Record<number, string>>({})

  // Charger depuis Supabase
  useEffect(() => { loadOccasions() }, [user])

  const loadOccasions = async () => {
    setLoading(true)
    let q = supabase.from('occasions').select('*, photos_occasions(url, est_principale, ordre)').order('created_at', { ascending: false })
    if (!isAdmin && user) q = q.eq('broker_id', user.broker_id)
    const { data, error } = await q
    if (!error && data) setOccasions(data as Occasion[])
    setLoading(false)
  }

  const getMainPhoto = (o: Occasion): string | null => {
    const ph = (o as any).photos_occasions
    if (!ph || ph.length === 0) return null
    const main = ph.find((p: any) => p.est_principale) || ph[0]
    return main?.url || null
  }

  const filtered = occasions.filter(o => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${o.fabricant} ${o.modele} ${o.nom} ${o.zone}`.toLowerCase().includes(q)
    const matchStatut = !filterStatut || String(o.statut) === filterStatut
    return matchSearch && matchStatut
  })

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('occasions').insert({
      ...form, broker_id: user?.broker_id ?? 1
    })
    if (!error) { await loadOccasions(); setShowAdd(false) }
    setSaving(false)
  }

  const handleUpdate = async () => {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('occasions').update(form).eq('id', selected.id)
    if (!error) { await loadOccasions(); setShowEdit(false) }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!selected) return
    await supabase.from('occasions').delete().eq('id', selected.id)
    await loadOccasions()
    setShowDelete(false)
  }

  const handlePhotoUpload = async (occasionId: number, file: File) => {
    setUploadingPhoto(true)
    const ext = file.name.split('.').pop()
    const path = `occasions/${occasionId}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
    if (!error && data) {
      const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)
      await supabase.from('photos_occasions').insert({
        occasion_id: occasionId, url: publicUrl, est_principale: true, ordre: 0
      })
      await loadOccasions()
    }
    setUploadingPhoto(false)
  }

  const OccasionForm = () => (
    <div className="grid grid-cols-2 gap-4">
      <div><label className="field-label">Fabricant *</label>
        <select className="field" value={form.fabricant} onChange={e => setForm(p => ({ ...p, fabricant: e.target.value }))}>
          <option value="">— Sélectionner —</option>
          {fabricantsList.map(f => <option key={f.id}>{f.nom}</option>)}
        </select>
      </div>
      <div><label className="field-label">Modèle *</label>
        <input className="field" value={form.modele} onChange={e => setForm(p => ({ ...p, modele: e.target.value }))} placeholder="ex: 440" />
      </div>
      <div><label className="field-label">Nom du bateau</label>
        <input className="field" value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))} placeholder="ex: Blue Moon" />
      </div>
      <div><label className="field-label">Année</label>
        <input type="number" className="field" value={form.annee} onChange={e => setForm(p => ({ ...p, annee: +e.target.value }))} />
      </div>
      <div><label className="field-label">Prix (€) *</label>
        <input type="number" className="field" value={form.prix} onChange={e => setForm(p => ({ ...p, prix: +e.target.value }))} />
      </div>
      <div><label className="field-label">Devise</label>
        <select className="field" value={form.devise} onChange={e => setForm(p => ({ ...p, devise: e.target.value }))}>
          <option>TTC</option><option>HT</option><option>USD</option>
        </select>
      </div>
      <div><label className="field-label">Zone</label>
        <input className="field" value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} placeholder="ex: Martinique" />
      </div>
      <div><label className="field-label">Pays</label>
        <input className="field" value={form.pays} onChange={e => setForm(p => ({ ...p, pays: e.target.value }))} />
      </div>
      <div><label className="field-label">Cabines</label>
        <input type="number" className="field" value={form.nb_cabines} onChange={e => setForm(p => ({ ...p, nb_cabines: +e.target.value }))} />
      </div>
      <div><label className="field-label">Couchages</label>
        <input type="number" className="field" value={form.nb_couchages} onChange={e => setForm(p => ({ ...p, nb_couchages: +e.target.value }))} />
      </div>
      <div className="col-span-2"><label className="field-label">Description</label>
        <textarea className="field" rows={3} value={form.description_fr} onChange={e => setForm(p => ({ ...p, description_fr: e.target.value }))} />
      </div>
      <div><label className="field-label">Statut</label>
        <select className="field" value={form.statut} onChange={e => setForm(p => ({ ...p, statut: +e.target.value }))}>
          {statusOccasions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3 pt-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.visible_site} onChange={e => setForm(p => ({ ...p, visible_site: e.target.checked }))}
            className="w-4 h-4" style={{ accentColor: 'var(--accent)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Visible sur le site public</span>
        </label>
      </div>
    </div>
  )

  return (
    <CRMLayout>
      <Header title="Annonces" subtitle={`${filtered.length} annonce${filtered.length > 1 ? 's' : ''}`}
        action={{ label: 'Nouvelle annonce', onClick: () => { setForm({ ...emptyForm }); setShowAdd(true) } }} />

      <div className="px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'En vente',       value: occasions.filter(o => o.statut === 1).length,  color: 'var(--green)' },
            { label: 'Sous compromis', value: occasions.filter(o => o.statut === 2).length,  color: 'var(--amber)' },
            { label: 'Visibles site',  value: occasions.filter(o => o.visible_site).length,  color: 'var(--accent)' },
            { label: 'Total',          value: occasions.length,                               color: 'var(--text-2)' },
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
            <input className="field pl-9" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <select className="field" style={{ width: '180px' }} value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
            <option value="">Tous les statuts</option>
            {statusOccasions.map(s => <option key={s.value} value={String(s.value)}>{s.label}</option>)}
          </select>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-md)' }}>
            {(['grid', 'list'] as const).map(m => (
              <button key={m} onClick={() => setView(m)} className="px-3 py-2 text-sm"
                style={{ background: view === m ? 'var(--accent-bg)' : 'var(--surface)', color: view === m ? 'var(--accent)' : 'var(--text-2)' }}>
                {m === 'grid' ? '⊞' : '≡'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-3)' }}>
            <Loader2 size={28} className="animate-spin mr-3" />Chargement depuis Supabase...
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(o => {
              const s = statusStyle[String(o.statut)] || statusStyle['1']
              const photo = getMainPhoto(o)
              return (
                <div key={o.id} className="card card-hover overflow-hidden" onClick={() => { setSelected(o); setShowDetail(true) }}>
                  <div className="h-40 relative overflow-hidden" style={{ background: 'var(--bg)' }}>
                    {photo ? (
                      <img src={photo} alt={o.modele} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ color: 'var(--text-3)' }}>
                        <ImageOff size={28} strokeWidth={1} /><span className="text-xs">Pas de photo</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3"><span className={`badge ${s.cls}`}>{s.label}</span></div>
                    {o.visible_site && (
                      <div className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: '#dcfce7', color: '#16a34a' }}>🌐 Sur le site</div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="font-semibold" style={{ color: 'var(--text-1)' }}>
                      {o.fabricant} <span style={{ color: 'var(--gold)' }}>{o.modele}</span>
                    </div>
                    {o.nom && <div className="text-sm italic mt-0.5" style={{ color: 'var(--text-3)' }}>«{o.nom}»</div>}
                    <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-3)' }}>
                      <span className="flex items-center gap-1"><Calendar size={10} />{o.annee}</span>
                      <span className="flex items-center gap-1"><Bed size={10} />{o.nb_cabines} cab.</span>
                      {o.zone && <span className="flex items-center gap-1"><MapPin size={10} />{o.zone}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                      <div className="font-mono font-bold" style={{ color: 'var(--text-1)' }}>
                        {o.prix.toLocaleString('fr-FR')} €
                      </div>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button className="btn btn-ghost btn-sm p-1.5" onClick={() => { setSelected(o); setForm({ fabricant: o.fabricant, modele: o.modele, annee: o.annee, nom: o.nom||'', prix: o.prix, devise: o.devise, zone: o.zone||'', pays: o.pays||'France', nb_cabines: o.nb_cabines, nb_couchages: o.nb_couchages, statut: o.statut, description_fr: o.description_fr||'', visible_site: o.visible_site }); setShowEdit(true) }}>
                          <Pencil size={12} />
                        </button>
                        <button className="btn btn-ghost btn-sm p-1.5" onClick={() => { setSelected(o); setShowDelete(true) }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="col-span-3 text-center py-16" style={{ color: 'var(--text-3)' }}>
                <Ship size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">Aucune annonce</p>
              </div>
            )}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead><tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                {['Photo','Bateau','Nom','Année','Zone','Prix','Statut','Site',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map((o, i) => {
                  const s = statusStyle[String(o.statut)] || statusStyle['1']
                  const photo = getMainPhoto(o)
                  return (
                    <tr key={o.id} className="table-row" style={{ borderBottom: i < filtered.length-1 ? '1px solid var(--border)' : 'none' }}
                      onClick={() => { setSelected(o); setShowDetail(true) }}>
                      <td className="px-4 py-3">
                        {photo ? <img src={photo} alt="" className="w-10 h-8 rounded object-cover" />
                          : <div className="w-10 h-8 rounded flex items-center justify-center" style={{ background: 'var(--bg)' }}><ImageOff size={12} style={{ color: 'var(--text-3)' }} /></div>}
                      </td>
                      <td className="px-4 py-3"><div className="font-medium text-sm">{o.fabricant}</div><div className="text-xs" style={{ color: 'var(--gold)' }}>{o.modele}</div></td>
                      <td className="px-4 py-3 text-sm italic" style={{ color: 'var(--text-3)' }}>{o.nom||'—'}</td>
                      <td className="px-4 py-3 font-mono text-sm">{o.annee}</td>
                      <td className="px-4 py-3 text-xs">{o.zone||'—'}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-sm">{o.prix.toLocaleString('fr-FR')} €</td>
                      <td className="px-4 py-3"><span className={`badge ${s.cls}`}>{s.label}</span></td>
                      <td className="px-4 py-3 text-center">{o.visible_site ? '🌐' : '—'}</td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost btn-sm p-1.5" onClick={() => { setSelected(o); setShowEdit(true) }}><Pencil size={12} /></button>
                          <button className="btn btn-ghost btn-sm p-1.5" onClick={() => { setSelected(o); setShowDelete(true) }}><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Nouvelle annonce" size="lg"
        footer={<>
          <button className="btn btn-outline" onClick={() => setShowAdd(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.fabricant || !form.modele}>
            {saving ? <><Loader2 size={13} className="animate-spin" /> Enregistrement...</> : 'Publier l\'annonce'}
          </button>
        </>}>
        <OccasionForm />
      </Modal>

      {/* EDIT */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Modifier" subtitle={selected ? `${selected.fabricant} ${selected.modele}` : ''} size="lg"
        footer={<>
          <button className="btn btn-outline" onClick={() => setShowEdit(false)}>Annuler</button>
          <button className="btn btn-primary" onClick={handleUpdate} disabled={saving}>
            {saving ? <><Loader2 size={13} className="animate-spin" /> Enregistrement...</> : 'Enregistrer'}
          </button>
        </>}>
        <OccasionForm />
      </Modal>

      {/* DETAIL */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)}
        title={selected ? `${selected.fabricant} ${selected.modele}` : ''} size="lg"
        footer={<>
          <button className="btn btn-outline" onClick={() => { setShowDetail(false); if(selected) { setForm({ fabricant: selected.fabricant, modele: selected.modele, annee: selected.annee, nom: selected.nom||'', prix: selected.prix, devise: selected.devise, zone: selected.zone||'', pays: selected.pays||'France', nb_cabines: selected.nb_cabines, nb_couchages: selected.nb_couchages, statut: selected.statut, description_fr: selected.description_fr||'', visible_site: selected.visible_site }); setShowEdit(true) } }}>
            <Pencil size={13} /> Modifier
          </button>
          <button className="btn btn-outline" onClick={() => setShowDetail(false)}>Fermer</button>
        </>}>
        {selected && (
          <div>
            {/* Upload photo */}
            <div className="mb-4 p-3 rounded-xl flex items-center gap-3"
              style={{ background: 'var(--bg)', border: '2px dashed var(--border-md)' }}>
              <Upload size={18} style={{ color: 'var(--accent)' }} />
              <div className="flex-1">
                <div className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Ajouter des photos</div>
                <div className="text-xs" style={{ color: 'var(--text-3)' }}>JPG, PNG, WebP · max 10 Mo</div>
              </div>
              <label className="btn btn-primary btn-sm cursor-pointer">
                {uploadingPhoto ? <><Loader2 size={12} className="animate-spin" /> Upload...</> : 'Choisir fichier'}
                <input type="file" accept="image/*" className="hidden" onChange={e => { if(e.target.files?.[0]) handlePhotoUpload(selected.id, e.target.files[0]) }} />
              </label>
            </div>
            {/* Infos */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[['Prix', `${selected.prix.toLocaleString('fr-FR')} € ${selected.devise}`],
                ['Année', selected.annee], ['Cabines', selected.nb_cabines],
                ['Couchages', selected.nb_couchages], ['Zone', selected.zone||'—'], ['Pays', selected.pays||'—'],
                ['Sur le site', selected.visible_site ? '✅ Oui' : '❌ Non'], ['Statut', statusStyle[String(selected.statut)]?.label || '']
              ].map(([l,v]) => (
                <div key={String(l)} className="rounded-lg p-3" style={{ background: 'var(--bg)' }}>
                  <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{l}</div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{v}</div>
                </div>
              ))}
            </div>
            {selected.description_fr && (
              <p className="text-sm" style={{ color: 'var(--text-2)', lineHeight: '1.6' }}>{selected.description_fr}</p>
            )}
          </div>
        )}
      </Modal>

      {/* DELETE */}
      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} title="Supprimer ?" size="sm"
        footer={<>
          <button className="btn btn-outline" onClick={() => setShowDelete(false)}>Annuler</button>
          <button className="btn btn-danger" onClick={handleDelete}>Supprimer</button>
        </>}>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          Supprimer <strong>{selected?.fabricant} {selected?.modele}</strong> «{selected?.nom}» ? Irréversible.
        </p>
      </Modal>
    </CRMLayout>
  )
}
