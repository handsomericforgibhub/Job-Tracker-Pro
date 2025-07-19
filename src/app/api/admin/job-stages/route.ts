import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface JobStage {
  key: string
  label: string
  color: string
  description: string
  is_initial: boolean
  is_final: boolean
  allowed_transitions: string[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    // Get current user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get user profile to check permissions
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const targetCompanyId = companyId || userProfile.company_id

    // Check if user can access this company's settings
    if (userProfile.role !== 'owner' || (companyId && userProfile.company_id !== companyId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // First try to get company-specific job stages
    const { data: companySettings, error: companyError } = await supabase
      .from('company_settings')
      .select('setting_value, updated_at')
      .eq('company_id', targetCompanyId)
      .eq('setting_key', 'job_stages')
      .eq('is_active', true)
      .single()

    if (companyError && companyError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw companyError
    }

    if (companySettings?.setting_value) {
      return NextResponse.json({
        stages: companySettings.setting_value,
        source: 'company',
        last_updated: companySettings.updated_at
      })
    }

    // Fallback to platform default job stages
    const { data: platformSettings, error: platformError } = await supabase
      .from('platform_settings')
      .select('setting_value, updated_at')
      .eq('setting_key', 'default_job_stages')
      .eq('is_active', true)
      .single()

    if (platformError) {
      throw platformError
    }

    return NextResponse.json({
      stages: platformSettings?.setting_value || [],
      source: 'platform',
      last_updated: platformSettings?.updated_at
    })

  } catch (error) {
    console.error('Error fetching job stages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job stages' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { stages, company_id } = body

    // Get current user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get user profile to check permissions
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (profileError || userProfile?.role !== 'owner') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const targetCompanyId = company_id || userProfile.company_id

    // Validate that user can modify this company's settings
    if (userProfile.company_id !== targetCompanyId) {
      return NextResponse.json({ error: 'Cannot modify other company settings' }, { status: 403 })
    }

    // Validate stages array
    if (!Array.isArray(stages) || stages.length === 0) {
      return NextResponse.json({ error: 'Stages must be a non-empty array' }, { status: 400 })
    }

    // Validate each stage
    const validationErrors = validateJobStages(stages)
    if (validationErrors.length > 0) {
      return NextResponse.json({ 
        error: 'Invalid job stages', 
        details: validationErrors 
      }, { status: 400 })
    }

    // Get current settings for audit log
    const { data: currentSettings } = await supabase
      .from('company_settings')
      .select('setting_value')
      .eq('company_id', targetCompanyId)
      .eq('setting_key', 'job_stages')
      .single()

    // Update or insert company settings
    const { data, error } = await supabase
      .from('company_settings')
      .upsert({
        company_id: targetCompanyId,
        setting_key: 'job_stages',
        setting_value: stages,
        setting_type: 'job_stages',
        description: 'Custom job stages for this company',
        is_active: true,
        updated_by: user.id
      }, {
        onConflict: 'company_id,setting_key'
      })
      .select()
      .single()

    if (error) throw error

    // Log admin action
    await supabase.rpc('log_admin_action', {
      p_action_type: 'setting_update',
      p_target_type: 'company_settings',
      p_target_id: data.id,
      p_old_values: { job_stages: currentSettings?.setting_value },
      p_new_values: { job_stages: stages },
      p_description: 'Updated job stages configuration',
      p_company_id: targetCompanyId
    })

    return NextResponse.json({
      message: 'Job stages updated successfully',
      stages: data.setting_value,
      last_updated: data.updated_at
    })

  } catch (error) {
    console.error('Error updating job stages:', error)
    return NextResponse.json(
      { error: 'Failed to update job stages' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, company_id } = body

    // Get current user
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get user profile to check permissions
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (profileError || userProfile?.role !== 'owner') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const targetCompanyId = company_id || userProfile.company_id

    if (action === 'reset_to_default') {
      // Delete company-specific job stages to fall back to platform defaults
      const { error } = await supabase
        .from('company_settings')
        .delete()
        .eq('company_id', targetCompanyId)
        .eq('setting_key', 'job_stages')

      if (error) throw error

      // Log admin action
      await supabase.rpc('log_admin_action', {
        p_action_type: 'setting_update',
        p_target_type: 'company_settings',
        p_description: 'Reset job stages to platform defaults',
        p_company_id: targetCompanyId
      })

      // Get platform defaults to return
      const { data: platformSettings } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'default_job_stages')
        .eq('is_active', true)
        .single()

      return NextResponse.json({
        message: 'Job stages reset to platform defaults',
        stages: platformSettings?.setting_value || [],
        source: 'platform'
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Error in job stages action:', error)
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    )
  }
}

// Validation helper function
function validateJobStages(stages: JobStage[]): string[] {
  const errors: string[] = []
  const keys = new Set<string>()
  let initialCount = 0
  let finalCount = 0

  stages.forEach((stage, index) => {
    // Check required fields
    if (!stage.key || typeof stage.key !== 'string') {
      errors.push(`Stage ${index + 1}: key is required and must be a string`)
    } else {
      // Check key format
      if (!/^[a-z_]+$/.test(stage.key)) {
        errors.push(`Stage ${index + 1}: key must contain only lowercase letters and underscores`)
      }
      
      // Check for duplicate keys
      if (keys.has(stage.key)) {
        errors.push(`Stage ${index + 1}: duplicate key "${stage.key}"`)
      }
      keys.add(stage.key)
    }

    if (!stage.label || typeof stage.label !== 'string') {
      errors.push(`Stage ${index + 1}: label is required and must be a string`)
    }

    if (!stage.description || typeof stage.description !== 'string') {
      errors.push(`Stage ${index + 1}: description is required and must be a string`)
    }

    if (!stage.color || typeof stage.color !== 'string') {
      errors.push(`Stage ${index + 1}: color is required and must be a string`)
    } else {
      // Check color format (hex color)
      if (!/^#[0-9A-Fa-f]{6}$/.test(stage.color)) {
        errors.push(`Stage ${index + 1}: color must be a valid hex color (e.g., #FF0000)`)
      }
    }

    if (typeof stage.is_initial !== 'boolean') {
      errors.push(`Stage ${index + 1}: is_initial must be a boolean`)
    } else if (stage.is_initial) {
      initialCount++
    }

    if (typeof stage.is_final !== 'boolean') {
      errors.push(`Stage ${index + 1}: is_final must be a boolean`)
    } else if (stage.is_final) {
      finalCount++
    }

    if (!Array.isArray(stage.allowed_transitions)) {
      errors.push(`Stage ${index + 1}: allowed_transitions must be an array`)
    }
  })

  // Business logic validation
  if (initialCount !== 1) {
    errors.push('Exactly one stage must be marked as initial')
  }

  if (finalCount === 0) {
    errors.push('At least one stage must be marked as final')
  }

  // Validate transitions reference existing stages
  const allKeys = Array.from(keys)
  stages.forEach((stage, index) => {
    if (Array.isArray(stage.allowed_transitions)) {
      stage.allowed_transitions.forEach(transition => {
        if (!allKeys.includes(transition)) {
          errors.push(`Stage ${index + 1}: transition "${transition}" references non-existent stage`)
        }
      })
    }
  })

  return errors
}