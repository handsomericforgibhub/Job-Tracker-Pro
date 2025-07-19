import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Running SQL command...')
    
    const { sql } = await request.json()
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    console.log('📜 Executing SQL:', sql.substring(0, 100) + '...')
    
    // Try to run the SQL - this might not work depending on Supabase setup
    try {
      const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql })
      
      if (error) {
        console.error('❌ SQL execution error:', error)
        return NextResponse.json({ 
          error: 'SQL execution failed', 
          details: error.message,
          suggestion: 'Run this SQL manually in your Supabase dashboard'
        }, { status: 500 })
      }
      
      console.log('✅ SQL executed successfully')
      return NextResponse.json({ 
        message: 'SQL executed successfully',
        data 
      })
      
    } catch (e) {
      console.error('❌ Exception during SQL execution:', e)
      return NextResponse.json({ 
        error: 'SQL execution failed', 
        details: e instanceof Error ? e.message : 'Unknown error',
        suggestion: 'Run this SQL manually in your Supabase dashboard'
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('❌ Error in run-sql:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}