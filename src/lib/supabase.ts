import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'demo_key'

// Validate URL format
const isValidUrl = supabaseUrl.startsWith('https://') && supabaseUrl.includes('supabase.co')

if (!isValidUrl || supabaseAnonKey === 'demo_key') {
  console.warn('⚠️ Supabase not configured properly. Please update .env.local with real credentials.')
}

export const supabase = createClient(
  isValidUrl ? supabaseUrl : 'https://demo.supabase.co',
  supabaseAnonKey !== 'demo_key' ? supabaseAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbW8iLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDk5NTIwMCwiZXhwIjoxOTU2NTcxMjAwfQ.demo',
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