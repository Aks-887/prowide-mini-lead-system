'use client';

import { useEffect, useState } from 'react';
import DashboardContent from '@/components/DashboardContent';

export default function Dashboard() {
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await fetch('/api/providers');
        const data = await res.json();
        setProviders(data);
        if (data.length > 0) {
          setSelectedProviderId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch providers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, []);

  if (loading) {
    return <div className="text-center py-8">Loading providers...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Provider Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold">Providers</h2>
          </div>
          <div className="divide-y">
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => setSelectedProviderId(provider.id)}
                className={`w-full text-left p-4 hover:bg-gray-50 transition ${
                  selectedProviderId === provider.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                <div className="font-semibold">{provider.name}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {provider.leadsReceivedCount}/{provider.monthlyQuota} leads
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3">
          {selectedProviderId && (
            <DashboardContent providerId={selectedProviderId} />
          )}
        </div>
      </div>
    </div>
  );
}
