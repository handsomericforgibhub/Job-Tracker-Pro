import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Project, ProjectWithStats } from '@/lib/types';
import { LIMITS } from '@/config/timeouts';

export async function GET(request: NextRequest) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const companyId = searchParams.get('company_id');
    const status = searchParams.get('status');
    const projectManagerId = searchParams.get('project_manager_id');
    const includeStats = searchParams.get('include_stats') === 'true';
    const limit = parseInt(searchParams.get('limit') || String(LIMITS.API_PAGE_SIZE_DEFAULT));
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get user's company info for access control
    const { data: userInfo } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userInfo) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
      `);

    // Apply company filtering based on user role
    if (userInfo.role === 'site_admin') {
      // Site admins can see all companies or filter by specific company
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
    } else {
      // Regular users can only see their company's projects
      query = query.eq('company_id', userInfo.company_id);
    }

    // Apply additional filters
    if (status) {
      query = query.eq('status', status);
    }
    if (projectManagerId) {
      query = query.eq('project_manager_id', projectManagerId);
    }

    // Apply pagination
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data: projects, error } = await query;

    if (error) {
      console.error('Projects fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    // If stats are requested, fetch additional data for each project
    if (includeStats && projects) {
      const projectsWithStats: ProjectWithStats[] = [];
      
      for (const project of projects) {
        const { data: summary } = await supabase
          .rpc('get_project_summary', { project_uuid: project.id });
        
        const summaryData = summary?.[0] || {
          total_stages: 0,
          completed_stages: 0,
          total_jobs: 0,
          completed_jobs: 0,
          overall_completion: 0,
          estimated_hours: 0,
          actual_hours: 0
        };

        // Get active workers count
        const { count: activeWorkers } = await supabase
          .from('job_assignments')
          .select('worker_id', { count: 'exact', head: true })
          .in('job_id', [
            // Get job IDs for this project
            ...(await supabase
              .from('jobs')
              .select('id')
              .eq('project_id', project.id)
              .then(({ data }) => data?.map(j => j.id) || []))
          ]);

        projectsWithStats.push({
          ...project,
          ...summaryData,
          active_workers: activeWorkers || 0
        });
      }

      return NextResponse.json(projectsWithStats);
    }

    return NextResponse.json(projects);

  } catch (error) {
    console.error('Projects API error:', error);
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
    const {
      name,
      description,
      status = 'planning',
      client_name,
      site_address,
      address_components,
      latitude,
      longitude,
      planned_start_date,
      planned_end_date,
      total_budget,
      project_manager_id,
      company_id
    } = body;

    // Get user's company info for validation
    const { data: userInfo } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userInfo) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permissions
    if (userInfo.role !== 'site_admin' && !['owner', 'foreman'].includes(userInfo.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Determine the target company
    let targetCompanyId = company_id;
    if (userInfo.role !== 'site_admin') {
      targetCompanyId = userInfo.company_id;
    }

    // Validate project manager if provided
    if (project_manager_id) {
      const { data: manager } = await supabase
        .from('users')
        .select('id, role, company_id')
        .eq('id', project_manager_id)
        .single();

      if (!manager || manager.company_id !== targetCompanyId || !['owner', 'foreman'].includes(manager.role)) {
        return NextResponse.json({ error: 'Invalid project manager' }, { status: 400 });
      }
    }

    // Create the project
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name,
        description,
        status,
        client_name,
        site_address,
        address_components,
        latitude,
        longitude,
        planned_start_date,
        planned_end_date,
        total_budget,
        project_manager_id,
        company_id: targetCompanyId,
        created_by: user.id
      })
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
      console.error('Project creation error:', error);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    return NextResponse.json(project, { status: 201 });

  } catch (error) {
    console.error('Projects POST API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}