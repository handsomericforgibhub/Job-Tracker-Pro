import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Company } from '@/lib/types'

interface CompanyContextState {
  // Current company context for site admin
  currentCompanyContext: Company | null
  
  // Actions
  setCompanyContext: (company: Company | null) => void
  clearCompanyContext: () => void
  
  // Getters
  isInCompanyContext: () => boolean
  getCurrentCompanyId: () => string | null
}

export const useCompanyContextStore = create<CompanyContextState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentCompanyContext: null,
      
      // Actions
      setCompanyContext: (company: Company | null) => {
        set({ currentCompanyContext: company })
      },
      
      clearCompanyContext: () => {
        set({ currentCompanyContext: null })
      },
      
      // Getters
      isInCompanyContext: () => {
        return get().currentCompanyContext !== null
      },
      
      getCurrentCompanyId: () => {
        return get().currentCompanyContext?.id || null
      }
    }),
    {
      name: 'company-context-storage',
      partialize: (state) => ({
        currentCompanyContext: state.currentCompanyContext
      })
    }
  )
)