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
    const body = await request.json()
    const { stage_id } = body
    
    console.log('🔄 Assigning stage to job:', jobId, 'Stage ID:', stage_id)

    // Use provided stage_id or fallback to first available stage
    let targetStageId = stage_id
    
    if (!targetStageId) {
      // Fallback: Get the first stage by sequence order
      const { data: firstStage, error: stageError } = await supabase
        .from('job_stages')
        .select('id')
        .order('sequence_order')
        .limit(1)
        .single()
        
      if (stageError || !firstStage) {
        console.error('❌ Error finding first stage:', stageError)
        return NextResponse.json({ error: 'No stages available' }, { status: 400 })
      }
      
      targetStageId = firstStage.id
    }

    // Update the job to use the specified stage
    const { data, error } = await supabase
      .from('jobs')
      .update({
        current_stage_id: targetStageId,
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
      message: 'Stage assigned successfully'
    })

  } catch (error) {
    console.error('Error in assign stage API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}