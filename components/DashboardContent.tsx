'use client';

import { useEffect, useState, useRef } from 'react';

interface Lead {
  id: string;
  phone: string;
  name: string;
  city: string;
  service: string;
  description: string;
  assignedAt: string;
}

interface ProviderData {
  id: number;
  name: string;
  monthlyQuota: number;
  leadsReceivedCount: number;
  remainingQuota: number;
  leads: Lead[];
}

export default function DashboardContent({ providerId }: { providerId: number }) {
  const [dashboardData, setDashboardData] = useState<ProviderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Fetch initial data
    const fetchDashboard = async () => {
      try {
        const res = await fetch(`/api/dashboard?providerId=${providerId}`);
        if (!res.ok) {
          throw new Error('Failed to fetch dashboard');
        }
        const data = await res.json();
        setDashboardData(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();

    // Set up Server-Sent Events connection for real-time updates
    const setupSSE = () => {
      try {
        const eventSource = new EventSource(`/api/events?providerId=${providerId}`);

        eventSource.onopen = () => {
          console.log('SSE connection established');
        };

        eventSource.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            if (message.type === 'lead_assigned' || message.type === 'quota_reset') {
              // Refresh dashboard data when new lead is assigned or quota resets
              fetchDashboard();
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('SSE error:', error);
          eventSource.close();
          // Try to reconnect after 3 seconds
          setTimeout(setupSSE, 3000);
        };

        eventSourceRef.current = eventSource;
      } catch (err) {
        console.error('Failed to set up SSE:', err);
        // Fall back to polling
        setupPolling();
      }
    };

    // Set up polling as fallback
    const setupPolling = () => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/dashboard?providerId=${providerId}`);
          if (res.ok) {
            const data = await res.json();
            setDashboardData(data);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    };

    setupSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [providerId]);

  if (loading) {
    return <div className="text-center py-8">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  if (!dashboardData) {
    return <div className="text-center py-8">No data available</div>;
  }

  const quotaPercentage = (dashboardData.leadsReceivedCount / dashboardData.monthlyQuota) * 100;

  return (
    <div className="space-y-6">
      {/* Provider Info Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">{dashboardData.name}</h2>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded">
            <div className="text-sm text-gray-600">Monthly Quota</div>
            <div className="text-2xl font-bold text-blue-600">{dashboardData.monthlyQuota}</div>
          </div>

          <div className="bg-green-50 p-4 rounded">
            <div className="text-sm text-gray-600">Leads Received</div>
            <div className="text-2xl font-bold text-green-600">{dashboardData.leadsReceivedCount}</div>
          </div>

          <div className="bg-yellow-50 p-4 rounded">
            <div className="text-sm text-gray-600">Remaining Quota</div>
            <div className="text-2xl font-bold text-yellow-600">{dashboardData.remainingQuota}</div>
          </div>
        </div>

        {/* Quota Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">Quota Usage</span>
            <span className="text-sm text-gray-600">{Math.round(quotaPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                quotaPercentage >= 100 ? 'bg-red-600' : quotaPercentage >= 80 ? 'bg-yellow-600' : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(quotaPercentage, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Leads List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-xl font-bold">Assigned Leads ({dashboardData.leads.length})</h3>
        </div>

        {dashboardData.leads.length === 0 ? (
          <div className="p-6 text-center text-gray-600">
            No leads assigned yet.
          </div>
        ) : (
          <div className="divide-y">
            {dashboardData.leads.map((lead) => (
              <div key={lead.id} className="p-6 hover:bg-gray-50 transition">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-lg">{lead.name}</h4>
                    <p className="text-sm text-gray-600">{lead.phone} • {lead.city}</p>
                  </div>
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm font-medium">
                    {lead.service}
                  </span>
                </div>

                <p className="text-gray-700 mb-3">{lead.description}</p>

                <div className="text-xs text-gray-500">
                  Assigned: {new Date(lead.assignedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
