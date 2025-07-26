'use client'

import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { AuthState, User, Company } from '@/lib/types'

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  company: null,
  isLoading: true,

  initialize: async () => {
    console.log('🔄 Initializing authentication...')
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('❌ Session error:', sessionError)
        set({ user: null, company: null, isLoading: false })
        return
      }
      
      if (session?.user) {
        console.log('✅ Session found for user:', session.user.id)
        
        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profileError) {
          console.error('❌ Profile fetch error:', profileError)
          console.log('🔍 User ID:', session.user.id)
          console.log('🔍 User Email:', session.user.email)
          
          // If profile doesn't exist, just log it (don't redirect automatically)
          if (profileError.code === 'PGRST116') {
            console.log('⚠️ No profile found - user should complete registration')
            set({ user: null, company: null, isLoading: false })
            return
          }
          
          set({ user: null, company: null, isLoading: false })
          return
        }

        if (profile) {
          console.log('✅ Profile found:', profile)
          
          // Get company information (only if user has a company_id)
          let company = null
          if (profile.company_id) {
            console.log('🔄 Fetching company data for ID:', profile.company_id)
            const { data: companyData, error: companyError } = await supabase
              .from('companies')
              .select('*')
              .eq('id', profile.company_id)
              .single()

            if (companyError) {
              console.error('❌ Company fetch error:', companyError)
              console.log('🔍 Company ID:', profile.company_id)
              // Still proceed without company for now
            } else {
              company = companyData
              console.log('✅ Company found:', company)
            }
          } else {
            console.log('⚠️ User has no company_id - company setup required')
          }

          set({ 
            user: profile as User, 
            company: company as Company,
            isLoading: false 
          })
          console.log('✅ Authentication complete')
        } else {
          console.log('❌ No profile found for user')
          set({ user: null, company: null, isLoading: false })
        }
      } else {
        console.log('ℹ️ No active session')
        set({ user: null, company: null, isLoading: false })
      }
    } catch (error) {
      console.error('❌ Auth initialization error:', error)
      set({ user: null, company: null, isLoading: false })
    }
  },

  signIn: async (email: string, password: string) => {
    console.log('🔄 Signing in user:', email)
    set({ isLoading: true })
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('❌ Sign in error:', error)
        throw error
      }

      console.log('✅ Sign in successful for user:', data.user.id)

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profileError) {
        console.error('❌ Profile fetch error after sign in:', profileError)
        console.log('🔍 User ID:', data.user.id)
        console.log('🔍 User Email:', data.user.email)
        
        if (profileError.code === 'PGRST116') {
          set({ isLoading: false })
          throw new Error('Profile not found. Please complete your registration by creating a new account.')
        }
        
        set({ isLoading: false })
        throw new Error('Profile not found. Please contact support.')
      }

      if (profile) {
        console.log('✅ Profile found after sign in:', profile)
        
        // Get company information (only if user has a company_id)
        let company = null
        if (profile.company_id) {
          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .select('*')
            .eq('id', profile.company_id)
            .single()

          if (companyError) {
            console.error('❌ Company fetch error after sign in:', companyError)
          } else {
            company = companyData
            console.log('✅ Company found after sign in:', company)
          }
        }

        set({ 
          user: profile as User, 
          company: company as Company,
          isLoading: false 
        })
        console.log('✅ Sign in process complete')
      }
    } catch (error) {
      console.error('❌ Sign in process failed:', error)
      set({ isLoading: false })
      throw error
    }
  },

  signUp: async (email: string, password: string, fullName: string, role: User['role'], companyName?: string) => {
    console.log('🔄 Starting sign up process for:', email)
    set({ isLoading: true })
    
    try {
      console.log('📧 Creating auth user...')
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        console.error('❌ Auth signup error:', error)
        console.error('❌ Auth error details:', JSON.stringify(error, null, 2))
        console.error('❌ Auth error message:', error?.message)
        console.error('❌ Auth error code:', error?.code)
        throw error
      }

      console.log('✅ Auth user created:', data.user?.id)

      if (data.user) {
        let companyId = ''

        // Create user profile first (without company)
        console.log('👤 Creating user profile...')
        const profileData = {
          id: data.user.id,
          email: data.user.email!,
          full_name: fullName,
          role,
          company_id: null, // Will be updated after company creation
        }
        console.log('📝 Profile data:', profileData)

        const { error: profileError } = await supabase
          .from('users')
          .insert(profileData)

        if (profileError) {
          console.error('❌ Profile creation error:', profileError)
          console.error('❌ Profile error details:', JSON.stringify(profileError, null, 2))
          console.error('❌ Profile error message:', profileError?.message)
          console.error('❌ Profile error code:', profileError?.code)
          console.error('❌ Profile error hint:', profileError?.hint)
          throw new Error(`Profile creation failed: ${profileError?.message || profileError?.code || 'Unknown error'}`)
        }

        console.log('✅ Profile created successfully')

        // Now create company if owner role and company name provided
        if (role === 'owner' && companyName) {
          console.log('🏢 Creating company:', companyName)

          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .insert({ name: companyName })
            .select()
            .single()

          if (companyError) {
            console.error('❌ Company creation error:', companyError)
            console.error('❌ Company error details:', JSON.stringify(companyError, null, 2))
            console.error('❌ Company error message:', companyError?.message)
            console.error('❌ Company error code:', companyError?.code)
            console.error('❌ Company error hint:', companyError?.hint)
            throw new Error(`Company creation failed: ${companyError?.message || companyError?.code || 'Unknown error'}`)
          }
          
          companyId = companyData.id
          console.log('✅ Company created:', companyId)

          // Auto-apply builder preset stages for new company
          console.log('🏗️ Auto-applying builder preset stages...')
          try {
            const stageSetupResponse = await fetch(`/api/companies/${companyId}/setup-stages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                created_by_user_id: data.user.id
              })
            })

            if (stageSetupResponse.ok) {
              const setupResult = await stageSetupResponse.json()
              console.log('✅ Builder preset stages applied successfully:', setupResult)
            } else {
              const errorResult = await stageSetupResponse.json()
              console.error('⚠️ Failed to auto-apply builder preset:', errorResult)
              // Don't throw error - company creation should still succeed
            }
          } catch (stageSetupError) {
            console.error('⚠️ Stage setup request failed:', stageSetupError)
            // Don't throw error - company creation should still succeed
          }

          // Update user profile with company_id
          const { error: updateError } = await supabase
            .from('users')
            .update({ company_id: companyId })
            .eq('id', data.user.id)

          if (updateError) {
            console.error('❌ Profile update error:', updateError)
            console.error('❌ Update error details:', JSON.stringify(updateError, null, 2))
            // Don't throw here - profile exists, just missing company link
            console.log('⚠️ User profile created but company link failed')
          } else {
            console.log('✅ Profile updated with company ID')
          }
        }

        console.log('✅ Registration process completed successfully')
        set({ isLoading: false })
      }
    } catch (error) {
      console.error('❌ Sign up process failed:', error)
      console.error('❌ Error details:', JSON.stringify(error, null, 2))
      console.error('❌ Error message:', (error as any)?.message)
      console.error('❌ Error code:', (error as any)?.code)
      set({ isLoading: false })
      throw error
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut()
      set({ user: null, company: null, isLoading: false })
    } catch (error) {
      console.error('Sign out error:', error)
    }
  },

  createProfile: async (fullName: string, role: User['role'], companyName?: string) => {
    console.log('🔄 Creating profile for existing user...')
    set({ isLoading: true })
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.user) {
        throw new Error('No active session found')
      }

      let companyId = ''

      // Create company if owner role and company name provided
      if (role === 'owner' && companyName) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .insert({ name: companyName })
          .select()
          .single()

        if (companyError) throw companyError
        companyId = companyData.id
        
        // Auto-apply builder preset stages for new company
        console.log('🏗️ Auto-applying builder preset stages...')
        try {
          const stageSetupResponse = await fetch(`/api/companies/${companyId}/setup-stages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              created_by_user_id: session.user.id
            })
          })

          if (stageSetupResponse.ok) {
            const setupResult = await stageSetupResponse.json()
            console.log('✅ Builder preset stages applied successfully:', setupResult)
          } else {
            const errorResult = await stageSetupResponse.json()
            console.error('⚠️ Failed to auto-apply builder preset:', errorResult)
            // Don't throw error - company creation should still succeed
          }
        } catch (stageSetupError) {
          console.error('⚠️ Stage setup request failed:', stageSetupError)
          // Don't throw error - company creation should still succeed
        }
      }

      // Create user profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .insert({
          id: session.user.id,
          email: session.user.email!,
          full_name: fullName,
          role,
          company_id: companyId,
        })
        .select()
        .single()

      if (profileError) throw profileError

      console.log('✅ Profile created successfully:', profile)
      
      // Initialize the user session with new profile
      await useAuthStore.getState().initialize()
      
    } catch (error) {
      console.error('❌ Profile creation failed:', error)
      set({ isLoading: false })
      throw error
    }
  },
}))

// Auth state change listener
supabase.auth.onAuthStateChange((event, session) => {
  console.log('🔄 Auth state change:', event, session?.user?.id)
  
  if (event === 'SIGNED_OUT') {
    useAuthStore.getState().signOut()
  } else if (event === 'SIGNED_IN' && session) {
    useAuthStore.getState().initialize()
  }
})