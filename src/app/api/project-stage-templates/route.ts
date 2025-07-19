import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const industryType = searchParams.get('industry_type');
    const projectType = searchParams.get('project_type');
    const includeSystemTemplates = searchParams.get('include_system') !== 'false';

    // Get user's company info
    const { data: userInfo } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userInfo) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let query = supabase
      .from('project_stage_templates')
      .select(`
        *,
        created_by_user:users!project_stage_templates_created_by_fkey(
          id,
          full_name,
          email
        ),
        company:companies(
          id,
          name
        )
      `);

    // Build filter conditions
    const conditions = [];
    
    // System templates (available to all)
    if (includeSystemTemplates) {
      conditions.push('is_system_template.eq.true');
    }
    
    // Company-specific templates (only for the user's company unless site admin)
    if (userInfo.role === 'site_admin') {
      // Site admins can see all company templates
      conditions.push('is_system_template.eq.false');
    } else if (userInfo.company_id) {
      // Regular users see their company's templates
      conditions.push(`and(is_system_template.eq.false,company_id.eq.${userInfo.company_id})`);
    }

    if (conditions.length > 0) {
      query = query.or(conditions.join(','));
    }

    // Apply additional filters
    if (industryType) {
      query = query.eq('industry_type', industryType);
    }
    if (projectType) {
      query = query.eq('project_type', projectType);
    }

    query = query.order('template_name');

    const { data: templates, error } = await query;

    if (error) {
      console.error('Project stage templates fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    return NextResponse.json(templates);

  } catch (error) {
    console.error('Project stage templates API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    // Get user permissions
    const { data: userInfo } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userInfo) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permissions - only owners and site admins can create templates
    if (!['owner', 'site_admin'].includes(userInfo.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const {
      template_name,
      description,
      industry_type,
      project_type,
      is_system_template = false,
      stages,
      company_id
    } = body;

    // Validate stages array
    if (!Array.isArray(stages) || stages.length === 0) {
      return NextResponse.json({ error: 'Stages array is required and must not be empty' }, { status: 400 });
    }

    // Validate each stage definition
    for (const stage of stages) {
      if (!stage.name || !stage.color || typeof stage.sequence !== 'number') {
        return NextResponse.json({ 
          error: 'Each stage must have name, color, and sequence number' 
        }, { status: 400 });
      }
    }

    // Determine target company and system template permissions
    let targetCompanyId = null;
    let finalIsSystemTemplate = false;

    if (userInfo.role === 'site_admin') {
      // Site admins can create system templates or company-specific templates
      finalIsSystemTemplate = is_system_template;
      targetCompanyId = finalIsSystemTemplate ? null : (company_id || userInfo.company_id);
    } else {
      // Regular owners can only create company-specific templates
      finalIsSystemTemplate = false;
      targetCompanyId = userInfo.company_id;
    }

    // Create the template
    const { data: template, error } = await supabase
      .from('project_stage_templates')
      .insert({
        template_name,
        description,
        industry_type,
        project_type,
        is_system_template: finalIsSystemTemplate,
        company_id: targetCompanyId,
        stages,
        created_by: user.id
      })
      .select(`
        *,
        created_by_user:users!project_stage_templates_created_by_fkey(
          id,
          full_name,
          email
        ),
        company:companies(
          id,
          name
        )
      `)
      .single();

    if (error) {
      console.error('Project stage template creation error:', error);
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    return NextResponse.json(template, { status: 201 });

  } catch (error) {
    console.error('Project stage templates POST API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}