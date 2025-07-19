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
    
    console.log('🔄 Assigning Lead Qualification stage to job:', jobId)

    // Get the Lead Qualification stage ID
    const leadQualificationStageId = '550e8400-e29b-41d4-a716-446655440001'

    // Update the job to use the first stage
    const { data, error } = await supabase
      .from('jobs')
      .update({
        current_stage_id: leadQualificationStageId,
        stage_entered_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select(`
        *,
        current_stage:job_stages!current_stage_id (
          id,
          name,
          color,
          sequence_order
        )
      `)
      .single()

    if (error) {
      console.error('❌ Error assigning stage:', error)
      return NextResponse.json({ error: 'Failed to assign stage: ' + error.message }, { status: 500 })
    }

    console.log('✅ Stage assigned successfully:', data)
    
    return NextResponse.json({ 
      success: true, 
      job: data,
      message: 'Lead Qualification stage assigned successfully'
    })

  } catch (error) {
    console.error('Error in assign stage API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}