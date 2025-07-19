import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        category:document_categories(name, icon, color),
        uploader:users(full_name, email),
        job:jobs(title, address),
        task:tasks(title, description)
      `)
      .eq('id', (await params).id)
      .single();

    if (error) {
      console.error('Error fetching document:', error);
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Log access
    await supabase
      .from('document_access_log')
      .insert({
        document_id: (await params).id,
        accessed_by: user.id,
        access_type: 'view'
      });

    return NextResponse.json({ document: data });
  } catch (error) {
    console.error('Error in document GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      category_id,
      job_id,
      task_id,
      document_date,
      tags,
      is_public
    } = body;

    const { data, error } = await supabase
      .from('documents')
      .update({
        title,
        description,
        category_id,
        job_id,
        task_id,
        document_date,
        tags,
        is_public
      })
      .eq('id', (await params).id)
      .select(`
        *,
        category:document_categories(name, icon, color),
        uploader:users(full_name, email),
        job:jobs(title, address),
        task:tasks(title, description)
      `)
      .single();

    if (error) {
      console.error('Error updating document:', error);
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
    }

    return NextResponse.json({ document: data });
  } catch (error) {
    console.error('Error in document PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Get document details first
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('storage_path, storage_bucket')
      .eq('id', (await params).id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(document.storage_bucket)
      .remove([document.storage_path]);

    if (storageError) {
      console.error('Error deleting from storage:', storageError);
    }

    // Delete from database
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', (await params).id);

    if (error) {
      console.error('Error deleting document:', error);
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in document DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}