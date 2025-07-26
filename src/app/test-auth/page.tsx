'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TestAuthPage() {
  const [dbStatus, setDbStatus] = useState('Testing...')
  const [userCount, setUserCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function testDatabase() {
      try {
        // Test basic connectivity
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .limit(5)

        if (error) {
          setError(error.message)
          setDbStatus('❌ Database Error')
        } else {
          setUserCount(data?.length || 0)
          setDbStatus('✅ Database Connected')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setDbStatus('❌ Connection Failed')
      }
    }

    testDatabase()
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🧪 Database Connectivity Test</h1>
      
      <div style={{ marginTop: '20px' }}>
        <h2>Status</h2>
        <p>{dbStatus}</p>
        
        {userCount !== null && (
          <p>Found {userCount} user records (showing first 5)</p>
        )}
        
        {error && (
          <div style={{ 
            background: '#ffebee', 
            border: '1px solid #f44336', 
            padding: '10px', 
            marginTop: '10px',
            borderRadius: '4px'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <div style={{ marginTop: '20px' }}>
          <h3>Environment Check</h3>
          <p>Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}</p>
          <p>Supabase Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}</p>
        </div>
      </div>
    </div>
  )
}