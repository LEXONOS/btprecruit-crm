import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types basés sur les vraies tables
export type Client = {
  id: number
  broker_id: number
  nom: string
  prenom: string
  societe?: string
  is_pro: boolean
  email?: string
  tel?: string
  mobile?: string
  adresse?: string
  cp?: string
  ville?: string
  pays: string
  budget: number
  type_bateau?: string
  coque?: string
  quille?: string
  longueur?: string
  zone_navigation?: string
  statut: number
  note?: string
  date_saisie: string
}

export type Occasion = {
  id: number
  broker_id: number
  fabricant: string
  modele: string
  nom?: string
  annee: number
  statut: number
  pays?: string
  zone?: string
  prix: number
  devise: string
  nb_cabines: number
  nb_couchages: number
  description_fr?: string
  visible_site: boolean
  created_at: string
  photos_occasions?: PhotoOccasion[]
}

export type PhotoOccasion = {
  id: number
  occasion_id: number
  url: string
  est_principale: boolean
  ordre: number
}

export type Prospect = {
  id: number
  broker_id: number
  occasion_id?: number
  nom: string
  prenom: string
  email?: string
  mobile?: string
  pays?: string
  zone_navigation?: string
  budget: number
  type_bateau?: string
  coque?: string
  longueur?: string
  commentaire?: string
  note_broker?: string
  traite: boolean
  date_saisie: string
}

export type Broker = {
  id: number
  bureau_id: number
  nom: string
  email: string
  role: 'admin' | 'broker'
  avatar: string
  color: string
}
