import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  
  // Get the auth token from cookies
  const authCookie = cookieStore.getAll().find(cookie => 
    cookie.name.includes('auth-token') && !cookie.name.includes('code-verifier')
  );
  
  console.log('🔍 Auth cookie found:', authCookie?.name);
  
  let accessToken = null;
  if (authCookie?.value) {
    try {
      const tokenData = JSON.parse(authCookie.value);
      accessToken = tokenData.access_token;
      console.log('🔍 Access token extracted:', accessToken ? 'Yes' : 'No');
    } catch (e) {
      console.log('🔍 Failed to parse auth cookie');
    }
  }
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: accessToken ? {
          'Authorization': `Bearer ${accessToken}`
        } : {}
      }
    }
  );

  try {
    console.log('🔍 All cookies:', cookieStore.getAll().map(c => ({ name: c.name, value: c.value?.substring(0, 20) + '...' })));
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log('🔍 User data:', user ? `User ID: ${user.id}` : 'No user found');
    console.log('🔍 User error:', userError);
    
    if (userError || !user) {
      console.log('❌ Authentication failed in upload API');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const jobId = formData.get('job_id') as string;
    const taskId = formData.get('task_id') as string;
    const categoryId = formData.get('category_id') as string;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const tags = formData.get('tags') as string;
    const latitude = formData.get('latitude') as string;
    const longitude = formData.get('longitude') as string;
    const locationName = formData.get('location_name') as string;
    const companyId = formData.get('company_id') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 });
    }

    // Generate file path
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const timestamp = Date.now();
    const storagePath = `${companyId}/${jobId || 'general'}/${timestamp}_${file.name}`;
    
    // Determine storage bucket based on file type
    const isImage = file.type.startsWith('image/');
    const storageBucket = isImage ? 'photos' : 'documents';

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(storageBucket)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Create document record
    const documentData = {
      title: title || file.name,
      description: description || null,
      original_filename: file.name,
      file_extension: fileExtension,
      file_size: file.size,
      mime_type: file.type,
      storage_path: uploadData.path,
      storage_bucket: storageBucket,
      category_id: categoryId || null,
      job_id: jobId || null,
      task_id: taskId || null,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      location_name: locationName || null,
      uploaded_by: user.id,
      company_id: companyId
    };

    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert(documentData)
      .select(`
        *,
        category:document_categories(name, icon, color),
        uploader:users(full_name),
        job:jobs(title, address),
        task:tasks(title, description)
      `)
      .single();

    if (dbError) {
      console.error('Error creating document record:', dbError);
      
      // Clean up uploaded file if database insert fails
      await supabase.storage
        .from(storageBucket)
        .remove([uploadData.path]);
      
      return NextResponse.json({ error: 'Failed to create document record' }, { status: 500 });
    }

    return NextResponse.json({ 
      document,
      message: 'File uploaded successfully' 
    });

  } catch (error) {
    console.error('Error in file upload:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}