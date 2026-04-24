'use client'
import { useState } from 'react'
import CRMLayout from '@/components/CRMLayout'
import Header from '@/components/Header'
import { mockBateaux } from '@/data/mock-data'
import { typesCoque, materiaux } from '@/data/referentials'
import { Anchor, Ruler, Weight, Droplets, Wind } from 'lucide-react'

export default function CataloguePage() {
  const [search, setSearch] = useState('')
  const [filterCoque, setFilterCoque] = useState('')
  const [filterFabricant, setFilterFabricant] = useState('')

  const fabricantsList = Array.from(new Set(mockBateaux.map(b => b.fabricant))).sort()

  const filtered = mockBateaux.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = !q || `${b.fabricant} ${b.modele} ${b.architecte}`.toLowerCase().includes(q)
    const matchCoque = !filterCoque || b.coque === filterCoque
    const matchFab = !filterFabricant || b.fabricant === filterFabricant
    return matchSearch && matchCoque && matchFab
  })

  return (
    <CRMLayout>
      <Header
        title="Catalogue Bateaux"
        subtitle="716 modèles référencés"
        action={{ label: 'Ajouter un modèle', onClick: () => {} }}
      />

      <div className="px-8 py-6">
        {/* Filters */}
        <div className="glass-card rounded-xl p-4 mb-6 flex flex-wrap gap-3">
          <div className="flex-1 min-w-52">
            <input
              className="crm-input"
              placeholder="Rechercher un modèle..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="crm-select" style={{ minWidth: '160px' }} value={filterCoque} onChange={e => setFilterCoque(e.target.value)}>
            <option value="">Toutes les coques</option>
            {typesCoque.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="crm-select" style={{ minWidth: '180px' }} value={filterFabricant} onChange={e => setFilterFabricant(e.target.value)}>
            <option value="">Tous les fabricants</option>
            {fabricantsList.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="mb-4 text-sm" style={{ color: 'rgba(148,163,184,0.5)' }}>
          <span className="font-mono" style={{ color: '#22d3ee' }}>{filtered.length}</span> modèles
        </div>

        {/* Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Fabricant', 'Modèle', 'Type', 'Coque', 'Longueur', 'Largeur', 'Poids', 'Gréement', 'Motorisation'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(148,163,184,0.5)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {filtered.map(b => (
                <tr key={b.id} className="table-row-hover">
                  <td className="px-4 py-3">
                    <div
                      className="inline-block text-xs px-2.5 py-1 rounded font-medium"
                      style={{ background: 'rgba(201,148,58,0.1)', color: '#e0b060', border: '1px solid rgba(201,148,58,0.15)' }}
                    >
                      {b.fabricant}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-display font-semibold text-sm" style={{ color: '#f0cc8a' }}>
                      {b.modele}
                    </div>
                    {b.architecte && (
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.4)' }}>
                        {b.architecte}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'rgba(148,163,184,0.65)', maxWidth: '140px' }}>
                    {b.type.replace('Voilier de ', '').replace('Bateau à moteur ', 'BàM ')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        background: b.coque === 'Catamaran' ? 'rgba(8,145,178,0.12)' : 'rgba(167,139,250,0.1)',
                        color: b.coque === 'Catamaran' ? '#38bdf8' : '#a78bfa',
                      }}
                    >
                      {b.coque}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm font-mono" style={{ color: '#e2e8f0' }}>
                      <Ruler size={11} style={{ color: 'rgba(148,163,184,0.4)' }} />
                      {b.longueur}m
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm" style={{ color: 'rgba(148,163,184,0.6)' }}>
                    {b.largeur}m
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs font-mono" style={{ color: 'rgba(148,163,184,0.6)' }}>
                      <Weight size={10} />
                      {b.poids > 0 ? `${(b.poids / 1000).toFixed(1)}t` : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>
                    {b.greement || '—'}
                    {b.surface_voiles > 0 && (
                      <span className="ml-1" style={{ color: 'rgba(148,163,184,0.35)' }}>
                        ({b.surface_voiles}m²)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'rgba(148,163,184,0.6)' }}>
                    {b.transmission || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </CRMLayout>
  )
}
