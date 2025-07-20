import { createClient } from '@supabase/supabase-js'
import { 
  getSupabaseUrl, 
  getSupabaseAnonKey, 
  isUsingFallbackConfig,
  isValidUrl,
  SUPABASE_CONFIG 
} from '@/config/endpoints'

const supabaseUrl = getSupabaseUrl()
const supabaseAnonKey = getSupabaseAnonKey()

// Validate URL format
const isValidSupabaseUrl = isValidUrl(supabaseUrl) && supabaseUrl.includes('supabase.co')

if (!isValidSupabaseUrl || isUsingFallbackConfig()) {
  console.warn('⚠️ Supabase not configured properly. Using fallback configuration. Please update .env.local with real credentials.')
}

export const supabase = createClient(
  isValidSupabaseUrl ? supabaseUrl : SUPABASE_CONFIG.FALLBACK_CONFIG.url,
  !isUsingFallbackConfig() ? supabaseAnonKey : SUPABASE_CONFIG.FALLBACK_CONFIG.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: {
        getItem: (key) => {
          if (typeof window === 'undefined') return null
          return document.cookie
            .split('; ')
            .find(row => row.startsWith(`sb-${key}=`))
            ?.split('=')[1] || null
        },
        setItem: (key, value) => {
          if (typeof window === 'undefined') return
          document.cookie = `sb-${key}=${value}; path=/; SameSite=Lax; Secure`
        },
        removeItem: (key) => {
          if (typeof window === 'undefined') return
          document.cookie = `sb-${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        }
      }
    },
  }
)

export default supabase