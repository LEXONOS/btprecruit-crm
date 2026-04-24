'use client'
import { useState, useEffect } from 'react'
import CRMLayout from '@/components/CRMLayout'
import Header from '@/components/Header'
import Modal from '@/components/Modal'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  CHECKLIST_AMEL, CHECKLIST_GENERAL, QUESTIONNAIRE_AMEL_PARTS,
  decodeHIN, generateActeVente, generateMandatExclusif,
  generateMandatOpen, generatePromesseVente, type ContractData
} from '@/lib/documents-data'
import {
  FileText, ClipboardList, HelpCircle, Hash, Plus,
  Download, Copy, Check, ChevronDown, ChevronRight,
  Ship, Loader2, Eye, Pencil, Trash2
} from 'lucide-react'

const TABS = [
  { id: 'contrats',     label: 'Contrats',       icon: FileText,      desc: 'Acte de vente, mandats, promesses' },
  { id: 'inspections',  label: 'Inspections',    icon: ClipboardList, desc: 'Checklists photo bateaux' },
  { id: 'questionnaire',label: 'Questionnaire',  icon: HelpCircle,    desc: 'Questions pré-achat Amel' },
  { id: 'hin',          label: 'Décodeur HIN',   icon: Hash,          desc: 'Décoder numéro de coque' },
]

const CONTRACT_TYPES = [
  { id: 'acte_vente',       label: 'Acte de vente',          desc: 'Transfert de propriété définitif', color: '#16a34a' },
  { id: 'mandat_exclusif',  label: 'Mandat exclusif',        desc: 'Mandat de vente exclusif 6 mois',  color: '#c9943a' },
  { id: 'mandat_open',      label: 'Mandat open',            desc: 'Mandat non-exclusif',              color: '#0284c7' },
  { id: 'promesse_vente',   label: 'Promesse de vente',      desc: 'Avant-contrat avec dépôt',         color: '#7c3aed' },
]

const emptyContractData: Partial<ContractData> = {
  bateau_marque: '', bateau_modele: '', bateau_annee: 2000, bateau_nom: '',
  bateau_immatriculation: '', bateau_pavillon: 'France', bateau_moteur: '', bateau_num_serie: '',
  vendeur_nom: '', vendeur_prenom: '', vendeur_adresse: '', vendeur_nationalite: 'Français',
  vendeur_email: '', vendeur_tel: '',
  acheteur_nom: '', acheteur_prenom: '', acheteur_adresse: '', acheteur_nationalite: '',
  acheteur_email: '', acheteur_tel: '',
  prix: 0, devise: '€', commission_pct: 8, depot_garantie: 0,
  date_signature: new Date().toLocaleDateString('fr-FR'),
  lieu_signature: 'Pointe à Pitre, Guadeloupe',
  broker_nom: '', broker_email: '', broker_tel: '', societe: 'Caraibe Yachts',
}

