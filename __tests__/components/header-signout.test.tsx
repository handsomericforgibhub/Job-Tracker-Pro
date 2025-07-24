/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/header'
import { useAuthStore } from '@/stores/auth-store'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock auth store
jest.mock('@/stores/auth-store', () => ({
  useAuthStore: jest.fn(),
}))

// Mock UI components
jest.mock('@/components/ui/button', () => {
  return {
    Button: ({ children, onClick, disabled, ...props }: any) => (
      <button onClick={onClick} disabled={disabled} {...props}>
        {children}
      </button>
    ),
  }
})

const mockPush = jest.fn()
const mockSignOut = jest.fn()

beforeEach(() => {
  ;(useRouter as jest.Mock).mockReturnValue({
    push: mockPush,
  })
  
  ;(useAuthStore as jest.Mock).mockReturnValue({
    user: {
      id: '1',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'worker',
      company_id: 'company1'
    },
    company: {
      id: 'company1',
      name: 'Test Company'
    },
    signOut: mockSignOut,
  })
  
  mockPush.mockClear()
  mockSignOut.mockClear()
})

describe('Header Sign Out', () => {
  it('renders sign out button when user is authenticated', () => {
    render(<Header />)
    
    expect(screen.getByText('Sign out')).toBeInTheDocument()
  })

  it('does not render when user is null', () => {
    ;(useAuthStore as jest.Mock).mockReturnValue({
      user: null,
      company: null,
      signOut: mockSignOut,
    })
    
    render(<Header />)
    
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument()
  })

  it('calls signOut and redirects when sign out button is clicked', async () => {
    mockSignOut.mockResolvedValue(undefined)
    
    render(<Header />)
    
    const signOutButton = screen.getByText('Sign out')
    fireEvent.click(signOutButton)
    
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1)
    })
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('still redirects when signOut throws an error', async () => {
    mockSignOut.mockRejectedValue(new Error('Sign out failed'))
    
    render(<Header />)
    
    const signOutButton = screen.getByText('Sign out')
    fireEvent.click(signOutButton)
    
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1)
    })
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('shows loading state during sign out', async () => {
    let resolveSignOut: () => void
    const signOutPromise = new Promise<void>((resolve) => {
      resolveSignOut = resolve
    })
    mockSignOut.mockReturnValue(signOutPromise)
    
    render(<Header />)
    
    const signOutButton = screen.getByRole('button', { name: /sign out/i })
    fireEvent.click(signOutButton)
    
    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Signing out...')).toBeInTheDocument()
    })
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing out/i })).toBeDisabled()
    })
    
    // Resolve the promise
    resolveSignOut!()
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('prevents multiple clicks during sign out', async () => {
    let resolveSignOut: () => void
    const signOutPromise = new Promise<void>((resolve) => {
      resolveSignOut = resolve
    })
    mockSignOut.mockReturnValue(signOutPromise)
    
    render(<Header />)
    
    const signOutButton = screen.getByText('Sign out')
    
    // Click multiple times
    fireEvent.click(signOutButton)
    fireEvent.click(signOutButton)
    fireEvent.click(signOutButton)
    
    // signOut should only be called once
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    
    resolveSignOut!()
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })
})