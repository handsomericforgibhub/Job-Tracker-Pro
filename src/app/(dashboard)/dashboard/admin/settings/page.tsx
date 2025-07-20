'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { 
  Settings, 
  Shield,
  Database,
  Mail,
  Bell,
  ArrowLeft,
  Save,
  RefreshCw,
  Server,
  Lock,
  Globe,
  Users,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface PlatformSettings {
  general: {
    platform_name: string
    support_email: string
    maintenance_mode: boolean
    registration_enabled: boolean
  }
  security: {
    password_min_length: number
    require_2fa: boolean
    session_timeout: number
    max_login_attempts: number
  }
  notifications: {
    email_notifications: boolean
    system_alerts: boolean
    maintenance_notifications: boolean
  }
  limits: {
    max_companies: number
    max_users_per_company: number
    max_jobs_per_company: number
    storage_limit_gb: number
  }
}

export default function PlatformAdminSettingsPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    // Simulate loading platform settings
    setTimeout(() => {
      const mockSettings: PlatformSettings = {
        general: {
          platform_name: 'JobTracker Pro',
          support_email: 'support@jobtracker.pro',
          maintenance_mode: false,
          registration_enabled: true
        },
        security: {
          password_min_length: 8,
          require_2fa: false,
          session_timeout: 24,
          max_login_attempts: 5
        },
        notifications: {
          email_notifications: true,
          system_alerts: true,
          maintenance_notifications: true
        },
        limits: {
          max_companies: 1000,
          max_users_per_company: 500,
          max_jobs_per_company: 1000,
          storage_limit_gb: 100
        }
      }
      setSettings(mockSettings)
      setIsLoading(false)
    }, 1000)
  }, [])

  // Check if user has admin access
  if (!user || user.role !== 'site_admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access platform settings.</p>
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate save operation
    setTimeout(() => {
      setIsSaving(false)
      setHasChanges(false)
      alert('Settings saved successfully!')
    }, 2000)
  }

  const updateSetting = (section: keyof PlatformSettings, key: string, value: any) => {
    if (!settings) return
    
    setSettings(prev => ({
      ...prev!,
      [section]: {
        ...prev![section],
        [key]: value
      }
    }))
    setHasChanges(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.back()}
            className="flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Platform Settings</h1>
            <p className="text-gray-600">
              System-wide configuration and administration
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {hasChanges && (
            <div className="flex items-center text-orange-600 text-sm mr-4">
              <AlertTriangle className="h-4 w-4 mr-1" />
              Unsaved changes
            </div>
          )}
          <Button 
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="flex items-center"
          >
            {isSaving ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            General Settings
          </CardTitle>
          <CardDescription>
            Basic platform configuration and branding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="platform_name">Platform Name</Label>
              <Input
                id="platform_name"
                value={settings?.general.platform_name || ''}
                onChange={(e) => updateSetting('general', 'platform_name', e.target.value)}
                placeholder="JobTracker Pro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support_email">Support Email</Label>
              <Input
                id="support_email"
                type="email"
                value={settings?.general.support_email || ''}
                onChange={(e) => updateSetting('general', 'support_email', e.target.value)}
                placeholder="support@jobtracker.pro"
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Maintenance Mode</Label>
                <p className="text-sm text-gray-600">
                  Temporarily disable access for maintenance
                </p>
              </div>
              <Switch
                checked={settings?.general.maintenance_mode || false}
                onCheckedChange={(checked) => updateSetting('general', 'maintenance_mode', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Allow New Registrations</Label>
                <p className="text-sm text-gray-600">
                  Enable new companies to register on the platform
                </p>
              </div>
              <Switch
                checked={settings?.general.registration_enabled || false}
                onCheckedChange={(checked) => updateSetting('general', 'registration_enabled', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Security Settings
          </CardTitle>
          <CardDescription>
            Authentication and security configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="password_min_length">Minimum Password Length</Label>
              <Input
                id="password_min_length"
                type="number"
                min="6"
                max="32"
                value={settings?.security.password_min_length || 8}
                onChange={(e) => updateSetting('security', 'password_min_length', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session_timeout">Session Timeout (hours)</Label>
              <Input
                id="session_timeout"
                type="number"
                min="1"
                max="168"
                value={settings?.security.session_timeout || 24}
                onChange={(e) => updateSetting('security', 'session_timeout', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_login_attempts">Max Login Attempts</Label>
              <Input
                id="max_login_attempts"
                type="number"
                min="3"
                max="10"
                value={settings?.security.max_login_attempts || 5}
                onChange={(e) => updateSetting('security', 'max_login_attempts', parseInt(e.target.value))}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label>Require Two-Factor Authentication</Label>
              <p className="text-sm text-gray-600">
                Mandate 2FA for all platform users
              </p>
            </div>
            <Switch
              checked={settings?.security.require_2fa || false}
              onCheckedChange={(checked) => updateSetting('security', 'require_2fa', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Platform Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Platform Limits
          </CardTitle>
          <CardDescription>
            Resource limits and quotas for the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="max_companies">Max Companies</Label>
              <Input
                id="max_companies"
                type="number"
                min="1"
                value={settings?.limits.max_companies || 1000}
                onChange={(e) => updateSetting('limits', 'max_companies', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_users_per_company">Max Users per Company</Label>
              <Input
                id="max_users_per_company"
                type="number"
                min="1"
                value={settings?.limits.max_users_per_company || 500}
                onChange={(e) => updateSetting('limits', 'max_users_per_company', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_jobs_per_company">Max Jobs per Company</Label>
              <Input
                id="max_jobs_per_company"
                type="number"
                min="1"
                value={settings?.limits.max_jobs_per_company || 1000}
                onChange={(e) => updateSetting('limits', 'max_jobs_per_company', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="storage_limit_gb">Storage Limit (GB)</Label>
              <Input
                id="storage_limit_gb"
                type="number"
                min="1"
                value={settings?.limits.storage_limit_gb || 100}
                onChange={(e) => updateSetting('limits', 'storage_limit_gb', parseInt(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="h-5 w-5 mr-2" />
            Notification Settings
          </CardTitle>
          <CardDescription>
            System-wide notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-gray-600">
                Enable email notifications for system events
              </p>
            </div>
            <Switch
              checked={settings?.notifications.email_notifications || false}
              onCheckedChange={(checked) => updateSetting('notifications', 'email_notifications', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label>System Alerts</Label>
              <p className="text-sm text-gray-600">
                Send alerts for system errors and warnings
              </p>
            </div>
            <Switch
              checked={settings?.notifications.system_alerts || false}
              onCheckedChange={(checked) => updateSetting('notifications', 'system_alerts', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label>Maintenance Notifications</Label>
              <p className="text-sm text-gray-600">
                Notify users of scheduled maintenance
              </p>
            </div>
            <Switch
              checked={settings?.notifications.maintenance_notifications || false}
              onCheckedChange={(checked) => updateSetting('notifications', 'maintenance_notifications', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Server className="h-5 w-5 mr-2" />
            System Information
          </CardTitle>
          <CardDescription>
            Platform version and system details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">Platform Version</span>
                <span className="text-sm text-gray-600">v2.1.0</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">Database Version</span>
                <span className="text-sm text-gray-600">PostgreSQL 15.3</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">Last Backup</span>
                <span className="text-sm text-gray-600">2 hours ago</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                <span className="font-medium">System Status</span>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-sm text-green-600">Healthy</span>
                </div>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">Uptime</span>
                <span className="text-sm text-gray-600">15 days, 8 hours</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="font-medium">Last Updated</span>
                <span className="text-sm text-gray-600">3 days ago</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}