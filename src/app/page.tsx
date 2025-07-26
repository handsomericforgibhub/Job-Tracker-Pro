export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          JobTracker Pro
        </h1>
        <p className="text-gray-600 mb-8">
          Construction Management Platform
        </p>
        
        <div className="space-y-4">
          <a 
            href="/login" 
            className="block w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Login
          </a>
          <a 
            href="/register" 
            className="block w-full bg-gray-200 text-gray-800 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Register
          </a>
          <a 
            href="/test-auth" 
            className="block w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors"
          >
            Test Database
          </a>
        </div>
      </div>
    </div>
  )
}
