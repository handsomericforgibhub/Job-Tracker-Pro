'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, Database, ExternalLink } from 'lucide-react'

export default function DemoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl w-full space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">JobTracker Pro</h1>
          <p className="text-xl text-gray-600">Web Application Demo Mode</p>
        </div>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-yellow-800">Configuration Required</CardTitle>
            </div>
            <CardDescription className="text-yellow-700">
              Supabase database connection is not configured properly.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-yellow-800">
            <p className="mb-4">
              To use the JobTracker Pro web application, you need to configure your Supabase database connection.
            </p>
            <div className="bg-yellow-100 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Required Steps:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Create a Supabase account at supabase.com</li>
                <li>Create a new project or use existing one</li>
                <li>Copy your project URL and anon key</li>
                <li>Update the .env.local file with your credentials</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-blue-600" />
              <CardTitle>Platform Features (When Configured)</CardTitle>
            </div>
            <CardDescription>
              Complete construction management solution for field and office work
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">✅ Phase 1 Complete</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Role-based authentication</li>
                  <li>• Professional dashboards</li>
                  <li>• Cross-platform sync</li>
                  <li>• Responsive layout</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2">🔄 Shared with Mobile</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Job management</li>
                  <li>• Worker tracking</li>
                  <li>• Document storage</li>
                  <li>• Real-time updates</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Setup Guide</CardTitle>
            <CardDescription>
              Follow these steps to get your web application running
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">1. Edit Environment File</h4>
                <div className="bg-gray-900 text-green-400 p-3 rounded text-sm font-mono">
                  <div>📁 .env.local</div>
                  <div className="mt-2">
                    <div>NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co</div>
                    <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">2. Restart Development Server</h4>
                <div className="bg-gray-900 text-green-400 p-3 rounded text-sm font-mono">
                  <div>npm run dev</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center space-x-4">
          <Button asChild>
            <a 
              href="https://supabase.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-2"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Get Supabase Account</span>
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a 
              href="https://github.com/supabase/supabase" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-2"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Documentation</span>
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}