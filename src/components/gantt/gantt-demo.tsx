'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GanttChart } from './gantt-chart'
import { Job } from '@/lib/types'
import { addDays, subDays } from 'date-fns'

export function GanttDemo() {
  // Create sample data for demo
  const sampleJobs: Job[] = [
    {
      id: '1',
      title: 'Kitchen Renovation',
      description: 'Complete kitchen remodel with new cabinets and appliances',
      status: 'active',
      start_date: subDays(new Date(), 10).toISOString(),
      end_date: addDays(new Date(), 20).toISOString(),
      budget: 15000,
      location: '123 Main St',
      company_id: 'demo',
      created_by: 'demo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      client_name: 'John Doe'
    },
    {
      id: '2',
      title: 'Bathroom Upgrade',
      description: 'Modern bathroom renovation',
      status: 'planning',
      start_date: addDays(new Date(), 5).toISOString(),
      end_date: addDays(new Date(), 25).toISOString(),
      budget: 8000,
      location: '456 Oak Ave',
      company_id: 'demo',
      created_by: 'demo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      client_name: 'Jane Smith'
    },
    {
      id: '3',
      title: 'Deck Construction',
      description: 'Build new outdoor deck',
      status: 'completed',
      start_date: subDays(new Date(), 30).toISOString(),
      end_date: subDays(new Date(), 5).toISOString(),
      budget: 12000,
      location: '789 Pine St',
      company_id: 'demo',
      created_by: 'demo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      client_name: 'Bob Johnson'
    },
    {
      id: '4',
      title: 'Roof Repair',
      description: 'Emergency roof repair after storm damage',
      status: 'on_hold',
      start_date: addDays(new Date(), 2).toISOString(),
      end_date: addDays(new Date(), 8).toISOString(),
      budget: 5000,
      location: '321 Elm St',
      company_id: 'demo',
      created_by: 'demo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      client_name: 'Sarah Wilson'
    },
    {
      id: '5',
      title: 'Basement Finishing',
      description: 'Convert basement to living space',
      status: 'planning',
      start_date: addDays(new Date(), 15).toISOString(),
      end_date: addDays(new Date(), 45).toISOString(),
      budget: 20000,
      location: '654 Maple Dr',
      company_id: 'demo',
      created_by: 'demo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      client_name: 'Mike Davis'
    }
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gantt Chart Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Interactive Features:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Click job bars to view details</li>
                <li>• Hover for job information</li>
                <li>• "Go to Today" button for navigation</li>
                <li>• Multiple view scales (Day/Week/Month)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Visual Indicators:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>• Color-coded by job status</li>
                <li>• Progress bars show completion %</li>
                <li>• Red lines mark expected end dates</li>
                <li>• Blue line shows current date</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <GanttChart jobs={sampleJobs} />
    </div>
  )
}