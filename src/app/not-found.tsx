import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">404</h2>
          <p className="text-gray-600 mb-4">Page not found</p>
          <p className="text-sm text-gray-500 mb-6">
            The page you are looking for doesn't exist.
          </p>
          <Link href="/">
            <Button className="w-full">
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}