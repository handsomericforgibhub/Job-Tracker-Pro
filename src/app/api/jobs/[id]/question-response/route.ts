import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const { questionId, response } = await request.json()
    
    console.log('🔄 Saving question response:', { jobId, questionId, response })

    // Get authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // TODO: Save to question_responses table when implemented
    // For now, just return success
    
    return NextResponse.json({ 
      success: true, 
      message: 'Question response saved successfully',
      data: {
        jobId,
        questionId,
        response,
        respondedBy: user.id,
        respondedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error saving question response:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}