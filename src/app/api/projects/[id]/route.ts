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
    const includeStages = searchParams.get('include_stages') === 'true';
    const includeJobs = searchParams.get('include_jobs') === 'true';

    let query = supabase
      .from('projects')
      .select(`
        *,
        project_manager:users!projects_project_manager_id_fkey(
          id,
          full_name,
          email
        ),
        company:companies(
          id,
          name
        )
      `)
      .eq('id', projectId);

    const { data: project, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      console.error('Project fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
    }

    // Add stages if requested
    if (includeStages) {
      const { data: stages } = await supabase
        .from('project_stages')
        .select(`
          *,
          assigned_foreman:users!project_stages_assigned_foreman_id_fkey(
            id,
            full_name,
            email
          )
        `)
        .eq('project_id', projectId)
        .order('sequence_order');

      project.stages = stages || [];
    }

    // Add jobs if requested
    if (includeJobs) {
      const { data: jobs } = await supabase
        .from('jobs')
        .select(`
          *,
          foreman:users!jobs_foreman_id_fkey(
            id,
            full_name,
            email
          ),
          project_stage:project_stages(
            id,
            stage_name,
            color,
            status
          )
        `)
        .eq('project_id', projectId)
        .order('created_at');

      project.jobs = jobs || [];
    }

    // Get project summary
    const { data: summary } = await supabase
      .rpc('get_project_summary', { project_uuid: projectId });
    
    const summaryData = summary?.[0] || {
      total_stages: 0,
      completed_stages: 0,
      total_jobs: 0,
      completed_jobs: 0,
      overall_completion: 0,
      estimated_hours: 0,
      actual_hours: 0
    };

    return NextResponse.json({ ...project, ...summaryData });

  } catch (error) {
    console.error('Project GET API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
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

    // Check if user has permission to edit this project
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

    // Validate project manager if being updated
    if (body.project_manager_id) {
      const { data: manager } = await supabase
        .from('users')
        .select('id, role, company_id')
        .eq('id', body.project_manager_id)
        .single();

      if (!manager || manager.company_id !== project.company_id || !['owner', 'foreman'].includes(manager.role)) {
        return NextResponse.json({ error: 'Invalid project manager' }, { status: 400 });
      }
    }

    // Update the project
    const { data: updatedProject, error } = await supabase
      .from('projects')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select(`
        *,
        project_manager:users!projects_project_manager_id_fkey(
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
      console.error('Project update error:', error);
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }

    return NextResponse.json(updatedProject);

  } catch (error) {
    console.error('Project PUT API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = params.id;
    
    // Get user permissions
    const { data: userInfo } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userInfo) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has permission to delete this project
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

    if (!['owner', 'site_admin'].includes(userInfo.role)) {
      return NextResponse.json({ error: 'Only owners and site admins can delete projects' }, { status: 403 });
    }

    // Check if project has any jobs
    const { count: jobCount } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (jobCount && jobCount > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete project with associated jobs. Please remove or reassign jobs first.' 
      }, { status: 400 });
    }

    // Delete the project (cascading will handle stages)
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      console.error('Project deletion error:', error);
      return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Project deleted successfully' });

  } catch (error) {
    console.error('Project DELETE API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}