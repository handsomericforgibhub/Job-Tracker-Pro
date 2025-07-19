'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Worker } from '@/lib/types'
import { KeyRound, Send, Copy, Eye, EyeOff } from 'lucide-react'

interface PasswordResetProps {
  worker: Worker
  onClose: () => void
}

export default function PasswordReset({ worker, onClose }: PasswordResetProps) {
  const { user } = useAuthStore()
  const [isGenerating, setIsGenerating] = useState(false)
  const [tempPassword, setTempPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const generateTempPassword = () => {
    // Generate 8-character alphanumeric password
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let password = ''
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
  }

  const handleResetPassword = async () => {
    if (!user || !worker.user_id) {
      setError('Missing required information')
      return
    }

    setIsGenerating(true)
    setError('')
    setSuccess('')

    try {
      console.log('🔄 Generating password reset for worker:', worker.id)

      // Generate temporary password
      const newTempPassword = generateTempPassword()
      setTempPassword(newTempPassword)

      // Create password reset token record
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24) // Expires in 24 hours

      const { error: tokenError } = await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: worker.user_id,
          temp_password_hash: btoa(newTempPassword), // Simple base64 encoding for demo
          expires_at: expiresAt.toISOString(),
          created_by: user.id
        })

      if (tokenError) {
        console.error('❌ Error creating password reset token:', tokenError)
        setError('Failed to create password reset token')
        return
      }

      // Update user to force password change
      const { error: userError } = await supabase
        .from('users')
        .update({ 
          force_password_change: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', worker.user_id)

      if (userError) {
        console.error('❌ Error updating user:', userError)
        setError('Failed to update user settings')
        return
      }

      // In a real application, you would:
      // 1. Hash the password properly before storing
      // 2. Update the user's password in Supabase Auth
      // 3. Send an email with the temporary password
      
      // For demo purposes, we'll use Supabase Auth admin API
      try {
        const { error: authError } = await supabase.auth.admin.updateUserById(
          worker.user_id,
          { 
            password: newTempPassword,
            user_metadata: { force_password_change: true }
          }
        )

        if (authError) {
          console.error('❌ Error updating auth password:', authError)
          setError('Failed to update password in authentication system')
          return
        }
      } catch (authErr) {
        console.error('❌ Auth admin not available in client:', authErr)
        // This would normally be done on the server side
        setError('Password reset initiated. Contact system administrator to complete the process.')
      }

      console.log('✅ Password reset completed')
      setSuccess(`Temporary password generated for ${worker.user?.full_name}`)
      
    } catch (err) {
      console.error('❌ Exception during password reset:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword)
      setSuccess('Password copied to clipboard')
    } catch (err) {
      setError('Failed to copy password')
    }
  }

  const canResetPassword = user && (user.role === 'owner' || user.role === 'foreman')

  if (!canResetPassword) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-gray-600">You don't have permission to reset passwords.</p>
          <Button variant="outline" onClick={onClose} className="mt-4">
            Close
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <KeyRound className="h-5 w-5 mr-2" />
          Reset Password for {worker.user?.full_name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md text-sm">
            {success}
          </div>
        )}

        {!tempPassword ? (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-md text-sm">
              <p className="font-medium mb-2">⚠️ Password Reset Process:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>A temporary 8-character password will be generated</li>
                <li>The worker will be required to change their password on next login</li>
                <li>The temporary password expires in 24 hours</li>
                <li>You'll need to securely share this password with the worker</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                <strong>Worker:</strong> {worker.user?.full_name}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Email:</strong> {worker.user?.email}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Employee ID:</strong> {worker.employee_id || 'Not assigned'}
              </p>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={handleResetPassword} 
                disabled={isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Generate Temporary Password
                  </>
                )}
              </Button>
              
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 p-4 rounded-md">
              <p className="text-green-800 font-medium mb-2">✅ Temporary Password Generated</p>
              
              <div className="bg-white border rounded-md p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-sm text-gray-600 mr-2">Password:</span>
                    <code className={`font-mono text-lg ${showPassword ? 'text-gray-900' : 'text-gray-400'}`}>
                      {showPassword ? tempPassword : '••••••••'}
                    </code>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyToClipboard}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="text-sm text-green-700 space-y-1">
                <p>• Password expires in 24 hours</p>
                <p>• Worker must change password on next login</p>
                <p>• Share this password securely with the worker</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={onClose} className="flex-1">
                Done
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => {
                  setTempPassword('')
                  setSuccess('')
                  setError('')
                }}
              >
                Generate New Password
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}