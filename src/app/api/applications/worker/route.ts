import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST - Submit new worker application
export async function POST(request: NextRequest) {
  try {
    const applicationData = await request.json()
    
    // Validate required fields
    const requiredFields = ['full_name', 'email', 'phone']
    for (const field of requiredFields) {
      if (!applicationData[field]) {
        return NextResponse.json({ 
          error: `Missing required field: ${field}` 
        }, { status: 400 })
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(applicationData.email)) {
      return NextResponse.json({ 
        error: 'Invalid email format' 
      }, { status: 400 })
    }

    // For now, we'll use a default company_id or find one to associate with
    // In a real application, this might be determined by the URL or form data
    const { data: companies, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .limit(1)
      .single()

    if (companyError || !companies) {
      console.error('Error fetching company for application:', companyError)
      return NextResponse.json({ 
        error: 'Unable to process application at this time. Please ensure the database is properly set up.' 
      }, { status: 500 })
    }

    // Check for duplicate email applications
    const { data: existingApplication } = await supabase
      .from('worker_applications')
      .select('id, status')
      .eq('email', applicationData.email)
      .eq('company_id', companies.id)
      .single()

    if (existingApplication) {
      if (existingApplication.status === 'pending') {
        return NextResponse.json({ 
          error: 'An application with this email is already pending review' 
        }, { status: 409 })
      } else if (existingApplication.status === 'approved') {
        return NextResponse.json({ 
          error: 'An application with this email has already been approved' 
        }, { status: 409 })
      }
    }

    // Prepare data for insertion
    const insertData = {
      company_id: companies.id,
      full_name: applicationData.full_name,
      email: applicationData.email,
      phone: applicationData.phone,
      address: applicationData.address || null,
      date_of_birth: applicationData.date_of_birth || null,
      desired_hourly_rate: applicationData.desired_hourly_rate || null,
      availability: applicationData.availability || null,
      work_experience: applicationData.work_experience || null,
      previous_employer: applicationData.previous_employer || null,
      years_experience: applicationData.years_experience || null,
      skills: applicationData.skills || null,
      certifications: applicationData.certifications || null,
      licenses: applicationData.licenses || null,
      cover_letter: applicationData.cover_letter || null,
      reference1_name: applicationData.references?.[0]?.name || null,
      reference1_phone: applicationData.references?.[0]?.phone || null,
      reference1_email: applicationData.references?.[0]?.email || null,
      reference1_relationship: applicationData.references?.[0]?.relationship || null,
      reference2_name: applicationData.references?.[1]?.name || null,
      reference2_phone: applicationData.references?.[1]?.phone || null,
      reference2_email: applicationData.references?.[1]?.email || null,
      reference2_relationship: applicationData.references?.[1]?.relationship || null,
      emergency_contact_name: applicationData.emergency_contact?.name || null,
      emergency_contact_phone: applicationData.emergency_contact?.phone || null,
      emergency_contact_relationship: applicationData.emergency_contact?.relationship || null,
      source: applicationData.source || null,
      status: 'pending'
    }

    // Insert the application
    const { data: application, error: insertError } = await supabase
      .from('worker_applications')
      .insert(insertData)
      .select('*')
      .single()

    if (insertError) {
      console.error('Error creating worker application:', insertError)
      return NextResponse.json({ 
        error: 'Failed to submit application' 
      }, { status: 500 })
    }

    // TODO: Send notification email to company owners/HR
    // This would typically integrate with an email service like SendGrid or AWS SES

    return NextResponse.json({
      application,
      message: 'Application submitted successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Worker application submission error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// GET - Fetch worker applications (for admin dashboard)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!company_id) {
      return NextResponse.json({ 
        error: 'Missing company_id parameter' 
      }, { status: 400 })
    }

    let query = supabase
      .from('worker_applications')
      .select(`
        *,
        reviewed_by_user:users!worker_applications_reviewed_by_fkey(
          full_name,
          email
        ),
        company:companies(
          name
        )
      `)
      .eq('company_id', company_id)
      .order('applied_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply status filter if specified
    if (status && ['pending', 'approved', 'rejected', 'withdrawn'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data: applications, error } = await query

    if (error) {
      console.error('Error fetching worker applications:', error)
      
      // Check if the error is due to missing table
      if (error.message?.includes('relation "worker_applications" does not exist')) {
        return NextResponse.json({ 
          applications: [],
          message: 'Worker applications table not found. Please run database migration script 12-worker-applications-schema.sql'
        })
      }
      
      return NextResponse.json({ 
        error: 'Failed to fetch applications',
        details: error.message 
      }, { status: 500 })
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('worker_applications')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', company_id)

    if (status && ['pending', 'approved', 'rejected', 'withdrawn'].includes(status)) {
      countQuery = countQuery.eq('status', status)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('Error getting applications count:', countError)
    }

    return NextResponse.json({
      applications: applications || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    })

  } catch (error) {
    console.error('Get worker applications error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}