export default function DocumentsPage() {
  const { user, isAdmin } = useAuth()
  const [tab, setTab] = useState('contrats')
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Contrats
  const [contractModal, setContractModal] = useState(false)
  const [contractType, setContractType] = useState('acte_vente')
  const [contractData, setContractData] = useState<Partial<ContractData>>({ ...emptyContractData })
  const [previewModal, setPreviewModal] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [copied, setCopied] = useState(false)
  const [savingContract, setSavingContract] = useState(false)

  // Inspections
  const [inspections, setInspections] = useState<any[]>([])
  const [inspectionModal, setInspectionModal] = useState(false)
  const [activeInspection, setActiveInspection] = useState<any>(null)
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())

  // Questionnaire
  const [questModal, setQuestModal] = useState(false)
  const [questReponses, setQuestReponses] = useState<Record<string, string>>({})
  const [questSection, setQuestSection] = useState(0)

  // HIN
  const [hinInput, setHinInput] = useState('')
  const [hinResult, setHinResult] = useState<any>(null)

  useEffect(() => { loadDocuments() }, [user])

  const loadDocuments = async () => {
    setLoading(true)
    let q = supabase.from('documents').select('*').order('created_at', { ascending: false })
    if (!isAdmin && user) q = q.eq('broker_id', user.broker_id)
    const { data } = await q
    if (data) setDocuments(data)

    let q2 = supabase.from('inspections').select('*').order('created_at', { ascending: false })
    if (!isAdmin && user) q2 = q2.eq('broker_id', user.broker_id)
    const { data: insp } = await q2
    if (insp) setInspections(insp)

    setLoading(false)
  }

  // ─── CONTRACT GENERATOR ──────────────────────────────────────────────────────
  const generatePreview = () => {
    let text = ''
    const d = { ...contractData, broker_nom: user?.name, broker_email: user?.email }
    if (contractType === 'acte_vente')      text = generateActeVente(d)
    if (contractType === 'mandat_exclusif') text = generateMandatExclusif(d)
    if (contractType === 'mandat_open')     text = generateMandatOpen(d)
    if (contractType === 'promesse_vente')  text = generatePromesseVente(d)
    setPreviewText(text)
    setPreviewModal(true)
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(previewText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const saveContract = async () => {
    setSavingContract(true)
    const typeLabel = CONTRACT_TYPES.find(t => t.id === contractType)?.label || contractType
    await supabase.from('documents').insert({
      broker_id: user?.broker_id ?? 1,
      type: contractType,
      titre: `${typeLabel} — ${contractData.bateau_marque} ${contractData.bateau_modele}`,
      statut: 'brouillon',
      donnees: contractData,
    })
    await loadDocuments()
    setSavingContract(false)
    setContractModal(false)
  }

  // ─── INSPECTION ──────────────────────────────────────────────────────────────
  const createInspection = async (type: 'amel' | 'general', occasionTitle: string) => {
    const checklist = type === 'amel' ? CHECKLIST_AMEL : CHECKLIST_GENERAL
    const { data } = await supabase.from('inspections').insert({
      broker_id: user?.broker_id ?? 1,
      titre: `Inspection — ${occasionTitle}`,
      type_bateau: type,
      sections: checklist,
      progression: 0,
      statut: 'en_cours',
    }).select().single()
    if (data) {
      setActiveInspection(data)
      setInspectionModal(true)
      await loadDocuments()
    }
  }

  const toggleItem = async (sectionIdx: number, itemIdx: number) => {
    if (!activeInspection) return
    const sections = JSON.parse(JSON.stringify(activeInspection.sections))
    sections[sectionIdx].items[itemIdx].done = !sections[sectionIdx].items[itemIdx].done
    const totalItems = sections.flatMap((s: any) => s.items).length
    const doneItems = sections.flatMap((s: any) => s.items).filter((i: any) => i.done).length
    const progression = Math.round((doneItems / totalItems) * 100)
    await supabase.from('inspections').update({ sections, progression }).eq('id', activeInspection.id)
    setActiveInspection({ ...activeInspection, sections, progression })
  }

  const updateItemNote = async (sectionIdx: number, itemIdx: number, note: string) => {
    if (!activeInspection) return
    const sections = JSON.parse(JSON.stringify(activeInspection.sections))
    sections[sectionIdx].items[itemIdx].note = note
    await supabase.from('inspections').update({ sections }).eq('id', activeInspection.id)
    setActiveInspection({ ...activeInspection, sections })
  }

  // ─── QUESTIONNAIRE ────────────────────────────────────────────────────────────
  const saveQuestionnaire = async () => {
    await supabase.from('questionnaires').insert({
      broker_id: user?.broker_id ?? 1,
      type: 'amel_pre_purchase',
      reponses: questReponses,
      progression: Math.round((Object.keys(questReponses).length / 60) * 100),
    })
    setQuestModal(false)
  }

  const F = ({ field, label }: { field: string; label: string }) => (
    <div>
      <label className="field-label">{label}</label>
      <input className="field" value={contractData[field as keyof ContractData] as string || ''}
        onChange={e => setContractData(p => ({ ...p, [field]: e.target.value }))} />
    </div>
  )
  const FN = ({ field, label }: { field: string; label: string }) => (
    <div>
      <label className="field-label">{label}</label>
      <input type="number" className="field" value={contractData[field as keyof ContractData] as number || 0}
        onChange={e => setContractData(p => ({ ...p, [field]: +e.target.value }))} />
    </div>
  )

  return (
    <CRMLayout>
      <Header title="Documents & Outils"
        subtitle="Contrats, inspections, questionnaires, décodeur HIN" />

      <div className="px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all"
              style={{
                background: tab === t.id ? 'var(--accent-bg)' : 'var(--surface)',
                color: tab === t.id ? 'var(--accent)' : 'var(--text-2)',
                border: tab === t.id ? '1px solid rgba(2,132,199,0.3)' : '1px solid var(--border)',
              }}>
              <t.icon size={15} />
              <div className="text-left">
                <div>{t.label}</div>
                <div style={{ fontSize: '11px', opacity: 0.7, fontWeight: 400 }}>{t.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* ═══ CONTRATS ═══════════════════════════════════════════════════════════ */}
        {tab === 'contrats' && (
          <div>
            <div className="flex gap-4 mb-6">
              {CONTRACT_TYPES.map(ct => (
                <button key={ct.id} onClick={() => { setContractType(ct.id); setContractData({ ...emptyContractData }); setContractModal(true) }}
                  className="card card-hover flex-1 p-4 text-left transition-all">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: `${ct.color}15`, border: `1px solid ${ct.color}25` }}>
                    <FileText size={16} style={{ color: ct.color }} />
                  </div>
                  <div className="font-semibold text-sm mb-0.5" style={{ color: 'var(--text-1)' }}>{ct.label}</div>
                  <div className="text-xs" style={{ color: 'var(--text-3)' }}>{ct.desc}</div>
                </button>
              ))}
            </div>

            {/* Documents sauvegardés */}
            {documents.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-3.5 font-semibold text-sm" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-1)' }}>
                  Documents sauvegardés
                </div>
                <table className="w-full">
                  <thead><tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    {['Document', 'Type', 'Statut', 'Date', ''].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {documents.map((doc, i) => {
                      const ct = CONTRACT_TYPES.find(t => t.id === doc.type)
                      const statusColors: Record<string, string> = {
                        brouillon: 'badge-gray', envoye: 'badge-blue', signe: 'badge-green', archive: 'badge-gray'
                      }
                      return (
                        <tr key={doc.id} className="table-row" style={{ borderBottom: i < documents.length-1 ? '1px solid var(--border)' : 'none' }}>
                          <td className="px-5 py-3"><div className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{doc.titre}</div></td>
                          <td className="px-5 py-3">
                            <span className="badge badge-blue text-xs">{ct?.label || doc.type}</span>
                          </td>
                          <td className="px-5 py-3"><span className={`badge ${statusColors[doc.statut]} text-xs`}>{doc.statut}</span></td>
                          <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-3)' }}>
                            {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-5 py-3">
                            <button className="btn btn-ghost btn-sm p-1.5"
                              onClick={() => {
                                const d = { ...doc.donnees, broker_nom: user?.name, broker_email: user?.email }
                                let text = ''
                                if (doc.type === 'acte_vente')      text = generateActeVente(d)
                                if (doc.type === 'mandat_exclusif') text = generateMandatExclusif(d)
                                if (doc.type === 'mandat_open')     text = generateMandatOpen(d)
                                if (doc.type === 'promesse_vente')  text = generatePromesseVente(d)
                                setPreviewText(text); setPreviewModal(true)
                              }}>
                              <Eye size={13} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══ INSPECTIONS ════════════════════════════════════════════════════════ */}
        {tab === 'inspections' && (
          <div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="card card-hover p-5" onClick={() => createInspection('amel', 'Amel Super Maramu')}>
                <div className="text-3xl mb-3">⚓</div>
                <div className="font-semibold mb-1" style={{ color: 'var(--text-1)' }}>Checklist Amel</div>
                <div className="text-sm" style={{ color: 'var(--text-3)' }}>
                  {CHECKLIST_AMEL.reduce((n, s) => n + s.items.length, 0)} points de contrôle — 6 catégories
                </div>
                <div className="text-xs mt-2" style={{ color: 'var(--accent)' }}>Cliquer pour créer →</div>
              </div>
              <div className="card card-hover p-5" onClick={() => createInspection('general', 'Bateau')}>
                <div className="text-3xl mb-3">⛵</div>
                <div className="font-semibold mb-1" style={{ color: 'var(--text-1)' }}>Checklist Générale</div>
                <div className="text-sm" style={{ color: 'var(--text-3)' }}>
                  {CHECKLIST_GENERAL.reduce((n, s) => n + s.items.length, 0)} points — extérieur, moteur, électronique, sécurité
                </div>
                <div className="text-xs mt-2" style={{ color: 'var(--accent)' }}>Cliquer pour créer →</div>
              </div>
            </div>

            {/* Inspections en cours */}
            {inspections.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-3.5 font-semibold text-sm" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-1)' }}>
                  Inspections en cours
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {inspections.map(insp => (
                    <div key={insp.id} className="flex items-center gap-4 px-5 py-4 table-row"
                      onClick={() => { setActiveInspection(insp); setInspectionModal(true) }}>
                      <div className="text-2xl">{insp.type_bateau === 'amel' ? '⚓' : '⛵'}</div>
                      <div className="flex-1">
                        <div className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{insp.titre}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                          {new Date(insp.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono font-bold text-lg" style={{ color: insp.progression > 80 ? 'var(--green)' : insp.progression > 40 ? 'var(--amber)' : 'var(--text-2)' }}>
                            {insp.progression}%
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-3)' }}>complété</div>
                        </div>
                        <div className="w-20 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${insp.progression}%`, background: insp.progression > 80 ? 'var(--green)' : 'var(--accent)' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ QUESTIONNAIRE ══════════════════════════════════════════════════════ */}
        {tab === 'questionnaire' && (
          <div>
            <div className="card p-5 mb-5">
              <div className="flex items-start gap-4">
                <div className="text-3xl">📋</div>
                <div>
                  <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--text-1)' }}>
                    Questionnaire Pré-Achat Amel
                  </h3>
                  <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
                    7 parties · ~60 questions · SM, 54 & 55 · À envoyer au vendeur avant la visite
                  </p>
                  <button className="btn btn-primary" onClick={() => { setQuestReponses({}); setQuestSection(0); setQuestModal(true) }}>
                    <Plus size={14} /> Nouveau questionnaire
                  </button>
                </div>
              </div>
            </div>

            {/* Aperçu des 7 parties */}
            <div className="grid grid-cols-1 gap-2">
              {QUESTIONNAIRE_AMEL_PARTS.map((part, i) => (
                <div key={part.id} className="card px-5 py-3 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>{i+1}</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{part.titre}</div>
                    <div className="text-xs" style={{ color: 'var(--text-3)' }}>{part.questions.length} questions</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ DÉCODEUR HIN ════════════════════════════════════════════════════════ */}
        {tab === 'hin' && (
          <div className="max-w-lg">
            <div className="card p-6 mb-4">
              <h3 className="font-semibold mb-2" style={{ color: 'var(--text-1)' }}>Décodeur HIN / CIN</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>
                Entrez le numéro de coque (12 caractères) pour obtenir l'année de fabrication et le millésime.
              </p>
              <div className="flex gap-3">
                <input className="field font-mono flex-1" placeholder="ex: FPJ12345B607" value={hinInput}
                  onChange={e => { setHinInput(e.target.value.toUpperCase()); setHinResult(null) }}
                  maxLength={14} />
                <button className="btn btn-primary" onClick={() => setHinResult(decodeHIN(hinInput))}>
                  Décoder
                </button>
              </div>
            </div>

            {hinResult && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Check size={16} style={{ color: 'var(--green)' }} />
                  <span className="font-semibold" style={{ color: 'var(--green)' }}>HIN valide</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Code fabricant (MIC)', hinResult.fabricant],
                    ['N° de série', hinResult.serie],
                    ['Mois de fabrication', hinResult.mois_fabrication],
                    ['Année de fabrication', hinResult.annee_fabrication],
                    ['Millésime (année modèle)', hinResult.millesime],
                  ].map(([l, v]) => (
                    <div key={String(l)} className="rounded-lg p-3" style={{ background: 'var(--bg)' }}>
                      <div className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>{l}</div>
                      <div className="font-mono font-semibold" style={{ color: 'var(--text-1)' }}>{v}</div>
                    </div>
                  ))}
                </div>
                {hinResult.annee_fabrication !== hinResult.millesime && (
                  <div className="mt-3 p-3 rounded-lg text-sm" style={{ background: '#fef9c3', color: '#92400e' }}>
                    ⚠️ Bateau potentiellement déclassé — construit en {hinResult.annee_fabrication} pour millésime {hinResult.millesime}
                  </div>
                )}
              </div>
            )}

            <div className="card p-5 mt-4">
              <h4 className="font-semibold text-sm mb-3" style={{ color: 'var(--text-2)' }}>Comment lire un HIN</h4>
              <div className="font-mono text-sm p-3 rounded-lg mb-3" style={{ background: 'var(--bg)', color: 'var(--text-1)', letterSpacing: '0.1em' }}>
                FPJ 12345 I 8 09
              </div>
              <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-2)' }}>
                <div><strong>FPJ</strong> — Code fabricant (MIC) · ex: FPJ = Fountaine Pajot</div>
                <div><strong>12345</strong> — Numéro de série hull</div>
                <div><strong>I</strong> — Mois de construction (A=Jan... I=Sep)</div>
                <div><strong>8</strong> — Année de construction (dernier chiffre)</div>
                <div><strong>09</strong> — Millésime / Année modèle</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ MODAL CONTRAT ═══════════════════════════════════════════════════════ */}
      <Modal isOpen={contractModal} onClose={() => setContractModal(false)}
        title={CONTRACT_TYPES.find(t => t.id === contractType)?.label || 'Contrat'}
        subtitle="Remplir les informations puis générer le document" size="xl"
        footer={<>
          <button className="btn btn-outline" onClick={() => setContractModal(false)}>Annuler</button>
          <button className="btn btn-outline" onClick={generatePreview}><Eye size={13} /> Prévisualiser</button>
          <button className="btn btn-primary" onClick={saveContract} disabled={savingContract}>
            {savingContract ? <><Loader2 size={13} className="animate-spin" />Sauvegarde...</> : 'Sauvegarder'}
          </button>
        </>}>
        <div className="space-y-5">
          {/* Bateau */}
          <div>
            <div className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
              <Ship size={14} /> Navire
            </div>
            <div className="grid grid-cols-3 gap-3">
              <F field="bateau_marque" label="Fabricant *" />
              <F field="bateau_modele" label="Modèle *" />
              <FN field="bateau_annee" label="Année" />
              <F field="bateau_nom" label="Nom du bateau" />
              <F field="bateau_immatriculation" label="Immatriculation" />
              <F field="bateau_pavillon" label="Pavillon" />
              <F field="bateau_moteur" label="Moteur" />
              <F field="bateau_num_serie" label="N° de série (HIN)" />
            </div>
          </div>

          {/* Vendeur */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>Vendeur</div>
            <div className="grid grid-cols-3 gap-3">
              <F field="vendeur_prenom" label="Prénom" />
              <F field="vendeur_nom" label="Nom" />
              <F field="vendeur_nationalite" label="Nationalité" />
              <div className="col-span-2"><F field="vendeur_adresse" label="Adresse" /></div>
              <F field="vendeur_email" label="Email" />
              <F field="vendeur_tel" label="Téléphone" />
            </div>
          </div>

          {/* Acheteur — seulement pour acte de vente et promesse */}
          {(contractType === 'acte_vente' || contractType === 'promesse_vente') && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>Acheteur</div>
              <div className="grid grid-cols-3 gap-3">
                <F field="acheteur_prenom" label="Prénom" />
                <F field="acheteur_nom" label="Nom" />
                <F field="acheteur_nationalite" label="Nationalité" />
                <div className="col-span-2"><F field="acheteur_adresse" label="Adresse" /></div>
                <F field="acheteur_email" label="Email" />
                <F field="acheteur_tel" label="Téléphone" />
              </div>
            </div>
          )}

          {/* Transaction */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>Transaction</div>
            <div className="grid grid-cols-3 gap-3">
              <FN field="prix" label="Prix de vente (€) *" />
              <F field="devise" label="Devise" />
              <FN field="commission_pct" label="Commission (%)" />
              {contractType === 'promesse_vente' && <FN field="depot_garantie" label="Dépôt de garantie (€)" />}
              <F field="date_signature" label="Date signature" />
              <div className="col-span-2"><F field="lieu_signature" label="Lieu de signature" /></div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ═══ MODAL PRÉVISUALISATION ══════════════════════════════════════════════ */}
      <Modal isOpen={previewModal} onClose={() => setPreviewModal(false)}
        title="Prévisualisation du document" size="xl"
        footer={<>
          <button className="btn btn-outline" onClick={() => setPreviewModal(false)}>Fermer</button>
          <button className="btn btn-outline" onClick={copyToClipboard}>
            {copied ? <><Check size={13} />Copié !</> : <><Copy size={13} />Copier le texte</>}
          </button>
          <button className="btn btn-primary"
            onClick={() => {
              const blob = new Blob([previewText], { type: 'text/plain;charset=utf-8' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `document_${contractType}.txt`; a.click()
            }}>
            <Download size={13} /> Télécharger .txt
          </button>
        </>}>
        <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed p-4 rounded-xl overflow-auto"
          style={{ background: 'var(--bg)', color: 'var(--text-1)', maxHeight: '60vh', border: '1px solid var(--border)' }}>
          {previewText}
        </pre>
      </Modal>

      {/* ═══ MODAL INSPECTION ════════════════════════════════════════════════════ */}
      <Modal isOpen={inspectionModal} onClose={() => { setInspectionModal(false); loadDocuments() }}
        title={activeInspection?.titre || 'Inspection'}
        subtitle={`${activeInspection?.progression || 0}% complété`}
        size="xl"
        footer={<button className="btn btn-primary" onClick={() => { setInspectionModal(false); loadDocuments() }}>Fermer</button>}>
        {activeInspection && (
          <div className="space-y-3">
            {/* Progress bar */}
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${activeInspection.progression}%`, background: activeInspection.progression > 80 ? 'var(--green)' : 'var(--accent)' }} />
            </div>

            {activeInspection.sections.map((section: any, si: number) => {
              const doneCount = section.items.filter((i: any) => i.done).length
              const isOpen = openSections.has(section.id)
              return (
                <div key={section.id} className="card overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                    onClick={() => setOpenSections(prev => {
                      const next = new Set(prev)
                      next.has(section.id) ? next.delete(section.id) : next.add(section.id)
                      return next
                    })}>
                    <span className="text-xl">{section.icone}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>{section.titre}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full"
                        style={{
                          background: doneCount === section.items.length ? 'var(--green-bg)' : 'var(--bg)',
                          color: doneCount === section.items.length ? 'var(--green)' : 'var(--text-3)'
                        }}>
                        {doneCount}/{section.items.length}
                      </span>
                      {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {section.items.map((item: any, ii: number) => (
                        <div key={item.id} className="px-5 py-3"
                          style={{ background: item.done ? '#f0fdf4' : 'transparent' }}>
                          <div className="flex items-start gap-3">
                            <button
                              className="mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                              style={{
                                background: item.done ? 'var(--green)' : 'transparent',
                                border: `2px solid ${item.done ? 'var(--green)' : 'var(--border-md)'}`,
                              }}
                              onClick={() => toggleItem(si, ii)}>
                              {item.done && <Check size={11} className="text-white" />}
                            </button>
                            <div className="flex-1">
                              <div className="text-sm" style={{ color: item.done ? 'var(--green)' : 'var(--text-1)', textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.7 : 1 }}>
                                {item.label}
                              </div>
                              {!item.done && (
                                <input className="mt-1.5 text-xs px-2 py-1 rounded w-full"
                                  style={{ border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-2)' }}
                                  placeholder="Note ou observation..." value={item.note}
                                  onChange={e => updateItemNote(si, ii, e.target.value)} />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Modal>

      {/* ═══ MODAL QUESTIONNAIRE ═════════════════════════════════════════════════ */}
      <Modal isOpen={questModal} onClose={() => setQuestModal(false)}
        title="Questionnaire Pré-Achat Amel"
        subtitle={`Partie ${questSection + 1}/${QUESTIONNAIRE_AMEL_PARTS.length} — ${QUESTIONNAIRE_AMEL_PARTS[questSection]?.titre}`}
        size="lg"
        footer={<>
          <button className="btn btn-outline" onClick={() => setQuestSection(s => Math.max(0, s - 1))} disabled={questSection === 0}>
            ← Précédent
          </button>
          {questSection < QUESTIONNAIRE_AMEL_PARTS.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setQuestSection(s => s + 1)}>
              Suivant →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={saveQuestionnaire}>
              <Check size={13} /> Terminer & Sauvegarder
            </button>
          )}
        </>}>
        <div>
          {/* Progress */}
          <div className="flex gap-1 mb-5">
            {QUESTIONNAIRE_AMEL_PARTS.map((_, i) => (
              <div key={i} className="flex-1 h-1.5 rounded-full cursor-pointer"
                style={{ background: i <= questSection ? 'var(--accent)' : 'var(--border)' }}
                onClick={() => setQuestSection(i)} />
            ))}
          </div>

          <div className="space-y-4">
            {QUESTIONNAIRE_AMEL_PARTS[questSection]?.questions.map(q => (
              <div key={q.id}>
                <label className="field-label">{q.label}</label>
                {q.type === 'textarea' ? (
                  <textarea className="field" rows={3} value={questReponses[q.id] || ''}
                    onChange={e => setQuestReponses(p => ({ ...p, [q.id]: e.target.value }))} />
                ) : q.type === 'yesno' ? (
                  <div className="flex gap-2">
                    {['Oui', 'Non', 'N/A'].map(v => (
                      <button key={v} className="btn btn-sm flex-1"
                        style={{
                          background: questReponses[q.id] === v ? 'var(--accent-bg)' : 'var(--bg)',
                          color: questReponses[q.id] === v ? 'var(--accent)' : 'var(--text-2)',
                          border: `1px solid ${questReponses[q.id] === v ? 'var(--accent)' : 'var(--border)'}`,
                        }}
                        onClick={() => setQuestReponses(p => ({ ...p, [q.id]: v }))}>
                        {v}
                      </button>
                    ))}
                  </div>
                ) : q.type === 'date' ? (
                  <input type="date" className="field" value={questReponses[q.id] || ''}
                    onChange={e => setQuestReponses(p => ({ ...p, [q.id]: e.target.value }))} />
                ) : (
                  <input className="field" value={questReponses[q.id] || ''}
                    onChange={e => setQuestReponses(p => ({ ...p, [q.id]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </CRMLayout>
  )
}
