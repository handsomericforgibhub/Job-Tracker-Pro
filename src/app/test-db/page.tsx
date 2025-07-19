'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestDBPage() {
  const [results, setResults] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const testDatabaseConnection = async () => {
    setIsLoading(true)
    setResults([])
    
    try {
      addResult('🔄 Testing database connection...')
      
      // Test 1: Basic connection
      const { data: connectionTest, error: connectionError } = await supabase
        .from('users')
        .select('id')
        .limit(1)

      if (connectionError) {
        addResult(`❌ Connection test failed: ${JSON.stringify(connectionError)}`)
        addResult(`❌ Error message: ${connectionError.message}`)
        addResult(`❌ Error code: ${connectionError.code}`)
      } else {
        addResult('✅ Database connection successful')
      }

      // Test 2: Check current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        addResult(`❌ Session error: ${sessionError.message}`)
      } else if (session) {
        addResult(`✅ Active session found: ${session.user.email}`)
        addResult(`🔍 User ID: ${session.user.id}`)
      } else {
        addResult('ℹ️ No active session')
      }

      // Test 3: Check if companies table exists
      const { data: companiesTest, error: companiesError } = await supabase
        .from('companies')
        .select('id')
        .limit(1)

      if (companiesError) {
        addResult(`❌ Companies table test failed: ${JSON.stringify(companiesError)}`)
      } else {
        addResult('✅ Companies table accessible')
      }

      // Test 4: Check if current user has a profile
      if (session) {
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profileError) {
          addResult(`❌ Profile fetch failed: ${profileError.message || profileError.code || 'Unknown error'}`)
          addResult(`❌ Profile error details: ${JSON.stringify(profileError)}`)
          
          if (profileError.code === 'PGRST116') {
            addResult('ℹ️ No profile found - this explains the authentication issues!')
          }
        } else {
          addResult(`✅ Profile found: ${JSON.stringify(userProfile)}`)
        }
      }

    } catch (error) {
      addResult(`❌ Test failed with exception: ${(error as any)?.message || 'Unknown error'}`)
      console.error('Database test error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const clearSession = async () => {
    addResult('🔄 Clearing session...')
    await supabase.auth.signOut()
    localStorage.clear()
    sessionStorage.clear()
    addResult('✅ Session cleared - please refresh the page')
  }

  const createProfile = async () => {
    setIsLoading(true)
    addResult('🔄 Creating profile for current user...')
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        addResult('❌ No active session found')
        return
      }

      // Create the profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .insert({
          id: session.user.id,
          email: session.user.email!,
          full_name: 'Test User', // You can change this
          role: 'owner',
          company_id: null,
        })
        .select()
        .single()

      if (profileError) {
        addResult(`❌ Profile creation failed: ${profileError.message || profileError.code || 'Unknown error'}`)
        addResult(`❌ Profile creation details: ${JSON.stringify(profileError)}`)
      } else {
        addResult(`✅ Profile created successfully: ${JSON.stringify(profile)}`)
        addResult('🎉 You should now be able to access the dashboard!')
      }

    } catch (error) {
      addResult(`❌ Profile creation exception: ${(error as any)?.message || 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Database Connection Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button 
                onClick={testDatabaseConnection} 
                disabled={isLoading}
              >
                {isLoading ? 'Testing...' : 'Test Database'}
              </Button>
              <Button 
                onClick={createProfile}
                disabled={isLoading}
                variant="default"
              >
                {isLoading ? 'Creating...' : 'Create Profile'}
              </Button>
              <Button 
                variant="outline"
                onClick={clearSession}
              >
                Clear Session
              </Button>
            </div>
            
            <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
              {results.length === 0 ? (
                <p>Click "Test Database" to run diagnostics...</p>
              ) : (
                results.map((result, index) => (
                  <div key={index} className="mb-1">{result}</div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}