import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('job_id');
    const taskId = searchParams.get('task_id');
    const categoryId = searchParams.get('category_id');
    const limit = searchParams.get('limit');

    let query = supabase
      .from('documents')
      .select(`
        *,
        category:document_categories(name, icon, color),
        uploader:users(full_name),
        job:jobs(title, address),
        task:tasks(title, description)
      `)
      .order('created_at', { ascending: false });

    if (jobId) {
      query = query.eq('job_id', jobId);
    }

    if (taskId) {
      query = query.eq('task_id', taskId);
    }

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching documents:', error);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    return NextResponse.json({ documents: data || [] });
  } catch (error) {
    console.error('Error in documents API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      title,
      description,
      original_filename,
      file_extension,
      file_size,
      mime_type,
      storage_path,
      storage_bucket,
      category_id,
      job_id,
      task_id,
      document_date,
      tags,
      latitude,
      longitude,
      location_name,
      company_id
    } = body;

    // Insert document record
    const { data, error } = await supabase
      .from('documents')
      .insert({
        title,
        description,
        original_filename,
        file_extension,
        file_size,
        mime_type,
        storage_path,
        storage_bucket: storage_bucket || 'documents',
        category_id,
        job_id,
        task_id,
        document_date,
        tags,
        latitude,
        longitude,
        location_name,
        uploaded_by: user.id,
        company_id
      })
      .select(`
        *,
        category:document_categories(name, icon, color),
        uploader:users(full_name),
        job:jobs(title, address),
        task:tasks(title, description)
      `)
      .single();

    if (error) {
      console.error('Error creating document:', error);
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
    }

    return NextResponse.json({ document: data });
  } catch (error) {
    console.error('Error in documents POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}