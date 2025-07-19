import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const includeJobs = searchParams.get('include_jobs') === 'true';
    const status = searchParams.get('status');

    let query = supabase
      .from('project_stages')
      .select(`
        *,
        assigned_foreman:users!project_stages_assigned_foreman_id_fkey(
          id,
          full_name,
          email
        ),
        project:projects(
          id,
          name,
          status
        )
      `)
      .eq('project_id', projectId);

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('sequence_order');

    const { data: stages, error } = await query;

    if (error) {
      console.error('Project stages fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch project stages' }, { status: 500 });
    }

    // Add jobs for each stage if requested
    if (includeJobs && stages) {
      for (const stage of stages) {
        const { data: jobs } = await supabase
          .from('jobs')
          .select(`
            *,
            foreman:users!jobs_foreman_id_fkey(
              id,
              full_name,
              email
            )
          `)
          .eq('project_stage_id', stage.id)
          .order('created_at');

        stage.jobs = jobs || [];
      }
    }

    return NextResponse.json(stages);

  } catch (error) {
    console.error('Project stages API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
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

    // Check if user has permission to add stages to this project
    const { data: project } = await supabase
      .from('projects')
      .select('company_id')
      .eq('id', projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (userInfo.role !== 'site_admin' && project.company_id !== userInfo.company_id) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!['owner', 'foreman', 'site_admin'].includes(userInfo.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const {
      stage_name,
      description,
      sequence_order,
      color = '#3b82f6',
      status = 'pending',
      planned_start_date,
      planned_end_date,
      estimated_hours,
      requires_client_meeting = false,
      weather_sensitive = false,
      depends_on_stage_ids,
      assigned_foreman_id
    } = body;

    // Validate assigned foreman if provided
    if (assigned_foreman_id) {
      const { data: foreman } = await supabase
        .from('users')
        .select('id, role, company_id')
        .eq('id', assigned_foreman_id)
        .single();

      if (!foreman || foreman.company_id !== project.company_id || !['owner', 'foreman'].includes(foreman.role)) {
        return NextResponse.json({ error: 'Invalid foreman assignment' }, { status: 400 });
      }
    }

    // Get the next sequence order if not provided
    let finalSequenceOrder = sequence_order;
    if (!finalSequenceOrder) {
      const { data: lastStage } = await supabase
        .from('project_stages')
        .select('sequence_order')
        .eq('project_id', projectId)
        .order('sequence_order', { ascending: false })
        .limit(1)
        .single();

      finalSequenceOrder = (lastStage?.sequence_order || 0) + 1;
    }

    // Create the project stage
    const { data: stage, error } = await supabase
      .from('project_stages')
      .insert({
        project_id: projectId,
        stage_name,
        description,
        sequence_order: finalSequenceOrder,
        color,
        status,
        planned_start_date,
        planned_end_date,
        estimated_hours,
        requires_client_meeting,
        weather_sensitive,
        depends_on_stage_ids,
        assigned_foreman_id,
        created_by: user.id
      })
      .select(`
        *,
        assigned_foreman:users!project_stages_assigned_foreman_id_fkey(
          id,
          full_name,
          email
        ),
        project:projects(
          id,
          name,
          status
        )
      `)
      .single();

    if (error) {
      console.error('Project stage creation error:', error);
      return NextResponse.json({ error: 'Failed to create project stage' }, { status: 500 });
    }

    return NextResponse.json(stage, { status: 201 });

  } catch (error) {
    console.error('Project stages POST API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}