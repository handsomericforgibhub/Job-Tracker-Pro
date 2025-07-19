'use client'

import React, { useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { 
  ArrowLeft,
  Database,
  AlertCircle,
  Settings,
  Globe,
  Mail,
  FileText,
  Shield,
  Clock,
  Palette,
  Construction
} from 'lucide-react'
import Link from 'next/link'

export default function SystemSettings() {
  const { user } = useAuthStore()

  const settingsCategories = [
    {
      title: 'Platform Configuration',
      icon: Globe,
      description: 'System-wide settings that affect all companies',
      settings: [
        {
          key: 'default_file_limits',
          name: 'File Upload Limits',
          description: 'Maximum file sizes for documents and photos',
          status: 'configured',
          value: 'Documents: 50MB, Photos: 20MB'
        },
        {
          key: 'default_user_limits',
          name: 'User Account Limits', 
          description: 'Default limits for new companies',
          status: 'configured',
          value: 'Users: 50, Jobs: 100'
        },
        {
          key: 'api_rate_limits',
          name: 'API Rate Limits',
          description: 'Request limits for external integrations',
          status: 'default',
          value: '1000 requests/hour'
        }
      ]
    },
    {
      title: 'Email & Notifications',
      icon: Mail,
      description: 'Configure email templates and notification settings',
      settings: [
        {
          key: 'email_templates',
          name: 'Email Templates',
          description: 'Customize system email templates',
          status: 'needs_setup',
          value: 'Using defaults'
        },
        {
          key: 'notification_schedules',
          name: 'Notification Schedules',
          description: 'When and how often to send notifications',
          status: 'configured',
          value: 'Daily digest enabled'
        },
        {
          key: 'smtp_settings',
          name: 'SMTP Configuration',
          description: 'Email server settings',
          status: 'configured',
          value: 'Supabase default'
        }
      ]
    },
    {
      title: 'Security & Access',
      icon: Shield,
      description: 'Platform security and access control settings',
      settings: [
        {
          key: 'password_policy',
          name: 'Password Policy',
          description: 'Requirements for user passwords',
          status: 'configured',
          value: 'Minimum 8 characters'
        },
        {
          key: 'session_timeout',
          name: 'Session Timeout',
          description: 'How long users stay logged in',
          status: 'configured',
          value: '24 hours'
        },
        {
          key: 'two_factor_auth',
          name: 'Two-Factor Authentication',
          description: 'Require 2FA for sensitive actions',
          status: 'available',
          value: 'Optional'
        }
      ]
    },
    {
      title: 'Integrations',
      icon: Database,
      description: 'Third-party service configurations',
      settings: [
        {
          key: 'geoapify_config',
          name: 'Geoapify (Address Lookup)',
          description: 'Location services configuration',
          status: 'configured',
          value: 'Active'
        },
        {
          key: 'storage_config',
          name: 'Supabase Storage',
          description: 'File storage configuration',
          status: 'configured',
          value: 'Active with buckets'
        },
        {
          key: 'backup_config',
          name: 'Database Backups',
          description: 'Automated backup settings',
          status: 'configured',
          value: 'Daily backups'
        }
      ]
    },
    {
      title: 'Time & Localization',
      icon: Clock,
      description: 'Time zones, date formats, and localization',
      settings: [
        {
          key: 'default_timezone',
          name: 'Default Timezone',
          description: 'System default timezone',
          status: 'configured',
          value: 'UTC'
        },
        {
          key: 'date_format',
          name: 'Date Format',
          description: 'How dates are displayed',
          status: 'configured',
          value: 'MM/DD/YYYY'
        },
        {
          key: 'currency_settings',
          name: 'Currency Settings',
          description: 'Default currency and formatting',
          status: 'configured',
          value: 'USD ($)'
        }
      ]
    },
    {
      title: 'Appearance & Branding',
      icon: Palette,
      description: 'Platform visual customization',
      settings: [
        {
          key: 'platform_theme',
          name: 'Platform Theme',
          description: 'Default color scheme and styling',
          status: 'configured',
          value: 'JobTracker Blue'
        },
        {
          key: 'company_branding',
          name: 'Company Branding',
          description: 'Allow companies to customize appearance',
          status: 'available',
          value: 'Enabled'
        },
        {
          key: 'logo_settings',
          name: 'Logo Requirements',
          description: 'Specifications for company logos',
          status: 'configured',
          value: 'Max 2MB, PNG/JPG'
        }
      ]
    }
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'configured':
        return 'bg-green-100 text-green-800'
      case 'needs_setup':
        return 'bg-red-100 text-red-800'
      case 'available':
        return 'bg-blue-100 text-blue-800'
      case 'default':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'configured':
        return 'Configured'
      case 'needs_setup':
        return 'Needs Setup'
      case 'available':
        return 'Available'
      case 'default':
        return 'Default'
      default:
        return status
    }
  }

  // Redirect if not owner
  if (!user || user.role !== 'owner') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-800">Access denied. Only owners can access system settings.</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center">
          <Link href="/dashboard/admin" className="text-gray-500 hover:text-gray-700 mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Database className="h-8 w-8 text-blue-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
            <p className="text-gray-600">Configure platform-wide settings and integrations</p>
          </div>
        </div>
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <Construction className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Feature In Development
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                System settings configuration is currently in development. This overview shows the 
                planned configuration categories and settings that will be available.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {settingsCategories.map((category) => (
          <div key={category.title} className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                <category.icon className="h-6 w-6 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{category.title}</h3>
                  <p className="text-sm text-gray-600">{category.description}</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {category.settings.map((setting) => (
                  <div key={setting.key} className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">{setting.name}</h4>
                      <p className="text-xs text-gray-600">{setting.description}</p>
                      <p className="text-xs text-gray-500 mt-1">Current: {setting.value}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(setting.status)}`}>
                      {getStatusText(setting.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <Settings className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Planned Functionality
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p className="mb-2">
                When fully implemented, system settings will provide:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Real-time configuration updates without system restarts</li>
                <li>Environment-specific settings (development, staging, production)</li>
                <li>Backup and restore of configuration settings</li>
                <li>Validation and testing of setting changes before applying</li>
                <li>Audit trail of all configuration changes</li>
                <li>Integration with external configuration management systems</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}