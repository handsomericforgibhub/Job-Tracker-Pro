import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Company {
  id: string
  name: string
  created_at: string
  user_count?: number
  job_count?: number
  active_job_count?: number
}

interface SiteAdminContextState {
  selectedCompanyId: string | null // null means "Platform Wide"
  selectedCompany: Company | null
  availableCompanies: Company[]
  isLoading: boolean
  error: string | null
  
  // Actions
  setSelectedCompany: (companyId: string | null) => void
  setAvailableCompanies: (companies: Company[]) => void
  clearSelection: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Computed
  isPlatformWide: () => boolean
  getContextLabel: () => string
  getContextDescription: () => string
}

export const useSiteAdminContextStore = create<SiteAdminContextState>()(
  persist(
    (set, get) => ({
      selectedCompanyId: null,
      selectedCompany: null,
      availableCompanies: [],
      isLoading: false,
      error: null,

      setSelectedCompany: (companyId: string | null) => {
        const state = get()
        const company = companyId 
          ? state.availableCompanies.find(c => c.id === companyId) || null
          : null
        
        set({
          selectedCompanyId: companyId,
          selectedCompany: company,
          error: null
        })
      },

      setAvailableCompanies: (companies: Company[]) => {
        const state = get()
        set({ availableCompanies: companies })
        
        // If we have a selectedCompanyId but no selectedCompany, try to resolve it now
        if (state.selectedCompanyId && !state.selectedCompany) {
          const company = companies.find(c => c.id === state.selectedCompanyId)
          if (company) {
            set({ selectedCompany: company })
          }
        }
      },

      clearSelection: () => {
        set({
          selectedCompanyId: null,
          selectedCompany: null,
          error: null
        })
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },

      setError: (error: string | null) => {
        set({ error })
      },

      isPlatformWide: () => {
        return get().selectedCompanyId === null
      },

      getContextLabel: () => {
        const state = get()
        return state.selectedCompany ? state.selectedCompany.name : 'Platform Wide'
      },

      getContextDescription: () => {
        const state = get()
        if (state.selectedCompany) {
          return `Managing settings for ${state.selectedCompany.name}`
        }
        return 'Managing platform-wide settings for all companies'
      }
    }),
    {
      name: 'site-admin-context-storage',
      partialize: (state) => ({
        selectedCompanyId: state.selectedCompanyId,
        selectedCompany: state.selectedCompany
      })
    }
  )
)