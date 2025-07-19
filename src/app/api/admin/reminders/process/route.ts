import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Call the queue_due_reminders function
    const { data, error } = await supabase
      .rpc('queue_due_reminders')

    if (error) {
      console.error('Error processing reminders:', error)
      return NextResponse.json({ 
        error: 'Failed to process reminders', 
        details: error 
      }, { status: 500 })
    }

    const processedCount = data || 0

    // Get pending notifications to send
    const { data: notifications, error: notificationsError } = await supabase
      .from('notification_queue')
      .select(`
        id,
        reminder_id,
        notification_type,
        recipient_email,
        recipient_phone,
        message_template,
        message_data,
        scheduled_for
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .limit(50) // Process up to 50 notifications at a time

    if (notificationsError) {
      console.error('Error fetching notifications:', notificationsError)
      return NextResponse.json({ 
        error: 'Failed to fetch notifications', 
        details: notificationsError 
      }, { status: 500 })
    }

    // For now, just log the notifications that would be sent
    // In a real implementation, you would integrate with email/SMS services
    let sentCount = 0
    for (const notification of notifications || []) {
      console.log('Would send notification:', {
        type: notification.notification_type,
        recipient: notification.recipient_email || notification.recipient_phone,
        template: notification.message_template,
        data: notification.message_data
      })

      // Mark as sent (in a real implementation, only mark as sent after successful delivery)
      const { error: updateError } = await supabase
        .from('notification_queue')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        })
        .eq('id', notification.id)

      if (!updateError) {
        sentCount++
      }
    }

    return NextResponse.json({ 
      processed_reminders: processedCount,
      sent_notifications: sentCount,
      message: `Processed ${processedCount} reminders and sent ${sentCount} notifications`
    })
  } catch (error) {
    console.error('Error in reminder processing API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get stats about reminders and notifications
    const { data: reminderStats, error: reminderError } = await supabase
      .from('question_reminders')
      .select('notification_sent')

    const { data: notificationStats, error: notificationError } = await supabase
      .from('notification_queue')
      .select('status')

    if (reminderError || notificationError) {
      console.error('Error fetching stats:', { reminderError, notificationError })
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    const totalReminders = reminderStats?.length || 0
    const sentReminders = reminderStats?.filter(r => r.notification_sent).length || 0
    const pendingReminders = totalReminders - sentReminders

    const totalNotifications = notificationStats?.length || 0
    const sentNotifications = notificationStats?.filter(n => n.status === 'sent').length || 0
    const pendingNotifications = notificationStats?.filter(n => n.status === 'pending').length || 0
    const failedNotifications = notificationStats?.filter(n => n.status === 'failed').length || 0

    return NextResponse.json({
      reminders: {
        total: totalReminders,
        sent: sentReminders,
        pending: pendingReminders
      },
      notifications: {
        total: totalNotifications,
        sent: sentNotifications,
        pending: pendingNotifications,
        failed: failedNotifications
      }
    })
  } catch (error) {
    console.error('Error in reminder stats API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}