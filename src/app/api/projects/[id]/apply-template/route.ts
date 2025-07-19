import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
    const { template_id, start_date } = body;
    
    // Get user permissions
    const { data: userInfo } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!userInfo) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has permission to modify this project
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

    // Get the template
    const { data: template, error: templateError } = await supabase
      .from('project_stage_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if user has access to this template
    if (!template.is_system_template && 
        template.company_id !== userInfo.company_id && 
        userInfo.role !== 'site_admin') {
      return NextResponse.json({ error: 'Template not accessible' }, { status: 403 });
    }

    // Check if project already has stages
    const { count: existingStagesCount } = await supabase
      .from('project_stages')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (existingStagesCount && existingStagesCount > 0) {
      return NextResponse.json({ 
        error: 'Project already has stages. Please remove existing stages before applying a template.' 
      }, { status: 400 });
    }

    // Apply the template stages
    const stages = template.stages as any[];
    const createdStages = [];
    
    let currentDate = start_date ? new Date(start_date) : new Date();

    for (const stageDefinition of stages) {
      const plannedEndDate = new Date(currentDate);
      plannedEndDate.setDate(plannedEndDate.getDate() + (stageDefinition.estimated_days || 7));

      const { data: stage, error: stageError } = await supabase
        .from('project_stages')
        .insert({
          project_id: projectId,
          stage_name: stageDefinition.name,
          sequence_order: stageDefinition.sequence,
          color: stageDefinition.color,
          status: 'pending',
          planned_start_date: currentDate.toISOString().split('T')[0],
          planned_end_date: plannedEndDate.toISOString().split('T')[0],
          estimated_hours: (stageDefinition.estimated_days || 7) * 8, // Assume 8 hour work days
          requires_client_meeting: stageDefinition.requires_client_meeting || false,
          weather_sensitive: stageDefinition.weather_sensitive || false,
          completion_percentage: 0,
          created_by: user.id
        })
        .select(`
          *,
          assigned_foreman:users!project_stages_assigned_foreman_id_fkey(
            id,
            full_name,
            email
          )
        `)
        .single();

      if (stageError) {
        console.error('Stage creation error:', stageError);
        // If we fail partway through, we should clean up created stages
        if (createdStages.length > 0) {
          await supabase
            .from('project_stages')
            .delete()
            .in('id', createdStages.map(s => s.id));
        }
        return NextResponse.json({ error: 'Failed to create project stages' }, { status: 500 });
      }

      createdStages.push(stage);
      
      // Move to next stage start date (add 1 day buffer between stages)
      currentDate = new Date(plannedEndDate);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Update the project status to active if it was planning
    if (createdStages.length > 0) {
      await supabase
        .from('projects')
        .update({ 
          status: 'active',
          planned_start_date: start_date || new Date().toISOString().split('T')[0]
        })
        .eq('id', projectId);
    }

    return NextResponse.json({
      message: 'Template applied successfully',
      stages: createdStages,
      template_applied: template.template_name
    }, { status: 201 });

  } catch (error) {
    console.error('Apply template API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}