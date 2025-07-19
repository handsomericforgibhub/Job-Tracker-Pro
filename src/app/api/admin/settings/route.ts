import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const settingKey = searchParams.get('key')
    const settingType = searchParams.get('type')
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

    // Get user profile to check role
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (profileError || userProfile?.role !== 'owner') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    let query = supabase.from('platform_settings').select('*')

    if (settingKey) {
      query = query.eq('setting_key', settingKey)
    }
    
    if (settingType) {
      query = query.eq('setting_type', settingType)
    }

    query = query.eq('is_active', true).order('created_at', { ascending: true })

    const { data: platformSettings, error: platformError } = await query

    if (platformError) {
      throw platformError
    }

    // If company_id is provided, also get company-specific settings
    let companySettings = []
    if (companyId) {
      let companyQuery = supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)

      if (settingKey) {
        companyQuery = companyQuery.eq('setting_key', settingKey)
      }
      
      if (settingType) {
        companyQuery = companyQuery.eq('setting_type', settingType)
      }

      const { data: companyData, error: companyError } = await companyQuery

      if (companyError) {
        throw companyError
      }

      companySettings = companyData || []
    }

    return NextResponse.json({
      platform_settings: platformSettings || [],
      company_settings: companySettings,
      effective_settings: mergeSettings(platformSettings || [], companySettings)
    })

  } catch (error) {
    console.error('Error fetching admin settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { setting_key, setting_value, setting_type, description, is_platform = false, company_id } = body

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

    // Get user profile to check role
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (profileError || userProfile?.role !== 'owner') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Validate required fields
    if (!setting_key || !setting_value || !setting_type) {
      return NextResponse.json(
        { error: 'Missing required fields: setting_key, setting_value, setting_type' },
        { status: 400 }
      )
    }

    if (is_platform) {
      // Create platform setting
      const { data, error } = await supabase
        .from('platform_settings')
        .insert({
          setting_key,
          setting_value,
          setting_type,
          description,
          created_by: user.id,
          updated_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      // Log admin action
      await supabase.rpc('log_admin_action', {
        p_action_type: 'setting_update',
        p_target_type: 'platform_settings',
        p_target_id: data.id,
        p_new_values: { setting_key, setting_value, setting_type },
        p_description: `Created platform setting: ${setting_key}`,
        p_company_id: userProfile.company_id
      })

      return NextResponse.json(data)
    } else {
      // Create company setting
      if (!company_id) {
        return NextResponse.json(
          { error: 'company_id required for company settings' },
          { status: 400 }
        )
      }

      const { data, error } = await supabase
        .from('company_settings')
        .upsert({
          company_id,
          setting_key,
          setting_value,
          setting_type,
          description,
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
        p_new_values: { setting_key, setting_value, setting_type },
        p_description: `Updated company setting: ${setting_key}`,
        p_company_id: company_id
      })

      return NextResponse.json(data)
    }

  } catch (error) {
    console.error('Error creating admin setting:', error)
    return NextResponse.json(
      { error: 'Failed to create setting' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, setting_value, description, is_active = true, is_platform = false } = body

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

    // Get user profile to check role
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (profileError || userProfile?.role !== 'owner') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (!id) {
      return NextResponse.json({ error: 'Setting ID required' }, { status: 400 })
    }

    const tableName = is_platform ? 'platform_settings' : 'company_settings'
    
    // Get current setting for audit log
    const { data: currentSetting } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single()

    // Update setting
    const { data, error } = await supabase
      .from(tableName)
      .update({
        setting_value,
        description,
        is_active,
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Log admin action
    if (currentSetting) {
      await supabase.rpc('log_admin_action', {
        p_action_type: 'setting_update',
        p_target_type: tableName,
        p_target_id: id,
        p_old_values: { 
          setting_value: currentSetting.setting_value,
          description: currentSetting.description,
          is_active: currentSetting.is_active
        },
        p_new_values: { setting_value, description, is_active },
        p_description: `Updated ${is_platform ? 'platform' : 'company'} setting: ${currentSetting.setting_key}`,
        p_company_id: userProfile.company_id
      })
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error updating admin setting:', error)
    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const isPlatform = searchParams.get('is_platform') === 'true'

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

    // Get user profile to check role
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (profileError || userProfile?.role !== 'owner') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (!id) {
      return NextResponse.json({ error: 'Setting ID required' }, { status: 400 })
    }

    const tableName = isPlatform ? 'platform_settings' : 'company_settings'
    
    // Get setting for audit log
    const { data: settingToDelete } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single()

    // Delete setting
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id)

    if (error) throw error

    // Log admin action
    if (settingToDelete) {
      await supabase.rpc('log_admin_action', {
        p_action_type: 'setting_update',
        p_target_type: tableName,
        p_target_id: id,
        p_old_values: settingToDelete,
        p_description: `Deleted ${isPlatform ? 'platform' : 'company'} setting: ${settingToDelete.setting_key}`,
        p_company_id: userProfile.company_id
      })
    }

    return NextResponse.json({ message: 'Setting deleted successfully' })

  } catch (error) {
    console.error('Error deleting admin setting:', error)
    return NextResponse.json(
      { error: 'Failed to delete setting' },
      { status: 500 }
    )
  }
}

// Helper function to merge platform and company settings
function mergeSettings(platformSettings: any[], companySettings: any[]) {
  const merged = [...platformSettings]
  const platformKeys = new Set(platformSettings.map(s => s.setting_key))

  // Add company settings, overriding platform settings with same key
  companySettings.forEach(companySetting => {
    const existingIndex = merged.findIndex(s => s.setting_key === companySetting.setting_key)
    if (existingIndex >= 0) {
      // Override platform setting
      merged[existingIndex] = {
        ...merged[existingIndex],
        ...companySetting,
        source: 'company'
      }
    } else {
      // Add new company setting
      merged.push({
        ...companySetting,
        source: 'company'
      })
    }
  })

  // Mark platform-only settings
  merged.forEach(setting => {
    if (!setting.source) {
      setting.source = 'platform'
    }
  })

  return merged
}