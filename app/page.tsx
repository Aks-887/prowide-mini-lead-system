export default function Home() {
  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-4xl font-bold mb-4">Welcome to Prowider</h1>
        <p className="text-gray-600 mb-6">
          A modern lead distribution system designed for seamless service allocation.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/request-service" className="bg-blue-600 text-white p-6 rounded-lg hover:bg-blue-700 transition">
            <h3 className="text-xl font-bold mb-2">Request Service</h3>
            <p>Submit your service enquiry</p>
          </a>
          <a href="/dashboard" className="bg-green-600 text-white p-6 rounded-lg hover:bg-green-700 transition">
            <h3 className="text-xl font-bold mb-2">Dashboard</h3>
            <p>View provider leads and quota</p>
          </a>
          <a href="/test-tools" className="bg-purple-600 text-white p-6 rounded-lg hover:bg-purple-700 transition">
            <h3 className="text-xl font-bold mb-2">Test Tools</h3>
            <p>Testing and webhook simulation</p>
          </a>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">How It Works</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-bold text-blue-600">1. Submit Your Request</h3>
            <p className="text-gray-600">Fill out the service request form with your details.</p>
          </div>
          <div>
            <h3 className="font-bold text-blue-600">2. Automatic Allocation</h3>
            <p className="text-gray-600">Your lead is automatically distributed to 3 providers based on our fair allocation algorithm.</p>
          </div>
          <div>
            <h3 className="font-bold text-blue-600">3. Real-Time Updates</h3>
            <p className="text-gray-600">Providers see their leads instantly on their dashboard without needing to refresh.</p>
          </div>
          <div>
            <h3 className="font-bold text-blue-600">4. Fair Distribution</h3>
            <p className="text-gray-600">Leads are distributed fairly using round-robin allocation to respect monthly quotas.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
