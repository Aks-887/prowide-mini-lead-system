'use client';

import { useState, useEffect } from 'react';

interface Provider {
  id: number;
  name: string;
  monthlyQuota: number;
  leadsReceivedCount: number;
}

interface TestResult {
  type: 'success' | 'error' | 'info';
  message: string;
  timestamp: string;
}

export default function TestTools() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);

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
      }
    };

    fetchProviders();
  }, []);

  const addResult = (type: TestResult['type'], message: string) => {
    const result: TestResult = {
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
    };
    setResults((prev) => [result, ...prev].slice(0, 20));
  };

  const handleResetQuota = async () => {
    if (!selectedProviderId) return;
    setLoading(true);

    try {
      const res = await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: selectedProviderId,
          eventType: 'quota_reset',
          idempotencyKey: `reset_${selectedProviderId}_${Date.now()}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset quota');
      }

      addResult('success', `Quota reset for Provider ${selectedProviderId}`);

      // Refresh providers
      const refreshRes = await fetch('/api/providers');
      const refreshData = await refreshRes.json();
      setProviders(refreshData);
    } catch (err) {
      addResult('error', err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleWebhookIdempotency = async () => {
    if (!selectedProviderId) return;
    setLoading(true);

    const idempotencyKey = `test_${selectedProviderId}_${Date.now()}`;

    try {
      // Call webhook 3 times with same idempotency key
      for (let i = 0; i < 3; i++) {
        const res = await fetch('/api/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId: selectedProviderId,
            eventType: 'quota_reset',
            idempotencyKey,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Webhook failed');
        }

        addResult('info', `Webhook call ${i + 1}: ${data.message}`);
      }

      addResult('success', 'Idempotency test completed. Webhook called 3 times with same key - should only process once.');
    } catch (err) {
      addResult('error', err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLeads = async () => {
    setLoading(true);

    try {
      // Fetch services first
      const servicesRes = await fetch('/api/services');
      const services = await servicesRes.json();

      if (services.length === 0) {
        throw new Error('No services available');
      }

      addResult('info', 'Starting to generate 10 leads concurrently...');

      const phoneBase = Math.floor(Math.random() * 9000000000) + 1000000000;
      const promises = [];

      for (let i = 0; i < 10; i++) {
        const leadData = {
          name: `Test Customer ${i + 1}`,
          phone: String(phoneBase + i).padStart(10, '0'),
          city: `City ${i + 1}`,
          serviceId: services[(i % services.length)].id,
          description: `Test lead ${i + 1} generated for concurrency testing`,
        };

        promises.push(
          fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadData),
          })
            .then((res) => {
              if (res.ok) {
                return { success: true, lead: i + 1 };
              } else {
                return { success: false, lead: i + 1, error: 'Failed to create' };
              }
            })
            .catch((err) => ({ success: false, lead: i + 1, error: err.message }))
        );
      }

      const results = await Promise.all(promises);
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      addResult(
        'success',
        `Generated ${successful} leads successfully${failed > 0 ? `, ${failed} failed` : ''}`
      );

      // Show details
      if (failed > 0) {
        results
          .filter((r) => !r.success)
          .forEach((r) => {
            addResult('error', `Lead ${r.lead}: ${r.error}`);
          });
      }
    } catch (err) {
      addResult('error', err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Testing & Webhook Tools</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Provider Selection */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold mb-4">Select Provider</h2>
          <div className="space-y-2">
            {providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => setSelectedProviderId(provider.id)}
                className={`w-full text-left p-3 rounded border-2 transition ${
                  selectedProviderId === provider.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold">{provider.name}</div>
                <div className="text-xs text-gray-600">
                  {provider.leadsReceivedCount}/{provider.monthlyQuota} leads
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Test Actions */}
        <div className="lg:col-span-3 space-y-6">
          {/* Test 1: Reset Quota */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-2">Test 1: Quota Reset (Webhook)</h3>
            <p className="text-gray-600 mb-4">
              Simulates a successful payment webhook that resets the provider's monthly quota to 10.
            </p>
            <button
              onClick={handleResetQuota}
              disabled={!selectedProviderId || loading}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              {loading ? 'Processing...' : 'Reset Quota to 10'}
            </button>
          </div>

          {/* Test 2: Webhook Idempotency */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-2">Test 2: Webhook Idempotency</h3>
            <p className="text-gray-600 mb-4">
              Calls the webhook 3 times with the same idempotency key. Only the first call should process the quota reset.
            </p>
            <button
              onClick={handleWebhookIdempotency}
              disabled={!selectedProviderId || loading}
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 transition"
            >
              {loading ? 'Testing...' : 'Test Idempotency'}
            </button>
          </div>

          {/* Test 3: Concurrency */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold mb-2">Test 3: Concurrency Test</h3>
            <p className="text-gray-600 mb-4">
              Generates 10 leads concurrently to test system reliability under simultaneous requests.
            </p>
            <button
              onClick={handleGenerateLeads}
              disabled={loading}
              className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 disabled:bg-gray-400 transition"
            >
              {loading ? 'Generating...' : 'Generate 10 Leads'}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h2 className="text-xl font-bold mb-4">Test Results</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-gray-600 text-center py-8">Run a test to see results</p>
          ) : (
            results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded border-l-4 ${
                  result.type === 'success'
                    ? 'bg-green-50 border-green-600 text-green-800'
                    : result.type === 'error'
                    ? 'bg-red-50 border-red-600 text-red-800'
                    : 'bg-blue-50 border-blue-600 text-blue-800'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span>{result.message}</span>
                  <span className="text-xs text-gray-500">{result.timestamp}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
