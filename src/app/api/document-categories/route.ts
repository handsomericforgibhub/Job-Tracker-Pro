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

    // Get user's company ID
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('document_categories')
      .select('*')
      .eq('company_id', userData.company_id)
      .order('sort_order');

    if (error) {
      console.error('Error fetching document categories:', error);
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    return NextResponse.json({ categories: data || [] });
  } catch (error) {
    console.error('Error in document categories API:', error);
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

    // Get user's company ID
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, description, icon, color, sort_order } = body;

    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('document_categories')
      .insert({
        name,
        description,
        icon: icon || 'FileText',
        color: color || 'gray',
        sort_order: sort_order || 0,
        is_system: false,
        company_id: userData.company_id
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating document category:', error);
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Category name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }

    return NextResponse.json({ category: data });
  } catch (error) {
    console.error('Error in document categories POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}