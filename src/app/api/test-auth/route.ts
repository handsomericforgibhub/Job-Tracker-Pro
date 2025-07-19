import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Testing authentication...')
    
    // Get the current user from request headers (server-side auth)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('Token received:', token.substring(0, 50) + '...')
    
    // Create a server-side supabase client to verify the token
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError) {
      console.error('User error:', userError)
      return NextResponse.json({ error: 'Invalid token', details: userError.message }, { status: 401 })
    }
    
    if (!user) {
      return NextResponse.json({ error: 'No user found' }, { status: 401 })
    }

    console.log('✅ User authenticated:', user.email)
    
    return NextResponse.json({ 
      message: 'Authentication successful',
      user: {
        id: user.id,
        email: user.email
      }
    })
    
  } catch (error) {
    console.error('❌ Error in test auth:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}